import MetalKit
import SwiftUI

/// Attach a handle to a view to layer gestures over its current animation.
@MainActor
public final class AvatarHandle {
    fileprivate weak var playback: ViewPlayback?

    public init() {}

    public func poke(_ gesture: AvatarGesture, turns: Int = 1) {
        playback?.poke(gesture, turns: turns)
    }
}

/// A native SwiftUI counterpart to the Avatar Lab renderer.
/// Use ordinary SwiftUI modifiers to style and size its container.
public struct AvatarView: View {
    private let input: ViewInput
    private let size: CGFloat?
    private let muted: Bool
    private let label: String
    private let handle: AvatarHandle?
    private let onStateChange: ((String?) -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var inHierarchy = true
    @State private var inScrollViewport = true
    @State private var pointer: SIMD2<Double>?
    @State private var renderer: Result<AvatarMetalRenderer, Error>?

    public init(character: AvatarCharacter, state: String? = nil, clip: String? = nil,
                face: String? = nil, library: AvatarLibrary = .init(), pose: AvatarFreePose? = nil,
                paused: Bool = false, lookAt: SIMD2<Double>? = nil, followPointer: Bool = false,
                emphasis: Bool = false, muted: Bool = false, settleAfterMs: Double = 0,
                seed: UInt32? = nil, size: CGFloat? = 240, accessibilityLabel: String = "Avatar",
                handle: AvatarHandle? = nil, onStateChange: ((String?) -> Void)? = nil) {
        input = ViewInput(character: character, state: state, clip: clip, face: face, library: library,
                          pose: pose, paused: paused, lookAt: lookAt, followPointer: followPointer,
                          emphasis: emphasis, settleAfterMs: settleAfterMs,
                          seed: seed ?? seedOfName(character.name ?? "avatar"))
        self.size = size
        self.muted = muted
        label = accessibilityLabel
        self.handle = handle
        self.onStateChange = onStateChange
    }

    public var body: some View {
        GeometryReader { proxy in
            let width = min(proxy.size.width, proxy.size.height)
            let margin = 1.65
            switch renderer {
            case .success(let renderer):
                var current = input
                let _ = configure(&current, points: width)
                MetalSurface(input: current, renderer: renderer, margin: margin, handle: handle, callback: onStateChange)
                    .frame(width: width * margin, height: width * margin)
                    .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
                    .allowsHitTesting(false)
                    .saturation(muted ? 0 : 1)
                    .animation(.easeInOut(duration: 0.3), value: muted)
                    .overlay {
                        if input.followPointer, input.lookAt == nil {
                            Color.clear
                                .contentShape(Rectangle())
                                .onContinuousHover { phase in
                                    switch phase {
                                    case .active(let p):
                                        guard width > 0 else { return }
                                        pointer = SIMD2((p.x - proxy.size.width / 2) / (width * 2),
                                                        (proxy.size.height / 2 - p.y) / (width * 2))
                                    case .ended:
                                        pointer = nil
                                    }
                                }
                        }
                    }
            case .failure:
                Image(systemName: "person.crop.circle")
                    .resizable()
                    .scaledToFit()
                    .padding(width * 0.16)
                    .frame(width: proxy.size.width, height: proxy.size.height)
            case nil:
                Color.clear
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(label))
        .accessibilityAddTraits(.isImage)
        .onAppear { inHierarchy = true }
        .onDisappear { inHierarchy = false }
        .onScrollVisibilityChange(threshold: 0.02) { inScrollViewport = $0 }
        .task {
            if renderer == nil { renderer = Result { try AvatarMetalRenderer() } }
        }
    }

    private func configure(_ value: inout ViewInput, points: CGFloat) {
        value.compact = points < 48
        value.visible = inHierarchy && inScrollViewport && scenePhase == .active
        value.reduced = reducedMotion
        value.pointer = value.followPointer && value.lookAt == nil ? pointer : nil
    }
}

/// Validates an exported file once and captures the character for subsequent views.
public func createAvatar(_ data: Data) throws -> AvatarCharacter {
    try characterOf(data)
}

private struct ViewInput: Equatable {
    var character: AvatarCharacter
    var state: String?
    var clip: String?
    var face: String?
    var library: AvatarLibrary
    var pose: AvatarFreePose?
    var paused: Bool
    var lookAt: SIMD2<Double>?
    var followPointer: Bool
    var emphasis: Bool
    var settleAfterMs: Double
    var seed: UInt32
    var compact = false
    var visible = true
    var reduced = false
    var pointer: SIMD2<Double>?
}

@MainActor
fileprivate final class ViewPlayback: NSObject, MTKViewDelegate {
    private let renderer: AvatarMetalRenderer
    private let margin: Double
    private var input: ViewInput
    private var engine: AvatarEngine
    private var last: Double?
    private var askedAt: Double = CACurrentMediaTime()
    private var drawn = false
    private var reported: String?
    private var callback: ((String?) -> Void)?
    private weak var view: MTKView?
    private weak var handle: AvatarHandle?

    init(renderer: AvatarMetalRenderer, input: ViewInput, margin: Double) {
        self.renderer = renderer
        self.margin = margin
        self.input = input
        engine = AvatarEngine(seed: input.seed, compact: input.compact, library: input.library)
        super.init()
        apply(input, before: nil)
        reported = engine.state
    }

    func attach(_ view: MTKView) {
        self.view = view
        refresh()
    }

    func update(input value: ViewInput, handle: AvatarHandle?, callback: ((String?) -> Void)?) {
        self.callback = callback
        if handle !== self.handle {
            if self.handle?.playback === self { self.handle?.playback = nil }
            self.handle = handle
            handle?.playback = self
        }
        let previous = input
        guard previous != value else { return }
        input = value
        if previous.seed != value.seed || previous.character != value.character {
            engine = AvatarEngine(seed: value.seed, compact: value.compact, library: value.library)
            apply(value, before: nil)
        } else {
            apply(value, before: previous)
        }
        reportState()
        refresh()
    }

    func poke(_ gesture: AvatarGesture, turns: Int) {
        guard !input.reduced else { return }
        engine.poke(gesture, turns: turns)
        refresh()
    }

    private func apply(_ value: ViewInput, before previous: ViewInput?) {
        engine.compact = value.compact
        engine.setLibrary(value.library)
        if previous == nil || previous?.state != value.state || previous?.clip != value.clip {
            if let state = value.state { engine.setState(state) }
            else if let clip = value.clip { engine.playClip(clip) }
            else { engine.setState("idle") }
            if engine.clip == nil { engine.setState("idle") }
        }
        engine.setFace(value.face)
        engine.setEmphasis(value.emphasis)
        engine.setPose(value.pose)
        if let target = value.lookAt {
            engine.setLookAt(target)
        } else {
            engine.setGazeAlways(value.followPointer)
            engine.setGaze(value.pointer)
        }
        if value.paused { engine.pause() } else { engine.resume() }
    }

    private func refresh() {
        last = nil
        askedAt = CACurrentMediaTime()
        guard let view else { return }
        if !input.visible {
            view.isPaused = true
        } else if input.reduced {
            view.isPaused = true
            if !input.paused {
                for _ in 0..<16 { engine.advance(1.0 / 40) }
                reportState()
            }
            view.draw()
        } else if input.paused {
            view.isPaused = true
            if !drawn { view.draw() }
        } else {
            view.isPaused = false
        }
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        if view.isPaused, input.visible {
            Task { @MainActor [weak self] in self?.view?.draw() }
        }
    }

    func draw(in view: MTKView) {
        guard input.visible, let drawable = view.currentDrawable else { return }
        let now = CACurrentMediaTime()
        if !input.paused, !input.reduced, let last { engine.advance(now - last) }
        last = now
        let frame = engine.frame
        let snapshot = renderCharacterFrame(input.character, frame)
        guard let commands = try? renderer.encode(snapshot, into: drawable.texture,
                                                  options: .init(viewportScale: margin)) else { return }
        commands.present(drawable)
        commands.commit()
        drawn = true
        reportState()
        if input.settleAfterMs > 0, (now - askedAt) * 1_000 >= input.settleAfterMs,
           frame.pose.lids < 0.001, engine.isAtRest {
            view.isPaused = true
            last = nil
        }
    }

    private func reportState() {
        guard reported != engine.state else { return }
        let state = engine.state
        reported = state
        if let callback { Task { @MainActor in callback(state) } }
    }
}

private struct MetalSurface {
    let input: ViewInput
    let renderer: AvatarMetalRenderer
    let margin: Double
    let handle: AvatarHandle?
    let callback: ((String?) -> Void)?

    @MainActor
    func makeCoordinator() -> ViewPlayback {
        ViewPlayback(renderer: renderer, input: input, margin: margin)
    }

    @MainActor
    private func makeSurface(_ coordinator: ViewPlayback) -> MTKView {
        let view = MTKView(frame: .zero, device: renderer.device)
        view.isPaused = true
        view.framebufferOnly = false
        view.colorPixelFormat = .bgra8Unorm
        view.clearColor = MTLClearColorMake(0, 0, 0, 0)
        #if os(macOS)
        view.colorspace = CGColorSpace(name: CGColorSpace.sRGB)
        view.layer?.isOpaque = false
        #else
        view.isOpaque = false
        #endif
        view.preferredFramesPerSecond = 30
        view.delegate = coordinator
        coordinator.attach(view)
        return view
    }
}

#if os(macOS)
extension MetalSurface: NSViewRepresentable {
    func makeNSView(context: Context) -> MTKView { makeSurface(context.coordinator) }
    func updateNSView(_ view: MTKView, context: Context) {
        context.coordinator.update(input: input, handle: handle, callback: callback)
    }
}
#elseif os(iOS)
extension MetalSurface: UIViewRepresentable {
    func makeUIView(context: Context) -> MTKView { makeSurface(context.coordinator) }
    func updateUIView(_ view: MTKView, context: Context) {
        context.coordinator.update(input: input, handle: handle, callback: callback)
    }
}
#endif
