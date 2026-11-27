import CoreGraphics
import Foundation
import Metal
import simd

public enum AvatarRenderError: LocalizedError {
    case metalUnavailable
    case missingShader
    case allocationFailed

    public var errorDescription: String? {
        switch self {
        case .metalUnavailable: "Metal is unavailable on this device."
        case .missingShader: "The AvatarSwift shader could not be loaded."
        case .allocationFailed: "An avatar rendering resource could not be allocated."
        }
    }
}

public struct AvatarRenderOptions: Equatable, Sendable {
    public enum Background: Equatable, Sendable { case transparent, studio }
    public var background: Background
    public var viewportScale: Double
    public var grayscale: Double

    public init(background: Background = .transparent, viewportScale: Double = 1, grayscale: Double = 0) {
        self.background = background
        self.viewportScale = viewportScale
        self.grayscale = grayscale
    }
}

/// Renders the native scene used by both the SwiftUI view and offscreen exporters.
@MainActor
public final class AvatarMetalRenderer {
    public let device: any MTLDevice
    private let queue: any MTLCommandQueue
    private let pipeline: any MTLComputePipelineState
    /// The kernel that also samples the far side of the head, for marks past its horizon.
    private let farSidePipeline: any MTLComputePipelineState
    private let emptyFace: any MTLTexture
    private let emptyMarks: any MTLTexture
    private let faceAtlas: MaskAtlas<FaceFeature>
    private let markAtlas: MaskAtlas<MarksKey>

    public init(device: (any MTLDevice)? = MTLCreateSystemDefaultDevice()) throws {
        guard let device, let queue = device.makeCommandQueue() else { throw AvatarRenderError.metalUnavailable }
        let text = try AvatarResources.data("Avatar", extension: "metal")
        guard let source = String(data: text, encoding: .utf8) else { throw AvatarRenderError.missingShader }
        let library = try device.makeLibrary(source: source, options: nil)
        func kernel(farSide: Bool) throws -> any MTLComputePipelineState {
            let constants = MTLFunctionConstantValues()
            var value = farSide
            constants.setConstantValue(&value, type: .bool, index: 0)
            let function = try library.makeFunction(name: "renderAvatar", constantValues: constants)
            return try device.makeComputePipelineState(function: function)
        }
        self.device = device
        self.queue = queue
        pipeline = try kernel(farSide: false)
        farSidePipeline = try kernel(farSide: true)
        emptyFace = try Self.makeEmpty(device: device, slices: FaceSlices.count)
        emptyMarks = try Self.makeEmpty(device: device, slices: 1)
        faceAtlas = MaskAtlas(device: device, slices: FaceSlices.count)
        markAtlas = MaskAtlas(device: device, slices: 1)
    }

    /// The texture must be BGRA8Unorm with shader-write usage. Commit the returned command buffer:
    /// it also carries the updates of the face and spinner masks.
    public func encode(_ scene: AvatarScene, into texture: any MTLTexture,
                       options: AvatarRenderOptions = .init()) throws -> any MTLCommandBuffer {
        do {
            return try encodeFrame(scene, into: texture, options: options)
        } catch {
            // The masks drawn for this frame are in a command buffer that will not run.
            faceAtlas.invalidate()
            markAtlas.invalidate()
            throw error
        }
    }

    private func encodeFrame(_ scene: AvatarScene, into texture: any MTLTexture,
                             options: AvatarRenderOptions) throws -> any MTLCommandBuffer {
        let parts = scene.parts.map(PartUniform.init)
        guard !parts.isEmpty, let commands = queue.makeCommandBuffer() else { throw AvatarRenderError.allocationFailed }
        let extent = 1.25 * clamp(options.viewportScale, 0.1, 6)
        // The atlas covers the head as seen from the front, a little beyond its edge.
        let primary = scene.character.body.primary
        let headSize: Double = max(primary.width, primary.height) / 240
        let faceExtent: Double = max(0.3, 1.02 * headSize)
        let spinner = scene.frame.spinner
        let faceVisibility = spinner.map { $0.amount >= 0.5 ? 0 : 1 - $0.round } ?? 1
        // Texels as fine as the pixels the face covers: the view's pixels per body unit, the
        // size of the body, and how much the perspective enlarges the front of the head.
        let pixels = Double(min(texture.width, texture.height))
        let perUnit: Double = pixels / (2 * extent)
        let bodyScale: Double = max(abs(scene.scale.x), abs(scene.scale.y))
        let perspective = scene.character.face.perspective
        let focal: Double = 620 / 120 / max(perspective, 0.0001)
        let nearest: Double = primary.depth / 240
        let enlargement: Double = perspective > 0.0001 ? focal / max(focal - nearest, focal / 2) : 1
        let faceTexels: Double = 2 * faceExtent * perUnit * bodyScale * enlargement

        let face: any MTLTexture
        var shown = SIMD4<Float>(repeating: 0)
        var pastHorizon = false
        if faceVisibility > 0 {
            let features = faceFeatures(scene)
            let size = atlasSize(faceTexels, current: faceAtlas.size, maximum: 2048)
            face = try faceAtlas.update(size: size, extent: faceExtent, keys: features, commands: commands) { slice, context in
                drawFaceFeature(features[slice], in: context)
            }
            let visibility = faceFeatureVisibility(features, scene: scene)
            for (index, visible) in visibility.shown.enumerated() where visible { shown[index] = 1 }
            pastHorizon = visibility.pastHorizon
        } else {
            face = emptyFace
        }

        let markMask: any MTLTexture
        if let spinner, !spinner.marks.isEmpty {
            let size = atlasSize(pixels, current: markAtlas.size, maximum: 1024)
            let key = MarksKey(marks: spinner.marks, radius: scene.bodyRadius)
            markMask = try markAtlas.update(size: size, extent: extent, keys: [key], commands: commands) { _, context in
                drawSpinnerMarks(key.marks, radius: key.radius, in: context)
            }
        } else {
            markMask = emptyMarks
        }

        guard let encoder = commands.makeComputeCommandEncoder() else { throw AvatarRenderError.allocationFailed }
        defer { encoder.endEncoding() }
        let kernel = pastHorizon ? farSidePipeline : pipeline
        encoder.setComputePipelineState(kernel)
        encoder.setTexture(texture, index: 0)
        encoder.setTexture(face, index: 1)
        encoder.setTexture(markMask, index: 2)
        try parts.withUnsafeBytes { source in
            guard let address = source.baseAddress else { throw AvatarRenderError.allocationFailed }
            if source.count <= 4_096 {
                encoder.setBytes(address, length: source.count, index: 0)
            } else {
                guard let buffer = device.makeBuffer(bytes: address, length: source.count, options: .storageModeShared)
                else { throw AvatarRenderError.allocationFailed }
                encoder.setBuffer(buffer, offset: 0, index: 0)
            }
        }

        var uniforms = SceneUniform(scene, extent: extent, faceExtent: faceExtent,
                                    faceVisibility: faceVisibility, options: options)
        uniforms.features = shown * Float(faceVisibility)
        withUnsafeBytes(of: &uniforms) { source in
            encoder.setBytes(source.baseAddress!, length: source.count, index: 1)
        }
        let columns = kernel.threadExecutionWidth
        let rows = min(8, kernel.maxTotalThreadsPerThreadgroup / columns)
        encoder.dispatchThreads(MTLSize(width: texture.width, height: texture.height, depth: 1),
                                threadsPerThreadgroup: MTLSize(width: columns, height: rows, depth: 1))
        return commands
    }

    private static func makeEmpty(device: any MTLDevice, slices: Int) throws -> any MTLTexture {
        let spec = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .r8Unorm, width: 1, height: 1, mipmapped: false)
        if slices > 1 {
            spec.textureType = .type2DArray
            spec.arrayLength = slices
        }
        spec.storageMode = .shared
        spec.usage = .shaderRead
        guard let texture = device.makeTexture(descriptor: spec) else { throw AvatarRenderError.allocationFailed }
        var zero: UInt8 = 0
        for slice in 0..<slices {
            texture.replace(region: MTLRegionMake2D(0, 0, 1, 1), mipmapLevel: 0, slice: slice, withBytes: &zero,
                            bytesPerRow: 1, bytesPerImage: 1)
        }
        return texture
    }
}

/// The slices of the face atlas: the two eyes, the nose and the mouth.
private enum FaceSlices { static let count = 4 }

private struct MarksKey: Equatable {
    let marks: [AvatarSpinnerMark]
    let radius: Double
}

/// The size of a square atlas for the texels wanted, in powers of two from 256 to `maximum`. An
/// atlas already made is kept while it is fine enough and not much too fine, so that a body that
/// breathes about the edge of two sizes does not remake it every frame.
private func atlasSize(_ wanted: Double, current: Int, maximum: Int) -> Int {
    let needed = min(Double(maximum), max(256, wanted))
    if current > 0, Double(current) >= 0.85 * needed, Double(current) <= 2.5 * needed { return current }
    var size = 256
    while Double(size) < needed, size < maximum { size *= 2 }
    return size
}

/// Square masks drawn by CoreGraphics, one or several slices, each drawn again only when what it
/// shows changes. A slice is drawn into a staging buffer and copied into the texture by the
/// command buffer that samples it, so a frame still on the GPU never sees it change.
@MainActor
private final class MaskAtlas<Key: Equatable> {
    let device: any MTLDevice
    let slices: Int
    private(set) var size = 0
    private var extent = 0.0
    private var texture: (any MTLTexture)?
    private var keys: [Key?]

    init(device: any MTLDevice, slices: Int) {
        self.device = device
        self.slices = slices
        keys = Array(repeating: nil, count: slices)
    }

    /// Forget what the slices show, so that the next update draws them all.
    func invalidate() { keys = Array(repeating: nil, count: slices) }

    func update(size: Int, extent: Double, keys wanted: [Key], commands: any MTLCommandBuffer,
                draw: (Int, CGContext) -> Void) throws -> any MTLTexture {
        if texture == nil || size != self.size || extent != self.extent {
            let spec = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .r8Unorm, width: size, height: size,
                                                                mipmapped: false)
            if slices > 1 {
                spec.textureType = .type2DArray
                spec.arrayLength = slices
            }
            spec.storageMode = .private
            spec.usage = .shaderRead
            guard let made = device.makeTexture(descriptor: spec) else { throw AvatarRenderError.allocationFailed }
            texture = made
            self.size = size
            self.extent = extent
            keys = Array(repeating: nil, count: slices)
        }
        guard let texture else { throw AvatarRenderError.allocationFailed }
        let dirty = (0..<slices).filter { keys[$0] != wanted[$0] }
        guard !dirty.isEmpty else { return texture }
        let sliceBytes = size * size
        guard let staging = device.makeBuffer(length: sliceBytes * dirty.count, options: .storageModeShared),
              let blit = commands.makeBlitCommandEncoder() else { throw AvatarRenderError.allocationFailed }
        let scale = Double(size) / (2 * extent)
        for (order, slice) in dirty.enumerated() {
            let address = staging.contents() + order * sliceBytes
            memset(address, 0, sliceBytes)
            guard let context = CGContext(data: address, width: size, height: size, bitsPerComponent: 8,
                                          bytesPerRow: size, space: CGColorSpaceCreateDeviceGray(),
                                          bitmapInfo: CGImageAlphaInfo.none.rawValue)
            else {
                blit.endEncoding()
                throw AvatarRenderError.allocationFailed
            }
            context.translateBy(x: Double(size) / 2, y: Double(size) / 2)
            context.scaleBy(x: scale, y: scale)
            draw(slice, context)
            blit.copy(from: staging, sourceOffset: order * sliceBytes, sourceBytesPerRow: size,
                      sourceBytesPerImage: sliceBytes, sourceSize: MTLSize(width: size, height: size, depth: 1),
                      to: texture, destinationSlice: slice, destinationLevel: 0,
                      destinationOrigin: MTLOrigin(x: 0, y: 0, z: 0))
            keys[slice] = wanted[slice]
        }
        blit.endEncoding()
        return texture
    }
}

private struct PartUniform {
    var centerKind: SIMD4<Float>
    var radiiRoundness: SIMD4<Float>
    var axisX: SIMD4<Float>
    var axisY: SIMD4<Float>
    var axisZ: SIMD4<Float>
    var color: SIMD4<Float>
    var profile: SIMD4<Float>
    var extra: SIMD4<Float>

    init(_ part: AvatarScene.Part) {
        let shape = part.surface
        let radii = SIMD3<Float>(Float(shape.width), Float(shape.height), Float(shape.depth)) / 240
        let matrix = simd_double3x3(normalizedQuaternion(part.orientation))
        let kind: Float
        switch shape.type {
        case .sphere, .mickey, .cursor: kind = 0
        case .cube: kind = 1
        case .capsule: kind = 2
        case .cylinder: kind = 3
        case .cone: kind = 4
        case .diamond: kind = 5
        case .trapezoid: kind = 6
        }
        centerKind = SIMD4(SIMD3<Float>(part.center), kind)
        radiiRoundness = SIMD4(simd_max(radii, SIMD3(repeating: 0.001)), Float(shape.roundness))
        axisX = SIMD4(SIMD3<Float>(matrix.columns.0), 0)
        axisY = SIMD4(SIMD3<Float>(matrix.columns.1), 0)
        axisZ = SIMD4(SIMD3<Float>(matrix.columns.2), 0)
        color = SIMD4(linearColor(part.color), 0)
        profile = SIMD4(Float(shape.morphRoundness ?? 0), Float(shape.tipRoundness ?? 0),
                        Float(shape.baseRoundness ?? 0), Float(shape.topScale ?? 0.82))
        extra = SIMD4(Float(shape.bottomScale ?? 1.08), 0, 0, 0)
    }
}

private struct SceneUniform {
    var transform: SIMD4<Float>
    var bodyPaint: SIMD4<Float>
    var eyePaint: SIMD4<Float>
    var outline: SIMD4<Float>
    var display: SIMD4<Float>
    var textures: SIMD4<Float>
    var spinner: SIMD4<Float>
    var spinnerStyle: SIMD4<Float>
    var geometry: SIMD4<Float>
    /// How much of each slice of the face atlas is shown: the eyes, the nose, the mouth.
    var features = SIMD4<Float>(repeating: 0)

    init(_ scene: AvatarScene, extent: Double, faceExtent: Double, faceVisibility: Double, options: AvatarRenderOptions) {
        let style = scene.character.style
        let line = style?.outline
        let drawing = scene.frame.spinner
        let amount = drawing?.amount ?? 0
        let radius = drawing?.core.radius ?? 0
        let scale = scene.scale * interpolate(1, radius, amount)
        let spinCenter = scene.translation + (drawing?.core.position ?? .zero) * SIMD2(scene.bodyRadius, -scene.bodyRadius)
        transform = SIMD4(Float(spinCenter.x), Float(spinCenter.y), Float(scale.x), Float(scale.y))
        bodyPaint = SIMD4(linearColor(scene.character.colors.body), Float(clamp(scene.frame.pose.opacity)))
        eyePaint = SIMD4(linearColor(scene.character.colors.eyes), Float(scene.character.face.perspective))
        outline = SIMD4(linearColor(line?.color ?? "#000000"), line?.enabled == true ? Float((line?.width ?? 0) / 120) : 0)
        display = SIMD4(Float(extent), 0, options.background == .studio ? 1 : 0,
                        Float(line?.opacity ?? 0))
        textures = SIMD4(Float(faceExtent), Float(faceVisibility), Float(extent), Float(clamp(options.grayscale)))
        spinner = SIMD4(Float(spinCenter.x), Float(spinCenter.y), Float(radius * scene.bodyRadius),
                        Float(drawing?.round ?? 0))
        spinnerStyle = SIMD4(Float(drawing?.core.opacity ?? 1), drawing?.core.drop == true ? 1 : 0,
                             Float(radians(drawing?.core.turn ?? 0)), 0)
        let bound = scene.parts.reduce(0.1) { far, part in
            let surface = part.surface
            let radii = SIMD3(surface.width, surface.height, surface.depth) / 240
            let box = surface.type == .sphere ? max(radii.x, radii.y, radii.z) : simd_length(radii) * 1.35
            return max(far, simd_length(part.center) + box)
        }
        geometry = SIMD4(Float(scene.parts.count), Float(bound + 0.035), 0, 0)
    }
}

private func linearColor(_ hex: String) -> SIMD3<Float> {
    let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
    guard digits.count == 6, let number = UInt32(digits, radix: 16) else { return .zero }
    func channel(_ shift: UInt32) -> Float {
        let sRGB = Float((number >> shift) & 0xff) / 255
        return sRGB <= 0.04045 ? sRGB / 12.92 : pow((sRGB + 0.055) / 1.055, 2.4)
    }
    return SIMD3(channel(16), channel(8), channel(0))
}
