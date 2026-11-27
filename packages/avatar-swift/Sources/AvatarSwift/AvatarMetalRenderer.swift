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
    private let emptyMask: any MTLTexture
    private var faceCache: (key: FaceAtlasKey, extent: Double, texture: any MTLTexture)?

    public init(device: (any MTLDevice)? = MTLCreateSystemDefaultDevice()) throws {
        guard let device, let queue = device.makeCommandQueue() else { throw AvatarRenderError.metalUnavailable }
        let text = try AvatarResources.data("Avatar", extension: "metal")
        guard let source = String(data: text, encoding: .utf8) else { throw AvatarRenderError.missingShader }
        let library = try device.makeLibrary(source: source, options: nil)
        guard let kernel = library.makeFunction(name: "renderAvatar") else { throw AvatarRenderError.missingShader }
        self.device = device
        self.queue = queue
        pipeline = try device.makeComputePipelineState(function: kernel)
        emptyMask = try Self.makeMask(device: device, size: 1, extent: 1) { _ in }
    }

    /// The texture must be BGRA8Unorm with shader-write usage. Commit the returned command buffer.
    public func encode(_ scene: AvatarScene, into texture: any MTLTexture,
                       options: AvatarRenderOptions = .init()) throws -> any MTLCommandBuffer {
        let extent = 1.25 * clamp(options.viewportScale, 0.1, 6)
        let faceExtent = max(0.6, 1.4 * scene.faceRadius)
        let spinner = scene.frame.spinner
        let faceVisibility = spinner.map { $0.amount >= 0.5 ? 0 : 1 - $0.round } ?? 1
        let face: any MTLTexture
        if faceVisibility > 0 {
            let key = FaceAtlasKey(scene)
            if let cached = faceCache, key == cached.key, faceExtent == cached.extent {
                face = cached.texture
            } else {
                face = try Self.makeMask(device: device, size: 256, extent: faceExtent) {
                    drawAvatarFace(key, in: $0)
                }
                faceCache = (key, faceExtent, face)
            }
        } else {
            face = emptyMask
        }

        let markMask: any MTLTexture
        if let spinner, !spinner.marks.isEmpty {
            markMask = try Self.makeMask(device: device, size: 256, extent: extent) {
                drawSpinnerMarks(spinner.marks, radius: scene.bodyRadius, in: $0)
            }
        } else {
            markMask = emptyMask
        }
        let parts = scene.parts.map(PartUniform.init)
        guard !parts.isEmpty,
              let commands = queue.makeCommandBuffer(),
              let encoder = commands.makeComputeCommandEncoder() else { throw AvatarRenderError.allocationFailed }
        defer { encoder.endEncoding() }
        encoder.setComputePipelineState(pipeline)
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
        withUnsafeBytes(of: &uniforms) { source in
            encoder.setBytes(source.baseAddress!, length: source.count, index: 1)
        }
        let columns = pipeline.threadExecutionWidth
        let rows = min(8, pipeline.maxTotalThreadsPerThreadgroup / columns)
        encoder.dispatchThreads(MTLSize(width: texture.width, height: texture.height, depth: 1),
                                threadsPerThreadgroup: MTLSize(width: columns, height: rows, depth: 1))
        return commands
    }

    private static func makeMask(device: any MTLDevice, size: Int, extent: Double,
                                 drawing: (CGContext) -> Void) throws -> any MTLTexture {
        let spec = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .r8Unorm, width: size, height: size, mipmapped: false)
        spec.storageMode = .shared
        spec.usage = .shaderRead
        guard let texture = device.makeTexture(descriptor: spec) else { throw AvatarRenderError.allocationFailed }
        var bytes = [UInt8](repeating: 0, count: size * size)
        try bytes.withUnsafeMutableBytes { buffer in
            guard let address = buffer.baseAddress,
                  let context = CGContext(data: address, width: size, height: size, bitsPerComponent: 8,
                                          bytesPerRow: size, space: CGColorSpaceCreateDeviceGray(),
                                          bitmapInfo: CGImageAlphaInfo.none.rawValue)
            else { throw AvatarRenderError.allocationFailed }
            context.translateBy(x: Double(size) / 2, y: Double(size) / 2)
            let scale = Double(size) / (2 * extent)
            context.scaleBy(x: scale, y: scale)
            drawing(context)
            texture.replace(region: MTLRegionMake2D(0, 0, size, size), mipmapLevel: 0,
                            withBytes: address, bytesPerRow: size)
        }
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
