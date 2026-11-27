import Foundation

/// Geometry and colors. Motion belongs to the catalogue and engine.
public struct AvatarCharacter: Codable, Equatable, Sendable {
    public var name: String?
    public var body: Body
    public var colors: Colors
    public var style: Style?
    public var face: Face

    public init(name: String? = nil, body: Body, colors: Colors, style: Style? = nil, face: Face = .init()) {
        self.name = name
        self.body = body
        self.colors = colors
        self.style = style
        self.face = face
    }

    public struct Body: Codable, Equatable, Sendable {
        public var primary: AvatarSurface
        public var nodes: [Node]

        public init(primary: AvatarSurface, nodes: [Node] = []) {
            self.primary = primary
            self.nodes = nodes
        }
    }

    public struct Node: Codable, Equatable, Sendable {
        public var surface: AvatarSurface
        public var position: [Double]
        public var rotation: [Double]
        public var color: String?
        public var followsHead: Bool?

        public init(surface: AvatarSurface, position: [Double] = [0, 0, 0],
                    rotation: [Double] = [0, 0, 0], color: String? = nil,
                    followsHead: Bool? = nil) {
            self.surface = surface
            self.position = position
            self.rotation = rotation
            self.color = color
            self.followsHead = followsHead
        }
    }

    public struct Colors: Codable, Equatable, Sendable {
        public var body: String
        public var eyes: String

        public init(body: String, eyes: String) {
            self.body = body
            self.eyes = eyes
        }
    }

    public struct Style: Codable, Equatable, Sendable {
        public var outline: Outline?

        public init(outline: Outline? = nil) {
            self.outline = outline
        }
    }

    public struct Outline: Codable, Equatable, Sendable {
        public var enabled: Bool
        public var color: String
        public var width: Double
        public var opacity: Double

        public init(enabled: Bool = true, color: String, width: Double, opacity: Double = 1) {
            self.enabled = enabled
            self.color = color
            self.width = width
            self.opacity = opacity
        }
    }

    public struct Face: Codable, Equatable, Sendable {
        public var eyes: Eyes
        public var perspective: Double
        public var nose: Nose?
        public var mouth: Mouth?

        public init(eyes: Eyes = .init(), perspective: Double = 1, nose: Nose? = nil, mouth: Mouth? = nil) {
            self.eyes = eyes
            self.perspective = perspective
            self.nose = nose
            self.mouth = mouth
        }
    }

    public struct Eyes: Codable, Equatable, Sendable {
        public var width: Double
        public var height: Double
        public var gap: Double
        /// Downward shift, in face radii.
        public var shiftY: Double

        public init(width: Double = 1, height: Double = 1, gap: Double = 1, shiftY: Double = 0) {
            self.width = width
            self.height = height
            self.gap = gap
            self.shiftY = shiftY
        }
    }

    public struct Nose: Codable, Equatable, Sendable {
        public enum Shape: String, Codable, Sendable {
            case ellipse, rounded
            case invertedTriangle = "inverted-triangle"
        }

        public var enabled: Bool
        public var shape: Shape
        public var roundness: Double?
        public var width: Double
        public var height: Double
        public var x: Double
        public var y: Double
        public var angle: Double

        public init(enabled: Bool = true, shape: Shape = .invertedTriangle, roundness: Double? = nil,
                    width: Double, height: Double, x: Double = 0, y: Double = 22, angle: Double = 0) {
            self.enabled = enabled
            self.shape = shape
            self.roundness = roundness
            self.width = width
            self.height = height
            self.x = x
            self.y = y
            self.angle = angle
        }
    }

    public struct Mouth: Codable, Equatable, Sendable {
        public enum Shape: String, Codable, Sendable {
            case curve, ellipse, rounded
            case roundedTriangle = "rounded-triangle"
        }

        public var enabled: Bool
        public var shape: Shape
        public var curve: Double
        public var width: Double
        public var height: Double
        public var x: Double
        public var y: Double
        public var angle: Double

        public init(enabled: Bool = true, shape: Shape = .curve, curve: Double = 45,
                    width: Double, height: Double, x: Double = 0, y: Double = 35, angle: Double = 0) {
            self.enabled = enabled
            self.shape = shape
            self.curve = curve
            self.width = width
            self.height = height
            self.x = x
            self.y = y
            self.angle = angle
        }
    }
}

public struct AvatarSurface: Codable, Equatable, Sendable {
    public enum Kind: String, Codable, CaseIterable, Sendable {
        case sphere, mickey, cursor, cube, capsule, cylinder, cone, diamond, trapezoid
    }

    public var type: Kind
    public var width: Double
    public var height: Double
    public var depth: Double
    public var roundness: Double
    public var morphRoundness: Double?
    public var tipRoundness: Double?
    public var baseRoundness: Double?
    public var topScale: Double?
    public var bottomScale: Double?

    public init(type: Kind, width: Double, height: Double, depth: Double, roundness: Double = 1,
                morphRoundness: Double? = nil, tipRoundness: Double? = nil,
                baseRoundness: Double? = nil, topScale: Double? = nil, bottomScale: Double? = nil) {
        self.type = type
        self.width = width
        self.height = height
        self.depth = depth
        self.roundness = roundness
        self.morphRoundness = morphRoundness
        self.tipRoundness = tipRoundness
        self.baseRoundness = baseRoundness
        self.topScale = topScale
        self.bottomScale = bottomScale
    }
}

enum AvatarResources {
    static func data(_ name: String, extension fileExtension: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: fileExtension) else {
            throw CocoaError(.fileNoSuchFile, userInfo: [NSFilePathErrorKey: "\(name).\(fileExtension)"])
        }
        return try Data(contentsOf: url)
    }

    static func json<Value: Decodable>(_ name: String) throws -> Value {
        try JSONDecoder().decode(Value.self, from: data(name, extension: "json"))
    }
}
