import Foundation
import simd

/// A renderable snapshot with the head and each attached surface in world space.
public struct AvatarScene: Equatable, Sendable {
    public struct Part: Equatable, Sendable {
        public var surface: AvatarSurface
        /// In body units where 120 design units equal 1. Y points upward.
        public var center: SIMD3<Double>
        /// Quaternion in w, x, y, z order.
        public var orientation: SIMD4<Double>
        public var color: String
    }

    public let character: AvatarCharacter
    public let frame: AvatarFrame
    public let parts: [Part]
    public let translation: SIMD2<Double>
    public let scale: SIMD2<Double>
    public let bodyRadius: Double
    public let faceRadius: Double
}

public func renderCharacterFrame(_ character: AvatarCharacter, _ frame: AvatarFrame) -> AvatarScene {
    let primary = character.body.primary
    let bodyRadius = (primary.width + primary.height) / 480
    let faceRadius = min(primary.width, primary.height) / 240
    let rotation = rotationQuaternion(frame.pose.rotation)
    let whole = frame.orientation.map { rotation * normalizedQuaternion($0) } ?? rotation
    let identity = rotationQuaternion(.zero)
    var parts: [AvatarScene.Part] = []

    func append(_ surface: AvatarSurface, at center: SIMD3<Double>, with quaternion: simd_quatd,
                color: String) {
        let value = SIMD4(quaternion.real, quaternion.imag.x, quaternion.imag.y, quaternion.imag.z)
        parts.append(.init(surface: surface, center: center, orientation: value, color: color))
    }

    func expanded(_ surface: AvatarSurface, at center: SIMD3<Double>, with quaternion: simd_quatd,
                  color: String) {
        switch surface.type {
        case .mickey:
            var main = surface
            main.type = .sphere
            append(main, at: center, with: quaternion, color: color)
            let ear = AvatarSurface(type: .sphere, width: surface.width * 0.47, height: surface.width * 0.47,
                                    depth: surface.depth * 0.51)
            for side in [-1.0, 1.0] {
                let position = SIMD3(side * surface.width * 0.35, surface.height * 0.44, -surface.depth * 0.10) / 120
                append(ear, at: center + quaternion.act(position), with: quaternion, color: color)
            }
        case .cursor:
            var main = surface
            main.type = .cylinder
            main.width *= 0.54
            main.depth *= 0.62
            main.height *= 0.64
            let down = SIMD3(0.0, -surface.height * 0.18 / 120, 0.0)
            append(main, at: center + quaternion.act(down), with: quaternion, color: color)
            let tip = AvatarSurface(type: .cone, width: surface.width, height: surface.height * 0.36,
                                    depth: surface.depth, roundness: surface.roundness)
            let up = SIMD3(0.0, surface.height * 0.32 / 120, 0.0)
            append(tip, at: center + quaternion.act(up), with: quaternion, color: color)
        default:
            append(surface, at: center, with: quaternion, color: color)
        }
    }

    expanded(primary, at: .zero, with: whole, color: character.colors.body)
    for node in character.body.nodes.prefix(16) {
        guard node.position.count == 3, node.rotation.count == 3 else { continue }
        let parent = node.followsHead == false ? identity : whole
        let offset = SIMD3(node.position[0], -node.position[1], node.position[2]) / 120
        let angle = SIMD3(node.rotation[0], node.rotation[1], node.rotation[2])
        expanded(node.surface, at: parent.act(offset), with: parent * rotationQuaternion(angle),
                 color: node.color ?? character.colors.body)
    }

    let zoom = clamp(frame.pose.zoom, 0.05, 8) / AvatarPose.restZoom
    let squash = SIMD2(clamp(frame.pose.squash.x, 0.05, 8), clamp(frame.pose.squash.y, 0.05, 8))
    let anchor = frame.squashAnchor * (1 - squash.y) * primary.height / 240
    let scale = zoom * squash
    let translation = zoom * SIMD2(frame.pose.position.x * bodyRadius, frame.pose.position.y * bodyRadius + anchor)
    return AvatarScene(character: character, frame: frame, parts: parts, translation: translation,
                       scale: scale, bodyRadius: bodyRadius, faceRadius: faceRadius)
}
