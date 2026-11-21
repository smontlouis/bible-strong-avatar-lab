#if os(macOS)
import AvatarSwift
import AVFoundation
import CoreGraphics
import CoreText
import Metal

@MainActor
enum DemoReel {
    private static let width = 1440
    private static let height = 1080
    private static let fps: Int32 = 30

    static func write(to destination: URL) throws {
        guard destination.pathExtension.lowercased() == "mp4" else {
            throw ReelError.init("Choose an output path ending in .mp4.")
        }
        let files = FileManager.default
        guard !files.fileExists(atPath: destination.path) else {
            throw ReelError.init("An item already exists at \(destination.path).")
        }

        let renderer = try AvatarMetalRenderer()
        let spec = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: width,
                                                           height: height, mipmapped: false)
        spec.usage = .shaderWrite
        spec.storageMode = .shared
        guard let texture = renderer.device.makeTexture(descriptor: spec) else {
            throw ReelError("A video frame could not be rendered.")
        }

        let temporary = destination.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).mp4")
        defer { try? files.removeItem(at: temporary) }
        let writer = try AVAssetWriter(outputURL: temporary, fileType: .mp4)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoColorPropertiesKey: [
                AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
            ],
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 9_000_000,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            ],
        ])
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
            kCVPixelBufferCGImageCompatibilityKey as String: true,
        ])
        guard writer.canAdd(input) else {
            throw ReelError.init("H.264 encoding is unavailable.")
        }
        writer.add(input)
        guard writer.startWriting() else { throw writerError(writer) }
        writer.startSession(atSourceTime: .zero)
        defer {
            if writer.status == .writing { writer.cancelWriting() }
        }
        guard let pool = adaptor.pixelBufferPool else { throw writerError(writer) }

        let frameCount = 600
        var scene = ReelScene()
        for frame in 0..<frameCount {
            scene.update(frame: frame, fps: fps)
            let sample = renderCharacterFrame(scene.character, scene.engine.frame)
            try autoreleasepool {
                let deadline = Date().addingTimeInterval(12)
                while !input.isReadyForMoreMediaData {
                    guard writer.status == .writing, Date() < deadline else { throw writerError(writer) }
                    Thread.sleep(forTimeInterval: 0.003)
                }
                var pixelBuffer: CVPixelBuffer?
                guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixelBuffer) == kCVReturnSuccess,
                      let pixelBuffer else { throw writerError(writer) }
                let command = try renderer.encode(sample, into: texture,
                                                  options: .init(background: .studio, grayscale: scene.grayscale))
                command.commit()
                command.waitUntilCompleted()
                guard command.status == .completed else { throw command.error ?? ReelError("A video frame could not be rendered.") }
                try writePixels(texture, into: pixelBuffer, caption: scene.caption)
                let presentationTime = CMTime(value: CMTimeValue(frame), timescale: fps)
                guard adaptor.append(pixelBuffer, withPresentationTime: presentationTime) else {
                    throw writerError(writer)
                }
            }
        }
        input.markAsFinished()
        let finished = DispatchSemaphore(value: 0)
        writer.finishWriting { finished.signal() }
        guard finished.wait(timeout: .now() + 30) == .success, writer.status == .completed else {
            throw writerError(writer)
        }
        try files.moveItem(at: temporary, to: destination)
        print(destination.path)
    }

    private static func writePixels(_ texture: any MTLTexture, into buffer: CVPixelBuffer, caption: String) throws {
        guard CVPixelBufferLockBaseAddress(buffer, []) == kCVReturnSuccess else {
            throw ReelError("A video frame could not be rendered.")
        }
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let data = CVPixelBufferGetBaseAddress(buffer),
              let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: data, width: width, height: height, bitsPerComponent: 8,
                                      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: space,
                                      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                                          | CGBitmapInfo.byteOrder32Little.rawValue) else {
            throw ReelError("A video frame could not be rendered.")
        }
        texture.getBytes(data, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                         from: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0)
        draw("AvatarSwift", size: 32, at: CGPoint(x: 69, y: 1002), in: context)
        draw(caption, size: 28, at: CGPoint(x: 69, y: 60), in: context)
    }

    private static func draw(_ text: String, size: CGFloat, at point: CGPoint, in context: CGContext) {
        let font = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, size, nil)
        let run = NSAttributedString(string: text, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String):
                CGColor(red: 0.13, green: 0.18, blue: 0.27, alpha: 1),
        ])
        context.textPosition = point
        CTLineDraw(CTLineCreateWithAttributedString(run), context)
    }

    private static func writerError(_ writer: AVAssetWriter) -> Error {
        writer.error ?? ReelError.init("The video encoder did not complete.")
    }
}
private struct ReelError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

private struct ReelScene {
    var character = DemoFiles.strobi
    var engine = AvatarEngine(seed: 26, library: DemoFiles.library)
    var caption = ""
    var grayscale = 0.0

    mutating func update(frame: Int, fps: Int32) {
        switch frame {
        case 0:
            caption = "Strobi · Idle"
            engine.setState("idle")
        case 85:
            caption = "Listening · Look at a point"
            engine.setState("listening")
            engine.setLookAt(SIMD2(-0.66, 0.35))
        case 165:
            caption = "Thinking · Dots"
            engine.setLookAt(nil)
            engine.setState("thinking")
        case 275:
            caption = "Strobi · Spin gesture"
            engine.setState("idle")
        case 304:
            engine.poke(.spin)
        case 355:
            caption = "Strobi · Held pose"
            engine.setPose(.init(rotation: SIMD3(0, 30, 0)))
        case 390:
            caption = "Clover · Imported character"
            character = DemoFiles.clover
            engine = AvatarEngine(seed: 26, library: DemoFiles.library)
            engine.setState("listening")
        case 445:
            caption = "Custom clip · Drawn face"
            engine.setState("greeting")
        case 564:
            caption = "Return to idle · Grayscale"
        default:
            break
        }
        grayscale = min(1, Double(max(0, frame - 564)) / 9)
        engine.advance(1 / Double(fps))
    }
}
#endif
