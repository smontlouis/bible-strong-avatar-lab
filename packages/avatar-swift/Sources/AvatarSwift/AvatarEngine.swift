import Foundation
import simd

/// An immutable frame. Angles are degrees. The optional quaternion uses w, x, y, z, counted as
/// avatar-core counts a clip's turn (`clipOrientation`).
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

// The engine is avatar-core's, function for function: `player.ts` plays one clip at a time and
// joins it to the next, `engine.ts` keeps around it the state that draws clips, the spinner the
// body turns into, gestures, the gaze and a pose set by hand. The order of operations, the
// constants and the draws of the seeded generator are those of avatar-core, so that the same
// seed gives the same frames (see `ParityTests.swift`).

private let restZoom = AvatarPose.restZoom
private let minZoom = 0.25
private let maxZoom = 2.5
private let minEyeSize = 0.2
private let maxEyeSize = 3.0
/// How long a join between two clips takes, in seconds.
private let joinSeconds = 0.35
private let joinEase = [0.4, 0, 0.2, 1]
/// How long one face takes to turn into another, in seconds.
private let faceSeconds = 0.28
private let faceEase = [0.4, 0.06, 0.18, 1]
/// How long a face takes to give way to a drawn one, or a drawn one to another: a blink.
private let faceSwapSeconds = 0.3
private let swapShutAt = 0.45
private let swapEase = [0.42, 0, 0.58, 1]
private let blinkSeconds = 0.26
private let blinkShutAt = 0.45
private let blinkEase = [0.42, 0.0, 0.58, 1.0]
private let maxStepSeconds = 0.1
private let openLids = 1e-4
private let springStep = 1.0 / 120
private let gazeCatchUp = 0.14
private let gazeOverClip = 0.55
private let lookOverClip = 0.85
private let roundBy = 0.62
private let inspectTurn = 20.0
private let spinnerPauseSeconds = 1.5

/// JavaScript's `Math.round`: halves go up, also below zero.
private func jsRound(_ value: Double) -> Double { (value + 0.5).rounded(.down) }

// MARK: - Clips made ready to play

struct PlaybackClip: Sendable {
    let definition: AvatarClip
    let lids: [AvatarKeyframe]
    let faces: [AvatarFaceKeyframe]
    var restTime: Double { definition.workArea?.start ?? 0 }

    init(_ clip: AvatarClip) {
        definition = clip
        var lidKeys = clip.tracks.lids ?? []
        var faceKeys: [AvatarFaceKeyframe] = []
        for key in clip.tracks.expression ?? [] {
            if key.v == "blink" {
                lidKeys.append(.init(t: key.t, v: [0], ease: blinkEase))
                lidKeys.append(.init(t: key.t + blinkSeconds * blinkShutAt, v: [1], ease: blinkEase))
                lidKeys.append(.init(t: key.t + blinkSeconds, v: [0], ease: blinkEase))
            } else {
                faceKeys.append(key)
            }
        }
        // A stable sort, as JavaScript's: keys at the same time keep their order.
        lids = lidKeys.enumerated().sorted { ($0.element.t, $0.offset) < ($1.element.t, $1.offset) }.map(\.element)
        faces = faceKeys.enumerated().sorted { ($0.element.t, $0.offset) < ($1.element.t, $1.offset) }.map(\.element)
    }

    /// What the clip asks of the body at a time. Without a zoom track, the zoom stays as it was.
    func pose(at time: Double, zoom: Double) -> AvatarPose {
        let track = definition.tracks
        func values(_ keys: [AvatarKeyframe]?, _ fallback: [Double]) -> [Double] {
            guard let sampled = sampleClipTrack(keys ?? [], at: time), sampled.count == fallback.count else {
                return fallback
            }
            return sampled
        }
        let position = values(track.position, [0, 0])
        let rotation = values(track.rotation, [0, 0, 0])
        let squash = values(track.squash, [1, 1])
        let scale: Double = (track.scale ?? []).isEmpty ? zoom : clamp(values(track.scale, [zoom])[0], minZoom, maxZoom)
        let lid: Double = lids.isEmpty ? 0 : clamp(values(lids, [0])[0])
        let opacity: Double = clamp(values(track.opacity, [1])[0])
        let eyeSize: Double = clamp(values(track.eyeSize, [1])[0], minEyeSize, maxEyeSize)
        return AvatarPose(position: SIMD2(position[0], position[1]),
                          rotation: SIMD3(rotation[0], rotation[1], rotation[2]),
                          squash: SIMD2(squash[0], squash[1]), zoom: scale,
                          lids: lid, opacity: opacity, eyeSize: eyeSize)
    }

    /// The pose of rest: where a join to this clip leads.
    var restPose: AvatarPose { pose(at: restTime, zoom: restZoom) }

    /// The face the clip shows at a time: the last it asked for, `neutral` before the first.
    func face(at time: Double) -> String {
        var face = "neutral"
        for event in faces {
            if event.t > time { break }
            face = event.v
        }
        return face
    }

    /// The face a join to the clip aims at: the one of its pose of rest, else the first it asks for.
    var restFace: String {
        guard let first = faces.first else { return "neutral" }
        return first.t > restTime ? first.v : face(at: restTime)
    }
}

// MARK: - Quaternions, w x y z, as avatar-core turns a frame

private func normalizeQuaternion(_ q: SIMD4<Double>) -> SIMD4<Double> {
    let sum: Double = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w
    let length: Double = sum.squareRoot()
    let size: Double = length == 0 ? 1 : length
    return q / size
}

private func multiplyQuaternions(_ a: SIMD4<Double>, _ b: SIMD4<Double>) -> SIMD4<Double> {
    let w: Double = a.x * b.x - a.y * b.y - a.z * b.z - a.w * b.w
    let x: Double = a.x * b.y + a.y * b.x + a.z * b.w - a.w * b.z
    let y: Double = a.x * b.z - a.y * b.w + a.z * b.x + a.w * b.y
    let z: Double = a.x * b.w + a.y * b.z - a.z * b.y + a.w * b.x
    return normalizeQuaternion(SIMD4(w, x, y, z))
}

private func quaternionFromAxisAngle(_ axis: SIMD3<Double>, _ angle: Double) -> SIMD4<Double> {
    let half = angle / 2
    let sine = sin(half)
    return normalizeQuaternion(SIMD4(cos(half), axis.x * sine, axis.y * sine, axis.z * sine))
}

/// avatar-core's `clipOrientation`: the x turn first, then y, then z, x and z counted the other way.
func clipOrientation(_ rotation: SIMD3<Double>) -> SIMD4<Double> {
    let unit = Double.pi / 180
    let z = quaternionFromAxisAngle(SIMD3(0, 0, 1), -rotation.z * unit)
    let y = quaternionFromAxisAngle(SIMD3(0, 1, 0), rotation.y * unit)
    let x = quaternionFromAxisAngle(SIMD3(1, 0, 0), -rotation.x * unit)
    return multiplyQuaternions(z, multiplyQuaternions(y, x))
}

private func frameOrientation(_ rotation: SIMD3<Double>, _ orientation: SIMD4<Double>?) -> SIMD4<Double> {
    guard let orientation else { return clipOrientation(rotation) }
    return multiplyQuaternions(clipOrientation(rotation), orientation)
}

private func slerpQuaternion(_ start: SIMD4<Double>, _ end: SIMD4<Double>, _ progress: Double) -> SIMD4<Double> {
    var target = end
    var dot: Double = simd_dot(start, target)
    if dot < 0 {
        target = -target
        dot = -dot
    }
    if dot > 0.9995 {
        let towards: SIMD4<Double> = target - start
        let moved: SIMD4<Double> = towards * progress
        return normalizeQuaternion(start + moved)
    }
    let angle = acos(clamp(dot, -1, 1))
    let sine = sin(angle)
    let startWeight: Double = sin((1 - progress) * angle) / sine
    let targetWeight: Double = sin(progress * angle) / sine
    let left: SIMD4<Double> = start * startWeight
    let right: SIMD4<Double> = target * targetWeight
    return normalizeQuaternion(left + right)
}

/// A turn in Swift's world (`rotationQuaternion`) for a turn counted as avatar-core counts it.
func worldQuaternion(_ q: SIMD4<Double>) -> simd_quatd {
    normalizedQuaternion(SIMD4(q.x, -q.y, q.z, -q.w))
}

// MARK: - The engine

/// A deterministic, renderer-independent player. The caller supplies elapsed seconds.
public struct AvatarEngine: Sendable {
    public private(set) var state: String?
    public var clip: String? { player.clip?.definition.name }
    /// Seconds into the clip that plays. During a join it stays where the last clip was.
    public var clipTime: Double { player.time }
    /// Whether the clip is paused. Faces, gestures, the gaze and the spinner go on.
    public var isPaused: Bool { player.clip != nil && !player.playing }
    public private(set) var library: AvatarLibrary
    public var compact: Bool
    public var handover = true

    private var player = Player()
    private var random: AvatarRandom
    private var bags: [String: [String]] = [:]
    private var lastClip: String?
    private var index = 0
    private var stateTime = 0.0
    private var loopsSeen = 0
    private var started = false
    private var emphasis = false
    private var morph: String?
    private var morphing = Morphing()
    private var gestures: [GestureMotion] = []
    private var gaze = Gaze()
    private var manual: AvatarFreePose?
    private var release: PoseRelease?

    public init(seed: UInt32 = 1, compact: Bool = false, library: AvatarLibrary = .init()) {
        self.random = .init(seed: seed)
        self.compact = compact
        self.library = library
    }

    public func stateDefinition(_ name: String) -> AvatarState? {
        library.states[name] ?? AvatarCatalogue.states[name]
    }

    public func clipDefinition(_ name: String) -> AvatarClip? {
        library.clips[name] ?? AvatarCatalogue.clips[name]
    }

    /// Other clips, states and faces of its own. What plays goes on, drawn from the new ones next.
    public mutating func setLibrary(_ value: AvatarLibrary) {
        guard value != library else { return }
        library = value
    }

    /// Returns false for a name this engine does not know.
    @discardableResult
    public mutating func setState(_ requested: String) -> Bool {
        let name = library.states[requested] == nil ? AvatarCatalogue.resolveStateName(requested) : requested
        guard let definition = stateDefinition(name) else { return false }
        state = name
        setMorph(definition.morph)
        player.heldFace = definition.face ?? (emphasis ? "surprised" : nil)
        index = 0
        stateTime = 0
        pick()
        return true
    }

    @discardableResult
    public mutating func playClip(_ name: String, phase: Double = 0, cut: Bool = false) -> Bool {
        guard let clip = clipDefinition(name) else { return false }
        return playClip(clip, phase: phase, cut: cut)
    }

    /// Play one clip, outside any state.
    @discardableResult
    public mutating func playClip(_ clip: AvatarClip, phase: Double = 0, cut: Bool = false) -> Bool {
        guard clip.problem == nil else { return false }
        let phase = phase.isFinite ? phase : 0
        state = nil
        setMorph(nil)
        player.heldFace = nil
        started = true
        player.play(PlaybackClip(clip), phase: phase, cut: cut)
        loopsSeen = player.loopCount
        return true
    }

    /// Ask the body to turn into a spinner, by the name a state gives it, or `nil` to come back.
    public mutating func setMorph(_ mode: String?) {
        morph = mode
        let pattern = mode.flatMap { AvatarSpinnerPattern.modes[$0] }
        guard let pattern, morphing.current?.pattern != pattern else {
            morphing.current?.shot = 0
            return
        }
        // A pattern that takes the place of another while it shows lets it leave as it comes in.
        if morphing.current != nil, morphing.amount.at > 0.02 {
            morphing.leaving = morphing.current
            morphing.swap = .init(at: 0)
        } else {
            morphing.leaving = nil
            morphing.swap = .init(at: 1)
        }
        morphing.current = .init(pattern: pattern)
    }

    /// Hold a face from outside the clip, or pass `nil` to let the clip decide again.
    public mutating func setFace(_ face: String?) {
        player.faceOverride = face
    }

    /// A state without a face of its own holds `surprised`.
    public mutating func setEmphasis(_ on: Bool) {
        emphasis = on
        if let state, let definition = stateDefinition(state), definition.face == nil {
            player.heldFace = on ? "surprised" : nil
        }
    }

    /// Pause the clip. Faces, gestures, the gaze and the spinner go on.
    public mutating func pause() { player.playing = false }

    public mutating func resume() {
        if player.clip != nil { player.playing = true }
    }

    /// Stop whatever the avatar does and leave it at rest. A pose set by hand and the gaze stay.
    public mutating func stop() {
        state = nil
        morph = nil
        morphing.current = nil
        morphing.leaving = nil
        morphing.amount = .init()
        morphing.swap = .init(at: 1)
        morphing.spin = .init()
        morphing.spinTarget = 0
        morphing.showing = false
        gestures = []
        release = nil
        player.stop(library)
    }

    /// Put the clip that plays at a time, in seconds. The state that plays, if any, goes on from there.
    public mutating func seek(_ seconds: Double) {
        guard seconds.isFinite else { return }
        player.seek(seconds)
    }

    /// Place the avatar by hand. `nil` lets go of the pose as `releasePose` does.
    public mutating func setPose(_ pose: AvatarFreePose?) {
        guard pose != manual else { return }
        if let pose {
            manual = pose
            release = nil
        } else {
            releasePose()
        }
    }

    /// Let go of a pose set by hand: the body goes back to what the clip asks in the time of a join.
    public mutating func releasePose() {
        guard manual != nil else { return }
        let frame = self.frame
        release = .init(orientation: frameOrientation(frame.pose.rotation, frame.orientation),
                        position: frame.pose.position, zoom: frame.pose.zoom)
        manual = nil
    }

    public mutating func setGaze(_ target: SIMD2<Double>?) {
        guard let target else {
            gaze.target = nil
            return
        }
        let x: Double = max(-1, min(1, target.x))
        let y: Double = max(-1, min(1, target.y))
        let clamped = SIMD2<Double>(x, y)
        // A gaze that starts from nothing starts on its target: it does not sweep in from the middle.
        if gaze.hold == 0 { gaze.at = clamped }
        gaze.target = clamped
    }

    public mutating func setGazeAlways(_ on: Bool) { gaze.overClip = on ? gazeOverClip : 0 }

    public mutating func setLookAt(_ target: SIMD2<Double>?) {
        if target != nil { gaze.overClip = lookOverClip }
        setGaze(target)
    }

    /// Lay a gesture over what plays. Gestures add up: a second one does not wait for the first.
    public mutating func poke(_ gesture: AvatarGesture, turns: Int = 1) {
        gestures.append(.init(name: gesture, turns: Double(max(1, turns))))
    }

    /// Whether nothing the engine adds is on its way: no gesture, no turning gaze, no join back.
    public var isAtRest: Bool {
        let wanted: Double = gaze.target == nil ? 0 : 1
        var aimed = true
        if let target = gaze.target {
            let apart: SIMD2<Double> = target - gaze.at
            aimed = abs(apart.x) < 0.005 && abs(apart.y) < 0.005
        }
        return player.faceSettled && gestures.isEmpty && release == nil && gaze.hold == wanted && aimed
            && abs(gaze.overClip - gaze.weight) < 0.005
    }

    /// Move the engine forward by a time, in seconds.
    public mutating func advance(_ seconds: Double) {
        guard !seconds.isNaN else { return }
        let step = max(0, min(maxStepSeconds, seconds))
        advanceDirector(step)
        advanceMorphing(step)
        // A body that has turned into a spinner has stopped its choreography.
        player.advance(step, clipRate: 1 - morphAmount, library: library)

        if release != nil {
            release!.time += step
            if release!.time >= joinSeconds { release = nil }
        }

        for index in gestures.indices { gestures[index].time += step }
        if gestures.contains(where: { $0.time >= $0.duration }) {
            gestures = gestures.filter { $0.time < $0.duration }
        }

        let share: Double = 1 - pow(1 - gazeCatchUp, step * 60)
        let wanted: Double = gaze.target == nil ? 0 : 1
        gaze.hold += (wanted - gaze.hold) * share
        if abs(wanted - gaze.hold) < 0.001 { gaze.hold = wanted }
        gaze.weight += (gaze.overClip - gaze.weight) * share
        if abs(gaze.overClip - gaze.weight) < 0.001 { gaze.weight = gaze.overClip }
        if let target = gaze.target {
            gaze.at.x += (target.x - gaze.at.x) * share
            gaze.at.y += (target.y - gaze.at.y) * share
        }
    }

    /// Everything a renderer needs to draw the avatar now: the clip, the gestures and the gaze.
    public var frame: AvatarFrame {
        var pose = player.pose
        pose.lids = player.shownLids
        let inspect = player.clip?.definition.inspect
        let weight = player.inspectWeight
        let lean: Double = if let inspect, !inspect.follow { inspect.bias } else { inspectLean(pose.rotation.y) }
        var eyeScales = inspectEyeScales(weight, lean)
        let spinner = spinnerFrame

        // A body that turns into a spinner gives up its pose as it goes: it comes to rest, upright.
        if let spinner {
            let left = 1 - spinner.amount
            let rest = morphing.rest
            let away: SIMD3<Double> = pose.rotation - rest
            let kept: SIMD3<Double> = away * left
            pose.rotation = rest + kept
            pose.position *= left
            let stretch: SIMD2<Double> = pose.squash - SIMD2<Double>.one
            pose.squash = SIMD2<Double>.one + stretch * left
        }

        var orientation: SIMD4<Double>?
        if let manual {
            if let rotation = manual.rotation { pose.rotation = rotation }
            if let position = manual.position { pose.position = position }
            if let zoom = manual.zoom { pose.zoom = zoom }
            if let given = manual.orientation {
                // The turn is given whole. What gestures and the gaze add is kept apart.
                orientation = given
                pose.rotation = .zero
            }
        }

        if let release, manual == nil {
            let progress = clipEaseAt(joinEase, min(1, release.time / joinSeconds))
            orientation = slerpQuaternion(release.orientation, frameOrientation(pose.rotation, orientation), progress)
            pose.rotation = .zero
            let moved: SIMD2<Double> = (pose.position - release.position) * progress
            pose.position = release.position + moved
            pose.zoom = release.zoom + (pose.zoom - release.zoom) * progress
        }

        if gaze.hold > 0 {
            let turnX: Double = -14 * gaze.at.y
            let turnY: Double = 18 * gaze.at.x
            let moveX: Double = 0.03 * gaze.at.x
            let moveY: Double = 0.024 * gaze.at.y
            if player.playing {
                if gaze.weight > 0 {
                    let amount: Double = gaze.weight * gaze.hold
                    pose.rotation.x += turnX * amount
                    pose.rotation.y += turnY * amount
                    pose.position.x += moveX * amount
                    pose.position.y += moveY * amount
                }
            } else {
                // A still body turns to what it looks at.
                pose.rotation.x += (turnX - pose.rotation.x) * gaze.hold
                pose.rotation.y += (turnY - pose.rotation.y) * gaze.hold
                pose.rotation.z *= 1 - gaze.hold
                pose.position.x += (moveX - pose.position.x) * gaze.hold
                pose.position.y += (moveY - pose.position.y) * gaze.hold
            }
        }

        // Gestures are laid over the clip: turns and moves add up, stretches multiply.
        for gesture in gestures { gesture.apply(to: &pose) }

        // Which eye of `inspecting` is the large one follows the turn of the head as it is drawn.
        if weight > 0, inspect == nil || inspect!.follow {
            eyeScales = inspectEyeScales(weight, inspectLean(pose.rotation.y))
        }
        // Going into a spinner and coming back, the body makes half a turn.
        let spin = morphing.spin.at.truncatingRemainder(dividingBy: Double.pi * 2)
        if abs(spin) > 1e-6 { pose.rotation.y += spin * 180 / Double.pi }

        return .init(pose: pose, orientation: orientation, squashAnchor: player.squashAnchor,
                     eyeScales: eyeScales, spinner: spinner, presentation: player.presentation(library))
    }

    // MARK: Director

    private func list(for definition: AvatarState) -> [String] {
        compact ? definition.compactClips ?? definition.clips : definition.clips
    }

    /// Draw the next clip of a list: each once per round, in an order drawn anew each round.
    private mutating func draw(_ list: [String]) -> String? {
        // States that share a list share its rounds: going from one to the other does not start over.
        let key = list.joined(separator: "|")
        var bag = bags[key] ?? []
        if bag.isEmpty {
            bag = list
            var index = bag.count - 1
            while index > 0 {
                let other = Int((random.next() * Double(index + 1)).rounded(.down))
                bag.swapAt(index, other)
                index -= 1
            }
            if let fresh = bag.firstIndex(where: { $0 != lastClip }), fresh > 0 { bag.swapAt(0, fresh) }
        }
        let name = bag.isEmpty ? nil : bag.removeFirst()
        bags[key] = bag
        return name
    }

    private mutating func pick() {
        guard let state, let definition = stateDefinition(state) else { return }
        let choices = list(for: definition)
        let name: String?
        if definition.ordered {
            name = choices.isEmpty ? nil : choices[min(index, choices.count - 1)]
        } else {
            name = draw(choices)
        }
        lastClip = name
        // Only the very first clip starts partway through.
        let phase = started || definition.ordered ? 0 : random.next()
        started = true
        loopsSeen = player.loopCount
        // The clip that already plays goes on: it is not started again.
        if let name, player.clip?.definition.name == name, player.playing { return }
        if let name, let clip = clipDefinition(name), clip.problem == nil {
            player.play(PlaybackClip(clip), phase: phase, cut: false)
        }
        loopsSeen = player.loopCount
    }

    private mutating func advanceDirector(_ seconds: Double) {
        guard let current = state, let definition = stateDefinition(current) else { return }
        stateTime += seconds
        if let next = definition.next, let hold = definition.holdSeconds, stateTime >= hold {
            setState(handover ? next : current)
            return
        }
        if player.loopCount == loopsSeen { return }
        // The clip has reached its end.
        loopsSeen = player.loopCount
        if definition.ordered {
            index += 1
            if index >= list(for: definition).count {
                setState(handover ? definition.next! : current)
                return
            }
        }
        pick()
    }

    // MARK: Spinner

    private var morphAmount: Double { max(0, min(1, morphing.amount.at)) }

    private mutating func advanceMorphing(_ seconds: Double) {
        var showing = false
        if var current = morphing.current {
            if let morph, AvatarSpinnerPattern.modes[morph] == current.pattern {
                current.shot += seconds
                showing = true
                if let shotSeconds = current.pattern.shotSeconds, current.shot >= shotSeconds {
                    // Between two shots the avatar comes back for a moment.
                    showing = false
                    if current.shot >= shotSeconds + spinnerPauseSeconds {
                        current.shot = 0
                        showing = true
                    }
                }
            }
            current.time += seconds
            morphing.current = current
        }
        morphing.leaving?.time += seconds

        if showing != morphing.showing {
            morphing.showing = showing
            if showing {
                morphing.spinWay = morphing.random.next() < 0.5 ? 1 : -1
                let turn = player.pose.rotation
                let restX: Double = jsRound(turn.x / 360) * 360
                let restY: Double = jsRound(turn.y / 360) * 360
                let restZ: Double = jsRound(turn.z / 360) * 360
                morphing.rest = SIMD3(restX, restY, restZ)
            }
            morphing.spinTarget += Double.pi * morphing.spinWay
        }
        morphing.amount.pull(to: showing ? 1 : 0, stiffness: 14, seconds: seconds)
        morphing.swap.pull(to: 1, stiffness: 11, seconds: seconds)
        morphing.spin.pull(to: morphing.spinTarget, stiffness: 14, seconds: seconds)
        if morphing.leaving != nil, morphing.swap.at > 0.996 { morphing.leaving = nil }
        if !showing, morph == nil, morphing.amount.at < 0.001, morphing.current != nil {
            morphing.current = nil
            morphing.leaving = nil
            morphing.amount = .init()
        }
    }

    private var spinnerFrame: AvatarSpinnerFrame? {
        let amount = morphAmount
        guard let current = morphing.current, amount > 0.0005 else { return nil }
        let swap = max(0, min(1, morphing.swap.at))
        let arriving = drawSpinner(current.pattern, weight: amount * (morphing.leaving == nil ? 1 : swap),
                                   time: current.time, shot: current.shot)
        var core = arriving.core
        var marks = arriving.marks
        if let leaving = morphing.leaving {
            let old = drawSpinner(leaving.pattern, weight: amount * (1 - swap), time: leaving.time, shot: leaving.shot)
            core.radius = old.core.radius + (arriving.core.radius - old.core.radius) * swap
            core.position = old.core.position + arriving.core.position
            core.turn = old.core.turn + arriving.core.turn
            core.opacity = old.core.opacity + (arriving.core.opacity - old.core.opacity) * swap
            core.drop = swap > 0.5 ? arriving.core.drop : old.core.drop
            marks = old.marks + marks
        }
        let share = max(0, min(1, amount / roundBy))
        let round: Double = share < 0.5 ? 4 * share * share * share : 1 - pow(-2 * share + 2, 3) / 2
        return .init(pattern: current.pattern, amount: amount, round: round, core: core, marks: marks)
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

/// The size of each eye while the face inspects: `weight` is how much of the face is
/// `inspecting`, `lean` runs from -1 to 1.
private func inspectEyeScales(_ weight: Double, _ lean: Double) -> SIMD2<Double> {
    guard weight > 0 else { return .one }
    let eyes = AvatarCatalogue.builtinFaces["inspecting"]?.eyes ?? []
    guard eyes.count == 2 else { return .one }
    let ratio: Double = eyes[1].wid / eyes[0].wid
    let share: Double = (1 + max(-1, min(1, lean))) / 2
    let first: Double = 1 + (pow(ratio, share) - 1) * weight
    let second: Double = 1 + (pow(1 / ratio, share) - 1) * weight
    return SIMD2(first, second)
}

/// The lean of `inspecting` for a turn of the head, in degrees, when it follows the head.
private func inspectLean(_ turn: Double) -> Double { max(-1, min(1, turn / inspectTurn)) }

// MARK: - The player

private struct ClipJoin: Sendable {
    let from: AvatarPose
    let to: AvatarPose
    var time = 0.0
    let target: PlaybackClip
    let phase: Double
}

private enum FaceWay: Sendable { case morph, blink }

private struct Player: Sendable {
    /// The clip that plays, or the one a join leads to.
    var clip: PlaybackClip?
    var time = 0.0
    var playing = false
    var loopCount = 0
    var pose = AvatarPose()
    var squashAnchor = 0.0
    var join: ClipJoin?
    /// The face the clip asks for now, by the name it gives.
    var clipFace = "neutral"
    /// A face asked for from outside: it comes before everything.
    var faceOverride: String?
    /// A face held by the state that plays: it comes before the clip's.
    var heldFace: String?
    /// The face shown, or the one the eyes are turning into.
    var face = "neutral"
    /// The eyes as they were when they started turning into `face`.
    var faceFrom = FacePresentation.resolve("neutral", library: .init())
    var faceWay = FaceWay.morph
    var inspectFrom = 0.0
    var smileFrom = 0.0
    var faceTime = faceSeconds
    var lidsBlocked = false

    private var changeSeconds: Double { faceWay == .blink ? faceSwapSeconds : faceSeconds }
    private var faceProgress: Double { clipEaseAt(faceEase, min(1, faceTime / changeSeconds)) }
    var faceSettled: Bool { faceTime >= changeSeconds }
    var shownLids: Double { lidsBlocked ? 0 : pose.lids }

    private static func faceOf(_ name: String, _ library: AvatarLibrary) -> FacePresentation {
        FacePresentation.resolve(name, library: library)
    }

    var inspectWeight: Double {
        let target: Double = face == "inspecting" ? 1 : 0
        if faceSettled { return target }
        return inspectFrom + (target - inspectFrom) * faceProgress
    }

    func smile(_ library: AvatarLibrary) -> Double {
        let target = Self.faceOf(face, library).smile
        if faceSettled { return target }
        return smileFrom + (target - smileFrom) * faceProgress
    }

    /// The eyes as they are now, between the face they leave and the one they reach.
    func eyes(_ library: AvatarLibrary) -> FacePresentation {
        let target = Self.faceOf(face, library)
        if faceSettled { return target }
        if faceWay == .blink {
            let progress = min(1, faceTime / faceSwapSeconds)
            if progress < swapShutAt {
                let closing = clipEaseAt(swapEase, progress / swapShutAt)
                var leaving = faceFrom
                leaving.shut = faceFrom.shut + (1 - faceFrom.shut) * closing
                return leaving
            }
            let opening = clipEaseAt(swapEase, (progress - swapShutAt) / (1 - swapShutAt))
            var coming = target
            coming.shut = 1 - opening
            return coming
        }
        guard case .builtin(let a) = faceFrom.artwork, case .builtin(let b) = target.artwork else { return target }
        return .init(name: target.name, artwork: .builtin(.mix(a, b, faceProgress)), smile: target.smile)
    }

    /// What a renderer draws: the eyes now, under the name of the face shown, with its smile now.
    func presentation(_ library: AvatarLibrary) -> FacePresentation {
        var shown = eyes(library)
        shown.name = face
        shown.smile = smile(library)
        return shown
    }

    private func wantedFace(_ library: AvatarLibrary) -> String {
        Self.faceOf(faceOverride ?? heldFace ?? clipFace, library).name
    }

    /// Show at once the face asked for, with nothing left to turn into.
    mutating func settleFace(_ library: AvatarLibrary) {
        let shown = Self.faceOf(faceOverride ?? heldFace ?? clipFace, library)
        face = shown.name
        faceFrom = shown
        faceWay = .morph
        inspectFrom = shown.name == "inspecting" ? 1 : 0
        smileFrom = shown.smile
        faceTime = faceSeconds
    }

    private mutating func startJoin(_ target: PlaybackClip, phase: Double) {
        var rest = target.restPose
        // Each angle of the pose of rest is taken at the turn nearest to where the body is.
        for axis in 0..<3 {
            let angle = rest.rotation[axis]
            rest.rotation[axis] = angle + 360 * jsRound((pose.rotation[axis] - angle) / 360)
        }
        join = .init(from: pose, to: rest, target: target, phase: phase)
        clip = target
        clipFace = target.restFace
        playing = true
    }

    private mutating func startClip(_ target: PlaybackClip, phase: Double) {
        clip = target
        join = nil
        time = max(0, min(1, phase)) * target.definition.duration
        squashAnchor = target.definition.squashAnchor ?? 0
        clipFace = target.face(at: time)
        pose = target.pose(at: time, zoom: pose.zoom)
        playing = true
    }

    /// Play a clip. From another clip the body is first led to the new clip's pose of rest.
    mutating func play(_ target: PlaybackClip, phase: Double, cut: Bool) {
        let joins = !cut && clip != nil && (join != nil || clip!.definition.name != target.definition.name)
        if joins { startJoin(target, phase: phase) } else { startClip(target, phase: phase) }
    }

    mutating func stop(_ library: AvatarLibrary) {
        clip = nil
        join = nil
        time = 0
        playing = false
        squashAnchor = 0
        pose = AvatarPose()
        clipFace = "neutral"
        heldFace = nil
        settleFace(library)
        lidsBlocked = false
    }

    mutating func seek(_ seconds: Double) {
        guard let clip else { return }
        join = nil
        time = max(0, min(clip.definition.duration, seconds))
        squashAnchor = clip.definition.squashAnchor ?? 0
        clipFace = clip.face(at: time)
        pose = clip.pose(at: time, zoom: pose.zoom)
    }

    /// The faces a clip asks for after one time and up to another.
    private mutating func fireFaces(_ clip: PlaybackClip, after: Double, upTo: Double) {
        for event in clip.faces {
            if event.t > upTo { break }
            if event.t > after { clipFace = event.v }
        }
    }

    private static func angleApart(_ left: Double, _ right: Double) -> Double {
        let turn = ((left - right).truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        return min(turn, 360 - turn)
    }

    /// Whether a pose is near enough to another for a clip to start again without a join.
    private static func near(_ pose: AvatarPose, _ rest: AvatarPose) -> Bool {
        for axis in 0..<3 where angleApart(pose.rotation[axis], rest.rotation[axis]) >= 4 { return false }
        let apart: [(Double, Double, Double)] = [
            (pose.position.x, rest.position.x, 0.015), (pose.position.y, rest.position.y, 0.015),
            (pose.squash.x, rest.squash.x, 0.02), (pose.squash.y, rest.squash.y, 0.02),
            (pose.zoom, rest.zoom, 0.02), (pose.lids, rest.lids, 0.05),
            (pose.opacity, rest.opacity, 0.02), (pose.eyeSize, rest.eyeSize, 0.02),
        ]
        return apart.allSatisfy { abs($0.0 - $0.1) < $0.2 }
    }

    private mutating func advanceClip(_ seconds: Double) {
        guard let clip else { return }
        if var pending = join {
            pending.time += seconds
            if pending.time >= joinSeconds {
                startClip(pending.target, phase: pending.phase)
                return
            }
            join = pending
            let progress = clipEaseAt(joinEase, pending.time / joinSeconds)
            pose = .blend(pending.from, pending.to, progress)
            return
        }
        let duration = clip.definition.duration
        let reached = time + seconds
        if reached < duration {
            fireFaces(clip, after: time, upTo: reached)
            time = reached
            pose = clip.pose(at: reached, zoom: pose.zoom)
            return
        }
        // The end of the clip. If the body is where the clip starts, the clip goes round; if not,
        // it is led back to the clip's pose of rest first.
        fireFaces(clip, after: time, upTo: duration)
        loopCount += 1
        pose = clip.pose(at: duration, zoom: pose.zoom)
        if !Self.near(pose, clip.restPose) {
            startJoin(clip, phase: 0)
            return
        }
        let wrapped = reached - duration
        time = wrapped >= duration ? 0 : wrapped
        fireFaces(clip, after: -1e-9, upTo: time)
        pose = clip.pose(at: time, zoom: pose.zoom)
    }

    /// Move the player forward. `clipRate` slows the clip without slowing the face.
    mutating func advance(_ step: Double, clipRate: Double, library: AvatarLibrary) {
        if playing { advanceClip(step * clipRate) }
        faceTime = min(changeSeconds, faceTime + step)

        // A face that cannot blink leaves the clip's eyelids open, and so does a face that is
        // changing. They close again only once the clip has opened them.
        let changing = faceTime < changeSeconds
        if !Self.faceOf(face, library).blinks || changing {
            lidsBlocked = true
        } else if pose.lids <= openLids {
            lidsBlocked = false
        }

        // The face changes with open eyes: a change asked for during a blink waits for its end.
        let wanted = wantedFace(library)
        if wanted != face, shownLids <= openLids {
            // Halfway through a blink the eyes are drawn ones, whatever the faces.
            let swapping = faceWay == .blink && !faceSettled
            let from = eyes(library)
            let to = Self.faceOf(wanted, library)
            faceFrom = from
            faceWay = swapping || from.isDrawn || to.isDrawn ? .blink : .morph
            inspectFrom = inspectWeight
            smileFrom = smile(library)
            face = wanted
            faceTime = 0
            lidsBlocked = true
        }
    }
}

// MARK: - Engine parts

private struct PoseRelease: Sendable {
    let orientation: SIMD4<Double>
    let position: SIMD2<Double>
    let zoom: Double
    var time = 0.0
}

private struct Gaze: Sendable {
    /// Where the avatar is asked to look, each from -1 to 1: to the right, and up.
    var target: SIMD2<Double>?
    var at = SIMD2<Double>.zero
    var hold = 0.0
    var overClip = 0.0
    var weight = 0.0
}

private struct GestureMotion: Sendable {
    let name: AvatarGesture
    let turns: Double
    var time = 0.0

    var duration: Double {
        switch name {
        case .spin: 0.9 + 0.4 * (turns - 1)
        case .nod: 0.5
        case .bounce: 0.62
        }
    }

    func apply(to pose: inout AvatarPose) {
        let t = min(1, time / duration)
        switch name {
        case .spin:
            pose.rotation.y += 180 * turns * (1 - cos(Double.pi * t))
        case .nod:
            pose.rotation.x += 16 * pow(sin(Double.pi * t), 2)
        case .bounce:
            func swell(_ from: Double, _ to: Double) -> Double {
                guard t > from, t < to else { return 0 }
                return pow(sin(Double.pi * (t - from) / (to - from)), 2)
            }
            let crouch: Double = swell(0, 0.18) + swell(0.82, 1)
            let flight: Double = swell(0.18, 0.82)
            let airborne: Double = max(0, min(1, (t - 0.14) / 0.72))
            pose.position.y += 0.3 * sin(Double.pi * airborne)
            pose.squash.x *= 1 + 0.08 * crouch - 0.04 * flight
            pose.squash.y *= 1 - 0.1 * crouch + 0.06 * flight
        }
    }
}

/// A value that follows its target like a weight on a spring, without overshooting it.
private struct AvatarSpring: Sendable {
    var at = 0.0
    var speed = 0.0

    mutating func pull(to target: Double, stiffness: Double, seconds: Double) {
        let steps = max(1, Int((seconds / springStep).rounded(.up)))
        let step = seconds / Double(steps)
        for _ in 0..<steps {
            speed += (-2 * stiffness * speed - stiffness * stiffness * (at - target)) * step
            at += speed * step
        }
    }
}

private struct ShownPattern: Sendable {
    let pattern: AvatarSpinnerPattern
    var time = 0.0
    var shot = 0.0
}

/// The body turning into a spinner, and back.
private struct Morphing: Sendable {
    var current: ShownPattern?
    var leaving: ShownPattern?
    var amount = AvatarSpring()
    var swap = AvatarSpring(at: 1)
    /// A half turn of the body each time it goes into a spinner or comes back, in radians.
    var spin = AvatarSpring()
    var spinTarget = 0.0
    var spinWay = 1.0
    var showing = false
    var random = AvatarRandom(seed: 2_654_435_769)
    /// The turn the body is brought to while it is a spinner: each angle at its nearest turn.
    var rest = SIMD3<Double>.zero
}
