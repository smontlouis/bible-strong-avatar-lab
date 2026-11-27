import CoreGraphics
import Foundation

public struct AvatarFaceMark: Codable, Equatable, Sendable {
    public enum FillRule: String, Codable, Sendable { case nonzero, evenodd }

    public struct Stroke: Codable, Equatable, Sendable {
        public enum Cap: String, Codable, Sendable { case round, butt, square }
        public enum Join: String, Codable, Sendable { case round, miter, bevel }

        public var width: Double
        public var cap: Cap?
        public var join: Join?

        public init(width: Double, cap: Cap? = nil, join: Join? = nil) {
            self.width = width
            self.cap = cap
            self.join = join
        }
    }

    public var d: String
    public var fill: Bool?
    public var fillRule: FillRule?
    public var stroke: Stroke?

    public init(d: String, fill: Bool? = nil, fillRule: FillRule? = nil, stroke: Stroke? = nil) {
        self.d = d
        self.fill = fill
        self.fillRule = fillRule
        self.stroke = stroke
    }
}

public struct AvatarDrawnFace: Codable, Equatable, Sendable {
    public struct Eyes: Codable, Equatable, Sendable {
        public var left: [AvatarFaceMark]
        public var right: [AvatarFaceMark]?

        public init(left: [AvatarFaceMark], right: [AvatarFaceMark]? = nil) {
            self.left = left
            self.right = right
        }
    }

    public var name: String
    public var blinks: Bool?
    public var smile: Double?
    public var eyes: Eyes?
    public var svg: String?

    public init(name: String, eyes: Eyes, blinks: Bool? = nil, smile: Double? = nil) {
        self.name = name
        self.eyes = eyes
        self.blinks = blinks
        self.smile = smile
    }

    public init(name: String, svg: String, blinks: Bool? = nil, smile: Double? = nil) {
        self.name = name
        self.svg = svg
        self.blinks = blinks
        self.smile = smile
    }
}

public struct AvatarCompiledFace: Equatable, Sendable {
    public struct Mark: Equatable, Sendable {
        public let path: AvatarPath
        public let fill: Bool
        public let rule: AvatarFaceMark.FillRule
        public let stroke: AvatarFaceMark.Stroke?
    }

    public let name: String
    public let blinks: Bool
    public let smile: Double
    public let left: [Mark]
    public let right: [Mark]?
}

public struct AvatarFaceError: LocalizedError, Equatable, Sendable {
    public let message: String
    public var errorDescription: String? { message }
}

public func faceNameProblem(_ name: String) -> String? {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return "A face needs a name." }
    if trimmed != name { return "Remove spaces at the ends of the name." }
    let lower = name.lowercased()
    if AvatarCatalogue.faceNames.contains(lower) || AvatarCatalogue.faceAliases[lower] != nil || lower == "blink" {
        return "This is the name of a built-in face."
    }
    return nil
}

public func compileFace(_ definition: AvatarDrawnFace) throws -> (face: AvatarCompiledFace, problems: [String]) {
    if let problem = faceNameProblem(definition.name) { throw AvatarFaceError(message: problem) }
    let smile = definition.smile ?? 0
    guard (-1...1).contains(smile) else { throw AvatarFaceError(message: "Smile must be between -1 and 1.") }
    let given: AvatarDrawnFace.Eyes
    var problems: [String] = []
    if let svg = definition.svg {
        let imported = try faceEyesFromSVG(svg)
        given = imported.eyes
        problems = imported.ignored
    } else if let eyes = definition.eyes {
        given = eyes
    } else {
        throw AvatarFaceError(message: "A face requires eyes or SVG.")
    }

    func make(_ marks: [AvatarFaceMark], side: String) -> [AvatarCompiledFace.Mark] {
        var usedCommands = 0
        var result: [AvatarCompiledFace.Mark] = []
        for (index, mark) in marks.enumerated() {
            do {
                let path = try parseAvatarPath(mark.d)
                guard usedCommands + path.commands.count <= 600 else {
                    problems.append("\(side) eye: artwork exceeds 600 path commands.")
                    break
                }
                if let stroke = mark.stroke, !stroke.width.isFinite || stroke.width < 0 {
                    throw AvatarFaceError(message: "Stroke width is invalid.")
                }
                if mark.fill != false || (mark.stroke?.width ?? 0) > 0 {
                    result.append(.init(path: path, fill: mark.fill != false, rule: mark.fillRule ?? .nonzero,
                                        stroke: mark.stroke))
                    usedCommands += path.commands.count
                }
            } catch {
                problems.append("\(side) eye mark \(index + 1): \(error.localizedDescription)")
            }
        }
        return result
    }

    let left = make(given.left, side: "Left")
    let right = given.right.map { make($0, side: "Right") }
    guard !left.isEmpty, right?.isEmpty != true else { throw AvatarFaceError(message: "An eye has no drawable marks.") }
    return (.init(name: definition.name, blinks: definition.blinks ?? true, smile: smile,
                  left: left, right: right), problems)
}

public struct AvatarLibrary: Equatable, Sendable {
    public var clips: [String: AvatarClip]
    public var states: [String: AvatarState]
    public var faces: [String: AvatarCompiledFace]

    public init(clips: [String: AvatarClip] = [:], states: [String: AvatarState] = [:],
                faces: [String: AvatarCompiledFace] = [:]) {
        self.clips = clips
        self.states = states
        self.faces = faces
    }
}

public struct AvatarLibraryRead: Equatable, Sendable {
    public let library: AvatarLibrary
    public let problems: [String]
}

/// Reads exported Studio libraries. A broken item does not discard the remaining items.
public func readAvatarLibrary(_ data: Data) throws -> AvatarLibraryRead {
    guard let root = try JSONSerialization.jsonObject(with: data) as? JSONObject else {
        throw AvatarFaceError(message: "Expected a library object.")
    }
    var library = AvatarLibrary()
    var problems: [String] = []
    let decoder = JSONDecoder()

    func readItems<T: Decodable>(_ key: String, _ transform: (String, T) throws -> Void) {
        guard let raw = root[key] else { return }
        guard let rawItems = raw as? [Any] else {
            problems.append("\(key) must be an array.")
            return
        }
        var names = Set<String>()
        for raw in rawItems {
            guard let item = raw as? JSONObject, let name = item["name"] as? String, !name.isEmpty else {
                problems.append("An item in \(key) has no name.")
                continue
            }
            guard names.insert(name).inserted else {
                problems.append("\(key) '\(name)' is given twice.")
                continue
            }
            do {
                let object = try JSONSerialization.data(withJSONObject: item)
                try transform(name, decoder.decode(T.self, from: object))
            } catch {
                problems.append("\(key) '\(name)': \(error.localizedDescription)")
            }
        }
    }

    readItems("clips") { (name: String, clip: AvatarClip) in
        if let problem = clip.problem { throw AvatarFaceError(message: problem) }
        library.clips[name] = clip
    }
    readItems("states") { (name: String, state: AvatarState) in
        guard !state.clips.isEmpty, state.holdSeconds.map({ $0 >= 0 && $0.isFinite }) ?? true else {
            throw AvatarFaceError(message: "A state needs clips and a finite hold time.")
        }
        library.states[name] = state
    }
    var faceProblems: [String] = []
    readItems("faces") { (name: String, definition: AvatarDrawnFace) in
        let read = try compileFace(definition)
        library.faces[name] = read.face
        faceProblems += read.problems.map { "Face '\(name)': \($0)" }
    }
    return .init(library: library, problems: problems + faceProblems)
}

struct AvatarFaceShape: Codable, Equatable, Sendable {
    var blinks: Bool
    var eyes: [Eye]

    struct Eye: Codable, Equatable, Sendable {
        var off: [Double]
        var wid: Double
        var oval: [Double]
        var path: [Double]
    }

    static func mix(_ a: Self, _ b: Self, _ t: Double) -> Self {
        Self(blinks: t < 0.5 ? a.blinks : b.blinks,
             eyes: zip(a.eyes, b.eyes).map { x, y in
                 Eye(off: zip(x.off, y.off).map { interpolate($0, $1, t) },
                     wid: interpolate(x.wid, y.wid, t),
                     oval: zip(x.oval, y.oval).map { interpolate($0, $1, t) },
                     path: zip(x.path, y.path).map { interpolate($0, $1, t) })
             })
    }
}

enum FaceArtwork: Equatable, Sendable {
    case builtin(AvatarFaceShape)
    case drawn(AvatarCompiledFace)
}

struct FacePresentation: Equatable, Sendable {
    var name: String
    var artwork: FaceArtwork
    var smile: Double

    var blinks: Bool {
        switch artwork {
        case .builtin(let face): face.blinks
        case .drawn(let face): face.blinks
        }
    }

    static func resolve(_ name: String, library: AvatarLibrary) -> Self {
        if let face = library.faces[name] { return .init(name: name, artwork: .drawn(face), smile: face.smile) }
        let key = AvatarCatalogue.resolveFaceName(name)
        let smiles = ["happy": 1.0, "sad": -1.0, "sleepy": 0.15, "squinted": -0.1,
                      "calm": 0.4, "confused": -0.35]
        return .init(name: key, artwork: .builtin(AvatarCatalogue.builtinFaces[key]!), smile: smiles[key] ?? 0)
    }
}
