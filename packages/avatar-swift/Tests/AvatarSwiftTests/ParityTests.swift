import Foundation
import Testing
@testable import AvatarSwift

// avatar-core writes what its engine does in `parity/frames.json` (see
// `__tests__/swift-parity-test.ts`). Playing the same scenes here must give the same frames: a
// change of the engine in TypeScript fails this test until it is ported to Swift.

private let parity = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("parity")

private func json(_ name: String) throws -> Any {
    try JSONSerialization.jsonObject(with: Data(contentsOf: parity.appendingPathComponent(name)))
}

/// How far a number may be from avatar-core's. `PARITY_TOLERANCE` changes it while looking into a difference.
private let tolerance = Double(ProcessInfo.processInfo.environment["PARITY_TOLERANCE"] ?? "") ?? 1e-6

private func numbers(_ value: Any?) -> [Double] { (value as? [Any] ?? []).compactMap(jsonNumber) }

private func snapshot(_ engine: AvatarEngine) -> [String: Any] {
    let frame = engine.frame
    let pose = frame.pose
    var shot: [String: Any] = [
        "face": frame.face,
        "position": [pose.position.x, pose.position.y],
        "rotation": [pose.rotation.x, pose.rotation.y, pose.rotation.z],
        "squash": [pose.squash.x, pose.squash.y],
        "zoom": pose.zoom, "lids": pose.lids, "opacity": pose.opacity, "eyeSize": pose.eyeSize,
        "squashAnchor": frame.squashAnchor,
        "eyeScales": [frame.eyeScales.x, frame.eyeScales.y],
        "smile": frame.smile,
        "clipTime": engine.clipTime,
    ]
    if let state = engine.state { shot["state"] = state }
    if let clip = engine.clip { shot["clip"] = clip }
    if let q = frame.orientation { shot["orientation"] = [q.x, q.y, q.z, q.w] }
    if let spinner = frame.spinner {
        shot["spinner"] = [
            "amount": spinner.amount, "round": spinner.round, "radius": spinner.core.radius,
            "x": spinner.core.position.x, "y": spinner.core.position.y, "turn": spinner.core.turn,
            "opacity": spinner.core.opacity, "drop": spinner.core.drop, "marks": spinner.marks.count,
        ] as [String: Any]
    }
    return shot
}

/// Differences between a frame of avatar-core and one of Swift, as readable lines.
private func differences(_ expected: [String: Any], _ actual: [String: Any], _ prefix: String = "") -> [String] {
    var found: [String] = []
    for key in Set(expected.keys).union(actual.keys).sorted() {
        let name = prefix + key
        let want = expected[key] is NSNull ? nil : expected[key]
        let got = actual[key]
        switch (want, got) {
        case (nil, nil): continue
        case (let want as [String: Any], let got as [String: Any]):
            found += differences(want, got, name + ".")
        case (let want as String, let got as String) where want == got: continue
        case (let want as [Any], let got as [Double]):
            let values = numbers(want)
            if values.count != got.count || zip(values, got).contains(where: { abs($0 - $1) > tolerance }) {
                found.append("\(name): avatar-core \(values), Swift \(got)")
            }
        case (let want?, let got as Bool):
            if (want as? Bool) != got { found.append("\(name): avatar-core \(want), Swift \(got)") }
        case (let want?, let got as Int):
            if jsonNumber(want) != Double(got) { found.append("\(name): avatar-core \(want), Swift \(got)") }
        case (let want?, let got as Double):
            if let value = jsonNumber(want), abs(value - got) <= tolerance { continue }
            found.append("\(name): avatar-core \(want), Swift \(got)")
        default:
            found.append("\(name): avatar-core \(want.map { "\($0)" } ?? "none"), Swift \(got.map { "\($0)" } ?? "none")")
        }
    }
    return found
}

private struct ParityScene: CustomTestStringConvertible, Sendable {
    let id: String
    let seed: UInt32
    let compact: Bool
    let library: Bool
    let steps: [[String]]
    var testDescription: String { id }
}

// Steps are kept as JSON text so that a scene is Sendable.
private func scenes() throws -> [ParityScene] {
    try (json("scenes.json") as? [[String: Any]] ?? []).map { scene in
        ParityScene(
            id: scene["id"] as? String ?? "?",
            seed: UInt32(jsonNumber(scene["seed"]) ?? 26),
            compact: scene["compact"] as? Bool ?? false,
            library: scene["library"] as? Bool ?? false,
            steps: try (scene["steps"] as? [[Any]] ?? []).map { step in
                try step.map { value in
                    String(decoding: try JSONSerialization.data(withJSONObject: value, options: .fragmentsAllowed),
                           as: UTF8.self)
                }
            }
        )
    }
}

private func value(_ text: String) -> Any? {
    let read = try? JSONSerialization.jsonObject(with: Data(text.utf8), options: .fragmentsAllowed)
    return read is NSNull ? nil : read
}

private func point(_ text: String) -> SIMD2<Double>? {
    let values = numbers(value(text))
    return values.count == 2 ? SIMD2(values[0], values[1]) : nil
}

/// Scenes in which the Swift engine does not yet do what avatar-core does. Each is a known issue:
/// the test fails if one of them starts to match, so that it is taken off this list.
private let notYetMatching: Set<String> = [
    "clip-seek-pause",
    "gaze",
    "handover-finished",
    "held-face-emphasis",
    "library-clip-face",
    "library-greeting",
    "look-at",
    "no-handover",
    "nod-bounce-spin",
    "pose-and-release",
    "seed-7-idle",
    "state-angry",
    "state-blocked",
    "state-bored",
    "state-celebrate",
    "state-coding",
    "state-computing",
    "state-confused",
    "state-controlling",
    "state-curious",
    "state-dragging",
    "state-drowsy",
    "state-excited",
    "state-finished",
    "state-happy",
    "state-humming",
    "state-idle",
    "state-laughing",
    "state-listening",
    "state-logo",
    "state-playful",
    "state-progress",
    "state-proud",
    "state-reading",
    "state-running",
    "state-scared",
    "state-showcase",
    "state-shy",
    "state-sleeping",
    "state-spawning",
    "state-streaming",
    "state-surprised",
    "state-suspicious",
    "state-waking",
    "state-working",
]

@Test(arguments: try scenes())
private func engineMatchesAvatarCore(_ scene: ParityScene) throws {
    let library = scene.library ? try readAvatarLibrary(Data(contentsOf: parity.appendingPathComponent("library.json"))).library
                                : AvatarLibrary()
    var engine = AvatarEngine(seed: scene.seed, compact: scene.compact, library: library)
    var frames: [[String: Any]] = []
    var times: [Double] = []
    var tick = 0
    let dt = 1.0 / 60.0
    for step in scene.steps {
        let op = value(step[0]) as? String ?? ""
        let a = step.count > 1 ? step[1] : "null"
        let b = step.count > 2 ? step[2] : "null"
        switch op {
        case "state": _ = engine.setState(value(a) as? String ?? "")
        case "clip": _ = engine.playClip(value(a) as? String ?? "", phase: jsonNumber(value(b)) ?? 0)
        case "morph": engine.setMorph(value(a) as? String)
        case "face": engine.setFace(value(a) as? String)
        case "emphasis": engine.setEmphasis(value(a) as? Bool ?? false)
        case "compact": engine.compact = value(a) as? Bool ?? false
        case "handover": engine.handover = value(a) as? Bool ?? true
        case "gaze": engine.setGaze(point(a))
        case "gazeAlways": engine.setGazeAlways(value(a) as? Bool ?? false)
        case "lookAt": engine.setLookAt(point(a))
        case "pose":
            if let pose = value(a) as? [String: Any] {
                let rotation = numbers(pose["rotation"])
                let position = numbers(pose["position"])
                engine.setPose(AvatarFreePose(
                    rotation: rotation.count == 3 ? SIMD3(rotation[0], rotation[1], rotation[2]) : nil,
                    position: position.count == 2 ? SIMD2(position[0], position[1]) : nil,
                    zoom: jsonNumber(pose["zoom"])))
            } else {
                engine.setPose(nil)
            }
        case "release": engine.releasePose()
        case "poke":
            let gesture = try #require(AvatarGesture(rawValue: value(a) as? String ?? ""))
            engine.poke(gesture, turns: Int(jsonNumber(value(b)) ?? 1))
        case "seek": engine.seek(jsonNumber(value(a)) ?? 0)
        case "pause": engine.pause()
        case "resume": engine.resume()
        case "run":
            let count = Int(((jsonNumber(value(a)) ?? 0) / dt).rounded())
            let stride = Int(((jsonNumber(value(b)) ?? 1) / dt).rounded())
            for index in 1...max(1, count) where count > 0 {
                engine.advance(dt)
                tick += 1
                if index % stride == 0 {
                    frames.append(snapshot(engine))
                    times.append(Double(tick) * dt)
                }
            }
        default: Issue.record("\(scene.id): unknown step \(op)")
        }
    }

    let expected = try #require((json("frames.json") as? [String: Any])?[scene.id] as? [[String: Any]])
    func compare() {
        #expect(expected.count == frames.count, "\(scene.id): \(expected.count) frames in avatar-core, \(frames.count) in Swift")
        // Only the first frame that differs says why: what follows it in the scene differs as a result.
        for (index, (want, got)) in zip(expected, frames).enumerated() {
            let found = differences(want["frame"] as? [String: Any] ?? [:], got)
            if !found.isEmpty {
                let lines = found.joined(separator: "\n  ")
                Issue.record("\(scene.id) at \(String(format: "%.2f", times[index])) s:\n  \(lines)")
                break
            }
        }
    }
    if notYetMatching.contains(scene.id) {
        withKnownIssue("The Swift engine does not yet match avatar-core in this scene.") { compare() }
    } else {
        compare()
    }
}
