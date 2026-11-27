import Foundation
import Metal
import simd
import Testing
@testable import AvatarSwift

@Test func catalogueIsCompleteAndPlayable() throws {
    #expect(AvatarCatalogue.stateNames.count >= 50)
    #expect(AvatarCatalogue.clipNames.count >= 28)
    #expect(AvatarCatalogue.faceNames.count >= 9)
    #expect(AvatarCatalogue.spinnerPatterns.count == 13)
    #expect(AvatarCatalogue.gestureNames == ["nod", "bounce", "spin"])
    for name in AvatarCatalogue.stateNames {
        var engine = AvatarEngine(seed: 42)
        let accepted = engine.setState(name)
        #expect(accepted)
        #expect(engine.clip != nil)
        for _ in 0..<90 {
            engine.advance(1 / 60)
            #expect(engine.frame.pose.zoom.isFinite)
        }
    }
    for pattern in AvatarSpinnerPattern.allCases {
        let art = drawSpinner(pattern, weight: 1, time: 0.7, shot: 0.7)
        #expect(art.core.radius > 0)
        #expect(art.core.position.x.isFinite && art.core.position.y.isFinite)
        if pattern != .ball { #expect(!art.marks.isEmpty) }
    }
}

@Test func seededPlaybackAndHandover() throws {
    var a = AvatarEngine(seed: seedOfName("Test Character"))
    var b = AvatarEngine(seed: seedOfName("Test Character"))
    a.setState("idle")
    b.setState("idle")
    let initial = a.frame
    let unknownState = a.setState("not-a-state")
    let unknownClip = a.playClip("not-a-clip")
    #expect(!unknownState && !unknownClip)
    #expect(a.frame == initial)
    for step in 0..<540 {
        if step == 160 {
            a.setState("waking")
            b.setState("waking")
        }
        a.advance(1 / 60)
        b.advance(1 / 60)
        #expect(a.clip == b.clip)
        #expect(a.state == b.state)
        #expect(a.frame == b.frame)
    }
    #expect(a.state == "idle")

    a.setState("dots")
    #expect(a.state == "thinking")
    for _ in 0..<45 { a.advance(1 / 60) }
    #expect(a.frame.spinner?.pattern == .dots)
    a.handover = false
    a.setState("waking")
    for _ in 0..<130 { a.advance(1 / 60) }
    #expect(a.state == "waking")
}

@Test func spinnerTurnsLikeAvatarCore() throws {
    // avatar-core, seed 26, two seconds into `thinking`: the body has turned +180°.
    var engine = AvatarEngine(seed: 26)
    engine.setState("thinking")
    for _ in 0..<120 { engine.advance(1 / 60) }
    #expect(abs(engine.frame.pose.rotation.y - 180) < 0.5)
}

@Test func gazePosePauseAndGesture() throws {
    var engine = AvatarEngine()
    engine.setState("listening")
    engine.setPose(.init(rotation: SIMD3(0, 0, 0), zoom: 0.8))
    let clipTime = engine.clipTime
    engine.setLookAt(SIMD2(1, 0.5))
    for _ in 0..<36 { engine.advance(1 / 60) }
    // As in avatar-core, the clip goes on under a pose set by hand.
    #expect(engine.clipTime != clipTime)
    #expect(engine.frame.pose.rotation.y > 14)
    #expect(engine.frame.pose.zoom == 0.8)
    engine.poke(.nod)
    engine.advance(0.1)
    #expect(!engine.isAtRest)
    // Paused, the clip stays where it is; the nod laid over it goes on.
    engine.pause()
    #expect(engine.isPaused)
    let frozen = engine.frame
    let pausedAt = engine.clipTime
    engine.advance(0.09)
    #expect(engine.clipTime == pausedAt)
    #expect(engine.frame != frozen)
    engine.resume()
    #expect(!engine.isPaused)
    engine.setLookAt(nil)
    engine.releasePose()
    for _ in 0..<60 { engine.advance(1 / 60) }
    #expect(engine.clipTime != clipTime)
    #expect(engine.isAtRest)
}

@Test func orientationsAreAvatarCoresTurnsInSwiftsWorld() throws {
    // A frame's orientation is counted as avatar-core counts a clip's turn; the scene turns it into
    // Swift's world, where the same rotation is `rotationQuaternion`.
    let turns: [SIMD3<Double>] = [SIMD3(12, 30, -5), SIMD3(-40, 0, 0), SIMD3(0, 75, 0), SIMD3(0, 0, 33),
                                  SIMD3(170, -95, 260)]
    for turn in turns {
        let world = worldQuaternion(clipOrientation(turn)).vector
        let expected = rotationQuaternion(turn).vector
        let same = simd_length(world - expected) < 1e-9 || simd_length(world + expected) < 1e-9
        #expect(same, "\(turn)")
    }
}

@Test func validationAndLegacyMigration() throws {
    let encoded = try JSONEncoder().encode(sampleCharacter)
    #expect(try validateCharacter(encoded).get() == sampleCharacter)

    var decoded = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
    decoded["bad/name~"] = 9
    let error = try validationError(JSONSerialization.data(withJSONObject: decoded))
    #expect(error.errors.contains { $0.path == "/bad~1name~0" && $0.code == "additionalProperties" })

    // The file format is avatar-core's: what the Studio and the web renderers refuse, Swift refuses.
    func rejects(_ path: [String], _ value: Any, at pointer: String) throws {
        var file = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        func set(_ object: inout [String: Any], _ keys: ArraySlice<String>) {
            guard let key = keys.first else { return }
            if keys.count == 1 { object[key] = value; return }
            if var array = object[key] as? [[String: Any]], let index = Int(keys.dropFirst().first ?? "") {
                set(&array[index], keys.dropFirst(2))
                object[key] = array
            } else {
                var child = object[key] as? [String: Any] ?? [:]
                set(&child, keys.dropFirst())
                object[key] = child
            }
        }
        set(&file, path[...])
        let issues = try validationError(JSONSerialization.data(withJSONObject: file)).errors
        #expect(issues.contains { $0.path == pointer }, "\(pointer): \(issues)")
    }
    try rejects(["style", "lighting"], "studio", at: "/style/lighting")
    try rejects(["face", "eyes", "neutralShape"], "circle", at: "/face/eyes/neutralShape")
    try rejects(["body", "nodes", "0", "blend"], 12, at: "/body/nodes/0/blend")
    try rejects(["body", "primary", "type"], "tapered-beak", at: "/body/primary/type")

    let legacy = """
    {"schema":"bible-strong/avatar-definition","schemaVersion":1,"name":"Legacy",
      "body":{"primary":{"type":"sphere","width":240,"height":240,"depth":240,"roundness":1},"nodes":[]},
      "colors":{"body":"#4c88aa","eyes":"#131313"},
      "expressions":{"neutral":{"head":{"x":0,"y":0,"z":0},
        "eyes":{"spacing":36,"left":{"width":20,"height":32,"x":0,"y":-12,"angle":0},
                             "right":{"width":20,"height":32,"x":0,"y":-12,"angle":0}},
        "perspective":1,"motion":{"eyes":"none","body":"none"}}},
      "expressionOrder":["neutral"],"animations":{},"animationOrder":[]}
    """
    let read = try characterOf(Data(legacy.utf8))
    #expect(read.name == "Legacy")
    #expect(read.face.eyes.shiftY == -0.1)
    #expect(read.face.eyes.width == 1)
    if let sample = ProcessInfo.processInfo.environment["AVATARSWIFT_LEGACY_FIXTURE"] {
        let imported = try characterOf(Data(contentsOf: URL(fileURLWithPath: sample)))
        #expect(imported.name == "Strobi")
        #expect(imported.body.primary.type == .sphere)
        if let demo = ProcessInfo.processInfo.environment["AVATARSWIFT_DEMO_CHARACTER"] {
            let packaged = try characterOf(Data(contentsOf: URL(fileURLWithPath: demo)))
            #expect(imported == packaged)
        }
    }
}

private func validationError(_ data: Data) throws -> AvatarFileError {
    switch validateCharacter(data) {
    case .failure(let error): return error
    case .success: throw AvatarFaceError(message: "Expected rejection.")
    }
}

@Test func pathsAndCustomLibraries() throws {
    let path = try parseAvatarPath("M1 3l6 -1h2v4C12 8 13 7 14 8s3 6 5 2Q20 10 24 15t5-2A7 5 15 0 1 40 31Z")
    #expect(path.commands.count >= 10)
    #expect(try flattenPath("M0 0a10 10 0 0 1 20 0").first?.last == SIMD2(20, 0))
    #expect(throws: AvatarPathError.self) { try parseAvatarPath("M1 infinity") }

    let data = Data("""
    {"clips":[{"name":"Hello","duration":0.5,"tracks":{"rotation":[{"t":0,"v":[0,0,0]},{"t":0.5,"v":[0,30,0]}]}},
              {"name":"bad","duration":0,"tracks":{}}],
     "states":[{"name":"greeting","clips":["Hello"],"face":"Spark","next":"idle"}],
     "faces":[{"name":"Spark","svg":"<svg viewBox='0 0 100 100'><g transform='translate(10 0)'><circle cx='40' cy='50' r='22'/></g><g id='right'><rect x='12' y='28' width='60' height='40' rx='6'/></g><text>ignored</text></svg>"}]}
    """.utf8)
    let read = try readAvatarLibrary(data)
    #expect(read.problems.count == 2)
    let face = try #require(read.library.faces["Spark"])
    #expect(face.left[0].path.cgPath.boundingBoxOfPath.midX == 50)
    #expect(face.right?.first?.path.cgPath.boundingBoxOfPath.width == 60)
    var engine = AvatarEngine(seed: 2, library: read.library)
    let accepted = engine.setState("greeting")
    #expect(accepted)
    for _ in 0..<20 { engine.advance(1 / 60) }
    #expect(engine.frame.face == "Spark")
    for _ in 0..<60 { engine.advance(1 / 60) }
    #expect(engine.state == "idle")
}

// Skipped on a machine without Metal, such as some continuous integration runners.
@Test(.enabled(if: MTLCreateSystemDefaultDevice() != nil)) @MainActor
func renderDefaultAndImportedSurfaceKinds() throws {
    let renderer = try AvatarMetalRenderer()
    let side = 144
    let spec = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: side, height: side,
                                                       mipmapped: false)
    spec.storageMode = .shared
    spec.usage = .shaderWrite
    let texture = try #require(renderer.device.makeTexture(descriptor: spec))

    func capture(_ character: AvatarCharacter, _ frame: AvatarFrame) throws -> [UInt8] {
        let command = try renderer.encode(renderCharacterFrame(character, frame), into: texture)
        command.commit()
        command.waitUntilCompleted()
        #expect(command.status == .completed)
        var bytes = [UInt8](repeating: 0, count: side * side * 4)
        bytes.withUnsafeMutableBytes {
            texture.getBytes($0.baseAddress!, bytesPerRow: side * 4,
                             from: MTLRegionMake2D(0, 0, side, side), mipmapLevel: 0)
        }
        return bytes
    }

    let neutral = AvatarEngine().frame
    for kind in AvatarSurface.Kind.allCases {
        var character = sampleCharacter
        character.body = .init(primary: AvatarSurface(type: kind, width: 180, height: 190, depth: 130, roundness: 0.65))
        let bytes = try capture(character, neutral)
        #expect(bytes[3] == 0)
        #expect(stride(from: 3, to: bytes.count, by: 4).filter { bytes[$0] > 100 }.count > 1_000)
    }
    let rendered = try capture(sampleCharacter, neutral)
    let yellow = stride(from: 0, to: rendered.count, by: 4).filter { rendered[$0 + 2] > 180 && rendered[$0 + 1] > 130 && rendered[$0] < 150 }
    #expect(yellow.count > 20)
    let eyeInk = stride(from: 0, to: rendered.count, by: 4).filter {
        rendered[$0 + 3] == 255 && rendered[$0] < 20 && rendered[$0 + 1] < 20 && rendered[$0 + 2] < 20
    }
    #expect((30...210).contains(eyeInk.count))

    let mark = try compileFace(.init(name: "Arrow", svg:
        "<svg viewBox='0 0 100 100'><path d='M12 50L86 17L67 50L86 83Z'/></svg>")).face
    var custom = AvatarEngine(library: .init(faces: ["Arrow": mark]))
    custom.setFace("Arrow")
    for _ in 0..<24 { custom.advance(1 / 60) }
    #expect(custom.frame.face == "Arrow")
    #expect(try capture(sampleCharacter, custom.frame) != rendered)

    var manyParts = sampleCharacter
    manyParts.body.nodes = (0..<16).map { i in
        .init(surface: AvatarSurface(type: .mickey, width: 22, height: 22, depth: 22),
              position: [Double(i * 3 - 22), -24, 28], color: "#996688")
    }
    #expect(try capture(manyParts, neutral)[3] == 0)
}

private let sampleCharacter = AvatarCharacter(
    name: "Test Character",
    body: .init(primary: .init(type: .cube, width: 196, height: 174, depth: 146, roundness: 0.72), nodes: [
        .init(surface: .init(type: .sphere, width: 33, height: 39, depth: 28),
              position: [73, 43, 70], color: "#ffd730")
    ]),
    colors: .init(body: "#6194d1", eyes: "#040405"),
    face: .init(eyes: .init(width: 0.69, height: 0.36, gap: 0.83, shiftY: -0.08))
)
