import Foundation

public struct AvatarKeyframe: Codable, Equatable, Sendable {
    public var t: Double
    public var v: [Double]
    public var ease: [Double]?

    public init(t: Double, v: [Double], ease: [Double]? = nil) {
        self.t = t
        self.v = v
        self.ease = ease
    }
}

public struct AvatarFaceKeyframe: Codable, Equatable, Sendable {
    public var t: Double
    public var v: String
    public var cut: Bool?

    public init(t: Double, v: String, cut: Bool? = nil) {
        self.t = t
        self.v = v
        self.cut = cut
    }
}

public struct AvatarClip: Codable, Equatable, Sendable, Identifiable {
    public var id: String { name }
    public var name: String
    public var duration: Double
    public var body: String?
    public var squashAnchor: Double?
    public var workArea: WorkArea?
    public var inspect: Inspect?
    public var tracks: Tracks

    public init(name: String, duration: Double, body: String? = nil, squashAnchor: Double? = nil,
                workArea: WorkArea? = nil, inspect: Inspect? = nil, tracks: Tracks = .init()) {
        self.name = name
        self.duration = duration
        self.body = body
        self.squashAnchor = squashAnchor
        self.workArea = workArea
        self.inspect = inspect
        self.tracks = tracks
    }

    public struct WorkArea: Codable, Equatable, Sendable {
        public var start: Double
        public var end: Double
        public init(start: Double, end: Double) { self.start = start; self.end = end }
    }

    public struct Inspect: Codable, Equatable, Sendable {
        public var bias: Double
        public var follow: Bool
        public init(bias: Double, follow: Bool) { self.bias = bias; self.follow = follow }
    }

    public struct Tracks: Codable, Equatable, Sendable {
        public var position: [AvatarKeyframe]?
        public var rotation: [AvatarKeyframe]?
        public var squash: [AvatarKeyframe]?
        public var scale: [AvatarKeyframe]?
        public var lids: [AvatarKeyframe]?
        public var opacity: [AvatarKeyframe]?
        public var eyeSize: [AvatarKeyframe]?
        public var expression: [AvatarFaceKeyframe]?

        public init(position: [AvatarKeyframe]? = nil, rotation: [AvatarKeyframe]? = nil,
                    squash: [AvatarKeyframe]? = nil, scale: [AvatarKeyframe]? = nil, lids: [AvatarKeyframe]? = nil,
                    opacity: [AvatarKeyframe]? = nil, eyeSize: [AvatarKeyframe]? = nil,
                    expression: [AvatarFaceKeyframe]? = nil) {
            self.position = position
            self.rotation = rotation
            self.squash = squash
            self.scale = scale
            self.lids = lids
            self.opacity = opacity
            self.eyeSize = eyeSize
            self.expression = expression
        }
    }

    var problem: String? {
        guard !name.isEmpty, duration.isFinite, duration > 0 else { return "Invalid clip name or duration." }
        let expected: [(String, [AvatarKeyframe]?, Int)] = [
            ("position", tracks.position, 2), ("rotation", tracks.rotation, 3), ("squash", tracks.squash, 2),
            ("scale", tracks.scale, 1), ("lids", tracks.lids, 1), ("opacity", tracks.opacity, 1),
            ("eyeSize", tracks.eyeSize, 1),
        ]
        for (label, track, count) in expected {
            var previous = -Double.infinity
            for key in track ?? [] {
                guard key.t.isFinite, key.t >= previous, key.v.count == count, key.v.allSatisfy(\.isFinite) else {
                    return "Invalid \(label) keyframe."
                }
                if let ease = key.ease,
                   ease.count != 4 || !ease.allSatisfy(\.isFinite) || !(0...1).contains(ease[0]) || !(0...1).contains(ease[2]) {
                    return "Invalid \(label) easing."
                }
                previous = key.t
            }
        }
        if (tracks.expression ?? []).contains(where: { !$0.t.isFinite || $0.v.isEmpty }) {
            return "Invalid expression keyframe."
        }
        if let area = workArea,
           !area.start.isFinite || !area.end.isFinite || area.start < 0 || area.end < area.start {
            return "Invalid work area."
        }
        return nil
    }
}

public struct AvatarState: Codable, Equatable, Sendable {
    public var clips: [String]
    public var compactClips: [String]?
    public var face: String?
    public var morph: String?
    public var next: String?
    public var holdSeconds: Double?

    public init(clips: [String], compactClips: [String]? = nil, face: String? = nil, morph: String? = nil,
                next: String? = nil, holdSeconds: Double? = nil) {
        self.clips = clips
        self.compactClips = compactClips
        self.face = face
        self.morph = morph
        self.next = next
        self.holdSeconds = holdSeconds
    }

    var ordered: Bool { next != nil && holdSeconds == nil }
}

public enum AvatarGesture: String, Codable, CaseIterable, Sendable {
    case nod, bounce, spin
}

public enum AvatarCatalogue {
    public struct StateGroup: Codable, Equatable, Sendable {
        public let label: String
        public let states: [String]
    }

    private struct States: Decodable {
        let states: [String: AvatarState]
        let groups: [StateGroup]
    }

    private static let stateData: States = load("states")
    private static let clipData: [AvatarClip] = load("clips")
    static let builtinFaces: [String: AvatarFaceShape] = load("faces")

    public static let states = stateData.states
    public static let stateGroups = stateData.groups
    public static let stateNames = Array(Set(stateGroups.flatMap(\.states) + states.keys.sorted())).sorted()
    public static let clips = Dictionary(uniqueKeysWithValues: clipData.map { ($0.name, $0) })
    public static let clipNames = clipData.map(\.name)
    public static let faceNames = ["neutral", "happy", "surprised", "sad", "sleepy", "squinted", "calm", "inspecting", "confused"]
    public static let gestureNames = AvatarGesture.allCases.map(\.rawValue)
    public static let spinnerPatterns = AvatarSpinnerPattern.allCases.map(\.rawValue)
    public static let stateAliases = ["dots": "thinking", "radar": "searching", "orbit": "waiting", "loading": "progress"]

    public static func resolveStateName(_ name: String) -> String { stateAliases[name] ?? name }

    static let faceAliases = [
        "thinking": "sad", "strange": "inspecting", "angry": "neutral", "inspect": "inspecting",
        "squint": "squinted", "idle": "neutral", "smile": "happy", "sleep": "sleepy",
    ]

    public static func resolveFaceName(_ name: String) -> String {
        let key = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return builtinFaces[key] == nil ? (faceAliases[key] ?? "neutral") : key
    }

    private static func load<T: Decodable>(_ name: String) -> T {
        do { return try AvatarResources.json(name) }
        catch { preconditionFailure("Invalid packaged avatar catalogue \(name): \(error)") }
    }
}

public struct AvatarPose: Equatable, Sendable {
    public static let restZoom = 0.6
    public var position: SIMD2<Double>
    public var rotation: SIMD3<Double>
    public var squash: SIMD2<Double>
    public var zoom: Double
    public var lids: Double
    public var opacity: Double
    public var eyeSize: Double

    public init(position: SIMD2<Double> = .zero, rotation: SIMD3<Double> = .zero, squash: SIMD2<Double> = .one,
                zoom: Double = restZoom, lids: Double = 0, opacity: Double = 1, eyeSize: Double = 1) {
        self.position = position
        self.rotation = rotation
        self.squash = squash
        self.zoom = zoom
        self.lids = lids
        self.opacity = opacity
        self.eyeSize = eyeSize
    }

    static func blend(_ from: Self, _ to: Self, _ fraction: Double) -> Self {
        Self(position: from.position + (to.position - from.position) * fraction,
             rotation: from.rotation + (to.rotation - from.rotation) * fraction,
             squash: from.squash + (to.squash - from.squash) * fraction,
             zoom: interpolate(from.zoom, to.zoom, fraction), lids: interpolate(from.lids, to.lids, fraction),
             opacity: interpolate(from.opacity, to.opacity, fraction),
             eyeSize: interpolate(from.eyeSize, to.eyeSize, fraction))
    }
}

/// Each supplied field replaces the matching animated pose value. Quaternion order is w, x, y, z.
public struct AvatarFreePose: Equatable, Sendable {
    public var rotation: SIMD3<Double>?
    public var orientation: SIMD4<Double>?
    public var position: SIMD2<Double>?
    public var zoom: Double?

    public init(rotation: SIMD3<Double>? = nil, orientation: SIMD4<Double>? = nil,
                position: SIMD2<Double>? = nil, zoom: Double? = nil) {
        self.rotation = rotation
        self.orientation = orientation
        self.position = position
        self.zoom = zoom
    }
}

public func seedOfName(_ name: String) -> UInt32 {
    name.utf16.reduce(2_166_136_261) { ($0 ^ UInt32($1)) &* 16_777_619 }
}

struct AvatarRandom: Sendable {
    var seed: UInt32

    mutating func next() -> Double {
        seed &+= 1_831_565_813
        var value = (seed ^ (seed >> 15)) &* (seed | 1)
        value ^= value &+ ((value ^ (value >> 7)) &* (value | 61))
        return Double(value ^ (value >> 14)) / 4_294_967_296
    }
}

func clamp(_ value: Double, _ minValue: Double = 0, _ maxValue: Double = 1) -> Double {
    min(maxValue, max(minValue, value))
}

func interpolate(_ a: Double, _ b: Double, _ progress: Double) -> Double { a + (b - a) * progress }

func smooth(_ value: Double) -> Double {
    let t = clamp(value)
    return t * t * (3 - 2 * t)
}

func radians(_ degrees: Double) -> Double { degrees * .pi / 180 }

public func clipEaseAt(_ ease: [Double], _ time: Double) -> Double {
    if time <= 0 { return 0 }
    if time >= 1 { return 1 }
    guard ease.count == 4, ease[0] != ease[1] || ease[2] != ease[3] else { return time }
    let (x1, y1, x2, y2) = (ease[0], ease[1], ease[2], ease[3])
    func bezier(_ a: Double, _ b: Double, _ t: Double) -> Double {
        let rest = 1 - t
        return 3 * rest * rest * t * a + 3 * rest * t * t * b + t * t * t
    }
    func slope(_ a: Double, _ b: Double, _ t: Double) -> Double {
        let rest = 1 - t
        return 3 * rest * rest * a + 6 * rest * t * (b - a) + 3 * t * t * (1 - b)
    }
    // As avatar-core: Newton's steps first, then halving where they do not settle.
    var t = time
    for _ in 0..<8 {
        let error = bezier(x1, x2, t) - time
        if abs(error) < 1e-6 { return bezier(y1, y2, t) }
        let rate = slope(x1, x2, t)
        if abs(rate) < 1e-6 { break }
        t -= error / rate
    }
    var lower = 0.0
    var upper = 1.0
    t = time
    for _ in 0..<24 {
        let x = bezier(x1, x2, t)
        if abs(x - time) < 1e-6 { break }
        if x < time { lower = t } else { upper = t }
        t = (lower + upper) / 2
    }
    return bezier(y1, y2, t)
}

public func sampleClipTrack(_ keys: [AvatarKeyframe], at time: Double) -> [Double]? {
    guard let first = keys.first, let last = keys.last else { return nil }
    if time <= first.t { return first.v }
    if time >= last.t { return last.v }
    guard let next = keys.firstIndex(where: { $0.t > time }), next > 0 else { return last.v }
    let from = keys[next - 1]
    let to = keys[next]
    let portion = (time - from.t) / (to.t - from.t)
    let progress = from.ease.map { clipEaseAt($0, portion) } ?? portion
    return zip(from.v, to.v).map { interpolate($0, $1, progress) }
}
