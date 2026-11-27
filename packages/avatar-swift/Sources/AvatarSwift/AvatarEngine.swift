import Foundation
import simd

/// An immutable frame. Angles are degrees. The optional quaternion uses w, x, y, z.
public struct AvatarFrame: Equatable, Sendable {
    public var pose: AvatarPose
    public var orientation: SIMD4<Double>?
    public var squashAnchor: Double
    public var eyeScales: SIMD2<Double>
    public var spinner: AvatarSpinnerFrame?
    public var face: String { presentation.name }
    public var smile: Double { presentation.smile }
    var presentation: FacePresentation
}

/// A deterministic, renderer-independent player. The caller supplies elapsed seconds.
public struct AvatarEngine: Sendable {
    public private(set) var state: String?
    public var clip: String? { playback?.definition.name }
    public private(set) var clipTime = 0.0
    public private(set) var isPaused = false
    public private(set) var library: AvatarLibrary
    public var compact: Bool
    public var handover = true

    private static let joinDuration = 0.35
    private static let joinEasing = [0.4, 0, 0.2, 1]

    private var playback: PlaybackClip?
    private var base = AvatarPose()
    private var join: ClipJoin?
    private var stateTime = 0.0
    private var orderedIndex = 0
    private var firstClip = true
    private var lastClip: String?
    private var bags: [[String]: [String]] = [:]
    private var random: AvatarRandom
    private var faceOverride: String?
    private var emphasis = false
    private var faceMotion: FaceMotion
    private var manual: AvatarFreePose?
    private var releasing: PoseRelease?
    private var gestures: [GestureMotion] = []
    private var gaze = GazeMotion()
    private var spinner = SpinnerMotion()

    public init(seed: UInt32 = 1, compact: Bool = false, library: AvatarLibrary = .init()) {
        self.random = .init(seed: seed)
        self.compact = compact
        self.library = library
        let neutral = FacePresentation.resolve("neutral", library: library)
        faceMotion = .init(from: neutral, to: neutral, elapsed: 1)
    }

    public func stateDefinition(_ name: String) -> AvatarState? {
        library.states[name] ?? AvatarCatalogue.states[name]
    }

    public func clipDefinition(_ name: String) -> AvatarClip? {
        library.clips[name] ?? AvatarCatalogue.clips[name]
    }

    public mutating func setLibrary(_ value: AvatarLibrary) {
        guard value != library else { return }
        library = value
        bags.removeAll()
        updateFace()
    }

    /// Returns false for a name this engine does not know.
    @discardableResult
    public mutating func setState(_ requested: String) -> Bool {
        let name = library.states[requested] == nil ? AvatarCatalogue.resolveStateName(requested) : requested
        guard let definition = stateDefinition(name) else { return false }
        state = name
        stateTime = 0
        orderedIndex = 0
        setMorph(definition.morph)
        chooseClip()
        updateFace()
        return true
    }

    @discardableResult
    public mutating func playClip(_ name: String, phase: Double = 0, cut: Bool = false) -> Bool {
        guard let clip = clipDefinition(name) else { return false }
        return playClip(clip, phase: phase, cut: cut)
    }

    @discardableResult
    public mutating func playClip(_ clip: AvatarClip, phase: Double = 0, cut: Bool = false) -> Bool {
        guard clip.problem == nil else { return false }
        state = nil
        spinner.set(nil)
        firstClip = false
        start(clip, phase: phase, cut: cut)
        updateFace()
        return true
    }

    public mutating func setMorph(_ mode: String?) {
        spinner.set(mode.flatMap { AvatarSpinnerPattern.modes[$0] ?? AvatarSpinnerPattern(rawValue: $0) })
    }

    public mutating func setFace(_ face: String?) {
        guard face != faceOverride else { return }
        faceOverride = face
        updateFace()
    }

    public mutating func setEmphasis(_ on: Bool) {
        guard emphasis != on else { return }
        emphasis = on
        updateFace()
    }

    public mutating func pause() { isPaused = true }
    public mutating func resume() { isPaused = false }

    public mutating func stop() {
        state = nil
        playback = nil
        clipTime = 0
        join = nil
        base = .init()
        gestures = []
        manual = nil
        releasing = nil
        spinner = .init()
        updateFace(cut: true)
    }

    public mutating func seek(_ seconds: Double) {
        guard let playback, seconds.isFinite else { return }
        join = nil
        clipTime = clamp(seconds, 0, playback.definition.duration)
        base = playback.pose(at: clipTime, zoom: base.zoom)
        updateFace(cut: true)
    }

    public mutating func setPose(_ pose: AvatarFreePose?) {
        guard pose != manual else { return }
        if let pose {
            manual = pose
            releasing = nil
        } else {
            releasePose()
        }
    }

    public mutating func releasePose() {
        guard let manual else { return }
        let rotation = manual.rotation ?? base.rotation
        let orientation = manual.orientation.map { normalizedQuaternion($0) } ?? rotationQuaternion(rotation)
        releasing = .init(orientation: orientation, position: manual.position ?? base.position,
                          zoom: manual.zoom ?? base.zoom)
        self.manual = nil
    }

    public mutating func setGaze(_ target: SIMD2<Double>?) { gaze.set(target) }
    public mutating func setGazeAlways(_ on: Bool) { gaze.overClip = on ? 0.55 : 0 }

    public mutating func setLookAt(_ target: SIMD2<Double>?) {
        if target != nil { gaze.overClip = 0.85 }
        gaze.set(target)
    }

    public mutating func poke(_ gesture: AvatarGesture, turns: Int = 1) {
        gestures.append(.init(name: gesture, turns: Double(max(1, turns))))
    }

    /// Describes changes that need to finish before an idle view can stop scheduling frames.
    public var isAtRest: Bool {
        gestures.isEmpty && releasing == nil && join == nil && gaze.settled
            && faceMotion.elapsed >= faceMotion.duration && spinner.settled
    }

    public mutating func advance(_ seconds: Double) {
        guard !isPaused, seconds.isFinite, seconds > 0 else { return }
        let step = min(0.1, seconds)
        spinner.advance(step)
        faceMotion.elapsed += step
        releasing?.time += step
        if let releasing, releasing.time >= Self.joinDuration { self.releasing = nil }
        for index in gestures.indices { gestures[index].time += step }
        gestures.removeAll { $0.time >= $0.duration }
        gaze.advance(step)

        guard manual == nil else { return }
        if let currentState = state, let definition = stateDefinition(currentState) {
            stateTime += step
            if let hold = definition.holdSeconds, let next = definition.next, stateTime >= hold {
                if !setState(handover ? next : currentState) { stateTime = 0 }
            }
        }
        guard let playback else { return }
        let rate = 1 - spinner.amount
        if var pending = join {
            pending.elapsed += step * rate
            let t = clipEaseAt(Self.joinEasing, pending.elapsed / Self.joinDuration)
            base = .blend(pending.from, pending.to, t)
            if pending.elapsed < Self.joinDuration {
                join = pending
                return
            }
            clipTime = pending.targetTime
            join = nil
        } else {
            clipTime += step * rate
        }
        if clipTime >= playback.definition.duration {
            clipTime = clipTime.truncatingRemainder(dividingBy: playback.definition.duration)
            if let name = state, let definition = stateDefinition(name) {
                if definition.ordered { orderedIndex += 1 }
                if definition.ordered, orderedIndex >= list(for: definition).count, let next = definition.next {
                    if !setState(handover ? next : name) { orderedIndex = 0 }
                } else {
                    chooseClip()
                }
            }
        }
        if join == nil, let current = self.playback {
            base = current.pose(at: clipTime, zoom: base.zoom)
        }
        updateFace()
    }

    public var frame: AvatarFrame {
        var pose = base
        var orientation: SIMD4<Double>?
        let turning = spinner.frame
        if let turning {
            let remaining = 1 - turning.amount
            pose.position *= remaining
            pose.squash = .one + (pose.squash - .one) * remaining
            pose.rotation *= remaining
        }
        if let manual {
            pose.position = manual.position ?? pose.position
            pose.zoom = manual.zoom ?? pose.zoom
            pose.rotation = manual.rotation ?? pose.rotation
            if let given = manual.orientation {
                orientation = given
                pose.rotation = .zero
            }
        } else if let release = releasing {
            let t = clipEaseAt(Self.joinEasing, release.time / Self.joinDuration)
            let angle = simd_slerp(release.orientation, rotationQuaternion(pose.rotation), t)
            orientation = SIMD4(angle.real, angle.imag.x, angle.imag.y, angle.imag.z)
            pose.rotation = .zero
            pose.position = release.position + (pose.position - release.position) * t
            pose.zoom = interpolate(release.zoom, pose.zoom, t)
        }

        if turning == nil || turning!.amount < 0.5 {
            let weight = gaze.hold * (playback == nil ? 1 : gaze.weight)
            pose.rotation += SIMD3(-14 * gaze.at.y, 18 * gaze.at.x, 0) * weight
            pose.position += SIMD2(0.03 * gaze.at.x, 0.024 * gaze.at.y) * weight
        }
        for gesture in gestures { gesture.apply(to: &pose) }
        pose.rotation.y += spinner.spin.at.truncatingRemainder(dividingBy: 360)
        let shown = faceMotion.frame
        pose.lids = max(shown.blinks ? pose.lids : 0, faceMotion.swapLids)
        var scales = SIMD2<Double>.one
        if shown.name == "inspecting" {
            let inspect = playback?.definition.inspect
            let lean = clamp(inspect?.follow == false ? (inspect?.bias ?? 0) : pose.rotation.y / 22, -1, 1)
            scales = SIMD2(1 - 0.27 * lean, 1 + 0.27 * lean)
        }
        return .init(pose: pose, orientation: orientation, squashAnchor: playback?.definition.squashAnchor ?? 0,
                     eyeScales: scales, spinner: turning, presentation: shown)
    }

    private func list(for definition: AvatarState) -> [String] {
        let choices = compact ? definition.compactClips ?? definition.clips : definition.clips
        return choices.filter { clipDefinition($0)?.problem == nil && clipDefinition($0) != nil }
    }

    private mutating func chooseClip() {
        guard let state, let definition = stateDefinition(state) else { return }
        let choices = list(for: definition)
        guard !choices.isEmpty else { return }
        let name: String
        if definition.ordered {
            name = choices[min(choices.count - 1, orderedIndex)]
        } else {
            var bag = bags[choices] ?? []
            if bag.isEmpty {
                bag = choices
                for index in bag.indices.dropFirst().reversed() {
                    bag.swapAt(index, Int(random.next() * Double(index + 1)))
                }
                if let different = bag.firstIndex(where: { $0 != lastClip }), different > 0 {
                    bag.swapAt(0, different)
                }
            }
            name = bag.removeFirst()
            bags[choices] = bag
        }
        let phase = firstClip && !definition.ordered ? random.next() : 0
        firstClip = false
        lastClip = name
        if playback?.definition.name != name, let clip = clipDefinition(name) { start(clip, phase: phase, cut: false) }
    }

    private mutating func start(_ clip: AvatarClip, phase: Double, cut: Bool) {
        let prepared = PlaybackClip(clip)
        let phase = phase.isFinite ? clamp(phase) : 0
        if !cut, let previous = playback, previous.definition.name != clip.name {
            let targetTime = phase > 0 ? phase * clip.duration : prepared.restTime
            var rest = prepared.pose(at: targetTime, zoom: AvatarPose.restZoom)
            for axis in 0..<3 {
                rest.rotation[axis] += 360 * ((base.rotation[axis] - rest.rotation[axis]) / 360).rounded()
            }
            join = .init(from: base, to: rest, targetTime: targetTime)
            clipTime = targetTime
        } else {
            join = nil
            clipTime = phase * clip.duration
            base = prepared.pose(at: clipTime, zoom: base.zoom)
        }
        playback = prepared
    }

    private mutating func updateFace(cut: Bool = false) {
        let currentState = state.flatMap { stateDefinition($0) }
        let clipCue = playback?.face(at: clipTime) ?? (join == nil ? nil : playback?.faces.first)
        let requested = faceOverride ?? currentState?.face ?? (emphasis && currentState != nil ? "surprised" : nil)
            ?? clipCue?.v ?? "neutral"
        let face = FacePresentation.resolve(requested, library: library)
        guard face != faceMotion.to || cut else { return }
        let shouldCut = cut || (clipCue?.cut == true && faceOverride == nil && currentState?.face == nil)
        faceMotion = .init(from: faceMotion.frame, to: face, elapsed: shouldCut ? 1 : 0)
    }
}

func rotationQuaternion(_ angles: SIMD3<Double>) -> simd_quatd {
    let x = simd_quatd(angle: radians(angles.x), axis: SIMD3(1, 0, 0))
    let y = simd_quatd(angle: radians(angles.y), axis: SIMD3(0, 1, 0))
    let z = simd_quatd(angle: radians(angles.z), axis: SIMD3(0, 0, 1))
    return z * y * x
}

func normalizedQuaternion(_ value: SIMD4<Double>) -> simd_quatd {
    let size = simd_length(value)
    guard size.isFinite, size > 1e-10 else { return rotationQuaternion(.zero) }
    return simd_quatd(real: value.x / size, imag: SIMD3(value.y, value.z, value.w) / size)
}

private struct ClipJoin: Sendable {
    let from: AvatarPose
    let to: AvatarPose
    let targetTime: Double
    var elapsed = 0.0
}

private struct PoseRelease: Sendable {
    let orientation: simd_quatd
    let position: SIMD2<Double>
    let zoom: Double
    var time = 0.0
}

private struct FaceMotion: Sendable {
    let from: FacePresentation
    let to: FacePresentation
    var elapsed: Double

    var swaps: Bool {
        if from.name == to.name { return false }
        if case .builtin = from.artwork, case .builtin = to.artwork { return false }
        return true
    }

    var duration: Double { swaps ? 0.30 : 0.28 }

    var frame: FacePresentation {
        if elapsed >= duration { return to }
        if swaps { return elapsed / duration < 0.45 ? from : to }
        guard case .builtin(let a) = from.artwork, case .builtin(let b) = to.artwork else { return to }
        let t = clipEaseAt([0.4, 0.06, 0.18, 1], elapsed / duration)
        return .init(name: to.name, artwork: .builtin(.mix(a, b, t)), smile: interpolate(from.smile, to.smile, t))
    }

    var swapLids: Double {
        guard swaps, elapsed < duration else { return 0 }
        let t = elapsed / duration
        return smooth(t < 0.45 ? t / 0.45 : (1 - t) / 0.55)
    }
}

private struct GazeMotion: Sendable {
    var target: SIMD2<Double>?
    var at = SIMD2<Double>.zero
    var hold = 0.0
    var overClip = 0.0
    var weight = 0.0

    mutating func set(_ point: SIMD2<Double>?) {
        let point = point.flatMap { value -> SIMD2<Double>? in
            guard value.x.isFinite, value.y.isFinite else { return nil }
            return SIMD2(clamp(value.x, -1, 1), clamp(value.y, -1, 1))
        }
        if hold == 0, let point { at = point }
        target = point
    }

    mutating func advance(_ step: Double) {
        let share = 1 - pow(0.86, step * 60)
        hold = interpolate(hold, target == nil ? 0 : 1, share)
        weight = interpolate(weight, overClip, share)
        if let target { at += (target - at) * share }
        if hold < 0.001, target == nil { hold = 0 }
        if hold > 0.999, target != nil { hold = 1 }
    }

    var settled: Bool {
        let wanted = target == nil ? 0.0 : 1.0
        return abs(hold - wanted) < 0.002 && abs(weight - overClip) < 0.005
            && (target.map { simd_length($0 - at) < 0.005 } ?? true)
    }
}

private struct GestureMotion: Sendable {
    let name: AvatarGesture
    let turns: Double
    var time = 0.0

    var duration: Double {
        switch name {
        case .nod: 0.5
        case .bounce: 0.62
        case .spin: 0.9 + 0.4 * (turns - 1)
        }
    }

    func apply(to pose: inout AvatarPose) {
        let t = clamp(time / duration)
        switch name {
        case .nod:
            pose.rotation.x += 16 * pow(sin(.pi * t), 2)
        case .spin:
            pose.rotation.y += 180 * turns * (1 - cos(.pi * t))
        case .bounce:
            func swell(_ from: Double, _ to: Double) -> Double {
                guard t > from, t < to else { return 0 }
                return pow(sin(.pi * (t - from) / (to - from)), 2)
            }
            let crouch = swell(0, 0.18) + swell(0.82, 1)
            let flight = swell(0.18, 0.82)
            pose.position.y += 0.3 * sin(.pi * clamp((t - 0.14) / 0.72))
            pose.squash *= SIMD2(1 + 0.08 * crouch - 0.04 * flight, 1 - 0.1 * crouch + 0.06 * flight)
        }
    }
}

private struct AvatarSpring: Sendable {
    var at = 0.0
    var speed = 0.0

    mutating func pull(to target: Double, stiffness: Double, step: Double) {
        let steps = max(1, Int(ceil(step * 120)))
        let slot = step / Double(steps)
        for _ in 0..<steps {
            speed += (-2 * stiffness * speed - stiffness * stiffness * (at - target)) * slot
            at += speed * slot
        }
    }
}

private struct SpinnerMotion: Sendable {
    private struct Shown: Sendable {
        let pattern: AvatarSpinnerPattern
        var time = 0.0
        var shot = 0.0
    }

    private var wanted: AvatarSpinnerPattern?
    private var current: Shown?
    private var leaving: Shown?
    private var fullness = AvatarSpring()
    private var swap = AvatarSpring(at: 1)
    private var showing = false
    private var spinTarget = 0.0
    private var way = 1.0
    private var random = AvatarRandom(seed: 2_654_435_769)
    var spin = AvatarSpring()
    var amount: Double { clamp(fullness.at) }

    mutating func set(_ pattern: AvatarSpinnerPattern?) {
        wanted = pattern
        guard let pattern, pattern != current?.pattern else {
            current?.shot = 0
            return
        }
        leaving = amount > 0.02 ? current : nil
        swap = .init(at: leaving == nil ? 1 : 0)
        current = Shown(pattern: pattern)
    }

    mutating func advance(_ step: Double) {
        current?.time += step
        leaving?.time += step
        var displays = current != nil && current?.pattern == wanted
        if displays, var shown = current {
            shown.shot += step
            if let length = shown.pattern.shotSeconds {
                if shown.shot >= length + 1.5 { shown.shot = 0 }
                displays = shown.shot < length
            }
            current = shown
        }
        if showing != displays {
            showing = displays
            if showing { way = random.next() < 0.5 ? 1 : -1 }
            spinTarget += 180 * way
        }
        fullness.pull(to: showing ? 1 : 0, stiffness: 14, step: step)
        swap.pull(to: 1, stiffness: 11, step: step)
        spin.pull(to: spinTarget, stiffness: 14, step: step)
        if swap.at > 0.996 { leaving = nil }
        if !showing, wanted == nil, amount < 0.001 {
            current = nil
            leaving = nil
            fullness = .init()
        }
    }

    var settled: Bool { abs(amount - (showing ? 1 : 0)) < 0.005 && abs(spin.at - spinTarget) < 0.5 && leaving == nil }

    var frame: AvatarSpinnerFrame? {
        guard let current, amount > 0.0005 else { return nil }
        let share = leaving == nil ? 1 : clamp(swap.at)
        var art = drawSpinner(current.pattern, weight: amount * share, time: current.time, shot: current.shot)
        if let leaving {
            let old = drawSpinner(leaving.pattern, weight: amount * (1 - share), time: leaving.time, shot: leaving.shot)
            art.marks = old.marks + art.marks
            art.core.radius = interpolate(old.core.radius, art.core.radius, share)
            art.core.position += old.core.position
            art.core.turn += old.core.turn
            art.core.opacity = interpolate(old.core.opacity, art.core.opacity, share)
        }
        let t = clamp(amount / 0.62)
        let round = t < 0.5 ? 4 * t * t * t : 1 - pow(2 - 2 * t, 3) / 2
        return .init(pattern: current.pattern, amount: amount, round: round, core: art.core, marks: art.marks)
    }
}
