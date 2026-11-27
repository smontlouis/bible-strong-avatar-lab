import CoreGraphics
import Foundation
import simd

// The face as avatar-core's `renderCharacterFrame` lays it on the head. Each mark is an outline
// given as seen from the front of the head, which drops straight onto its front sheet: the eyes
// wrapped on the ball by `eyePointOnFace`, the nose and the mouth by `canonicalFaceCoordinates`.
// The renderer draws these outlines into a mask atlas indexed by the head's local x and y, one
// slice per mark, and the shader finds them again on the head it ray-marches.

/// How far the face is from its middle in avatar-core's own units, where 120 is one body unit.
private let designRadius = 120.0

/// One mark of the face, as the atlas draws it.
struct FaceFeature: Equatable, Sendable {
    /// Closed shapes in the head's local front coordinates: body units, y up. Filled together
    /// under the `nonzero` rule, as SVG fills one path.
    var shapes: [[SIMD2<Double>]]
    /// Whether each shape is a curve through its points (avatar-core's `smoothClosedPath`)
    /// rather than straight lines between them.
    var smooth: Bool

    static let none = FaceFeature(shapes: [], smooth: false)
}

/// The marks of the face in the order of the atlas's slices: the eye on the left of the screen,
/// the one on the right, the nose, the mouth.
func faceFeatures(_ scene: AvatarScene) -> [FaceFeature] {
    let face = scene.character.face
    return [eyeFeature(scene, index: 0), eyeFeature(scene, index: 1),
            face.nose.map(noseFeature) ?? .none,
            face.mouth.map { mouthFeature($0, smile: scene.frame.smile) } ?? .none]
}

// MARK: - Eyes (`eyeOutlineOnFace`)

/// The least room each eye leaves between itself and the middle of the face, in head radii.
private let eyeClearance = 0.02

private func eyeFeature(_ scene: AvatarScene, index: Int) -> FaceFeature {
    let eyes = scene.frame.presentation.eyes
    guard index < eyes.count else { return .none }
    let build = scene.character.face.eyes
    let radius = scene.faceRadius
    let side: Double = index == 0 ? -1 : 1
    let size: Double = scene.frame.eyeScales[index] * scene.frame.pose.eyeSize
    let lids = scene.frame.pose.lids
    let shapes: [[EyePoint]]
    let smooth: Bool
    switch eyes[index] {
    case .builtin(let eye):
        shapes = [eyeOutline(eye, size: size, lids: lids)]
        smooth = true
    case .drawn(let eye):
        shapes = drawnEyeShapes(eye, size: size, lids: lids)
        smooth = eye.smooth
    }
    // The two eyes never touch: an eye that comes too near the middle of the face is moved
    // outward, whole, by what it lacks.
    var innermost = Double.infinity
    for shape in shapes {
        for point in shape { innermost = min(innermost, point.x * build.width) }
    }
    let clear = max(0, eyeClearance - (eyeReach(gap: build.gap) + innermost))
    let placed: [[SIMD2<Double>]] = shapes.map { shape in
        shape.map { point in
            let outward: Double = point.x * build.width + clear
            let up: Double = point.y * build.height
            let onFace = eyePointOnFace(side: side, outward: outward, up: up, gap: build.gap)
            // Seen from the front, y down, then turned to the atlas's y up.
            let placedX: Double = onFace.x * radius
            let placedY: Double = -(onFace.y + build.shiftY) * radius
            return SIMD2<Double>(placedX, placedY)
        }
    }
    return FaceFeature(shapes: placed, smooth: smooth)
}

// MARK: - Nose and mouth (`nosePoints`, `mouthPoints`)

private typealias MarkPoint = SIMD2<Double>

/// The point of the face at canonical coordinates: across and down along the ball of radius
/// 120, seen from the front.
private func canonicalFacePoint(_ x: Double, _ y: Double) -> MarkPoint {
    let longitude = x / designRadius
    let latitude = y / designRadius
    return MarkPoint(designRadius * cos(latitude) * sin(longitude), designRadius * sin(latitude))
}

/// A mark's outline, turned by its angle and placed at its middle, laid on the face.
private func faceMark(_ x: Double, _ y: Double, angle degrees: Double, _ points: [MarkPoint]) -> FaceFeature {
    let angle = radians(degrees)
    let cosine = cos(angle)
    let sine = sin(angle)
    let placed: [SIMD2<Double>] = points.map { point in
        let turnedX: Double = point.x * cosine - point.y * sine
        let turnedY: Double = point.x * sine + point.y * cosine
        let onFace = canonicalFacePoint(x + turnedX, y + turnedY)
        return SIMD2(onFace.x / designRadius, -onFace.y / designRadius)
    }
    return FaceFeature(shapes: [placed], smooth: false)
}

private func ellipseMark(_ width: Double, _ height: Double) -> [MarkPoint] {
    (0..<56).map { index in
        let angle = Double(index) / 56 * Double.pi * 2
        return MarkPoint(cos(angle) * width * 0.5, sin(angle) * height * 0.5)
    }
}

private func densified(_ points: [MarkPoint], samples: Int = 14) -> [MarkPoint] {
    var result: [MarkPoint] = []
    for (index, point) in points.enumerated() {
        let next = points[(index + 1) % points.count]
        for sample in 0..<samples {
            let progress = Double(sample) / Double(samples)
            let along: MarkPoint = (next - point) * progress
            result.append(point + along)
        }
    }
    return result
}

private func triangleMark(_ width: Double, _ height: Double, inverted: Bool = false) -> [MarkPoint] {
    let sign: Double = inverted ? -1 : 1
    return densified([MarkPoint(0, -height / 2 * sign), MarkPoint(width / 2, height / 2 * sign),
                      MarkPoint(-width / 2, height / 2 * sign)])
}

private func roundedTriangleMark(_ width: Double, _ height: Double, roundness: Double,
                                 inverted: Bool = false) -> [MarkPoint] {
    let sign: Double = inverted ? -1 : 1
    let corners = [MarkPoint(0, -height / 2 * sign), MarkPoint(width / 2, height / 2 * sign),
                   MarkPoint(-width / 2, height / 2 * sign)]
    let cornerCut = clamp(roundness / 100) * 0.5
    if cornerCut == 0 { return densified(corners) }
    var points: [MarkPoint] = []
    for (index, corner) in corners.enumerated() {
        let previous = corners[(index + corners.count - 1) % corners.count]
        let next = corners[(index + 1) % corners.count]
        let entry: MarkPoint = corner + (previous - corner) * cornerCut
        let exit: MarkPoint = corner + (next - corner) * cornerCut
        for sample in 0..<14 {
            let progress = Double(sample) / 13
            let inverse = 1 - progress
            let a: MarkPoint = (inverse * inverse) * entry
            let b: MarkPoint = (2 * inverse * progress) * corner
            let c: MarkPoint = (progress * progress) * exit
            points.append(a + b + c)
        }
    }
    return points
}

/// avatar-core's `roundedRectangle`: straight sides sampled every 1.5 units, quarter arcs of 14.
private func roundedRectangle(_ width: Double, _ height: Double, roundness: Double = 1) -> [MarkPoint] {
    let halfWidth = width / 2
    let halfHeight = height / 2
    let corner = min(halfHeight, halfWidth) * clamp(roundness)
    var points: [MarkPoint] = []
    func line(_ start: MarkPoint, _ end: MarkPoint) {
        let samples = max(2, Int((simd_length(end - start) / 1.5).rounded(.up)))
        let step: MarkPoint = (end - start) / Double(samples)
        for index in 0..<samples {
            let along: MarkPoint = step * Double(index)
            points.append(start + along)
        }
    }
    func arc(_ centerX: Double, _ centerY: Double, _ startAngle: Double) {
        for index in 0..<14 {
            let angle: Double = startAngle + Double(index) / 14 * (Double.pi / 2)
            points.append(MarkPoint(centerX + cos(angle) * corner, centerY + sin(angle) * corner))
        }
    }
    line(MarkPoint(-halfWidth + corner, -halfHeight), MarkPoint(halfWidth - corner, -halfHeight))
    arc(halfWidth - corner, -halfHeight + corner, -Double.pi / 2)
    line(MarkPoint(halfWidth, -halfHeight + corner), MarkPoint(halfWidth, halfHeight - corner))
    arc(halfWidth - corner, halfHeight - corner, 0)
    line(MarkPoint(halfWidth - corner, halfHeight), MarkPoint(-halfWidth + corner, halfHeight))
    arc(-halfWidth + corner, halfHeight - corner, Double.pi / 2)
    line(MarkPoint(-halfWidth, halfHeight - corner), MarkPoint(-halfWidth, -halfHeight + corner))
    arc(-halfWidth + corner, -halfHeight + corner, Double.pi)
    return points
}

private func noseFeature(_ nose: AvatarCharacter.Nose) -> FaceFeature {
    guard nose.enabled else { return .none }
    let points: [MarkPoint]
    switch nose.shape {
    case .ellipse: points = ellipseMark(nose.width, nose.height)
    case .rounded: points = roundedRectangle(nose.width, nose.height, roundness: 1)
    case .invertedTriangle:
        points = roundedTriangleMark(nose.width, nose.height, roundness: nose.roundness ?? 50, inverted: true)
    }
    return faceMark(nose.x, nose.y, angle: nose.angle, points)
}

// How far the corners of a mouth go up for a face that smiles, and down for one that does not.
private let smilingCurve = 85.0
private let frowningCurve = -70.0

/// A line of a mouth: a parabola with round ends, as thick as the mouth is tall.
private func curveMouth(width: Double, height: Double, curve rawCurve: Double) -> [MarkPoint] {
    let halfWidth = max(1, width / 2)
    let halfHeight = max(0.5, height / 2)
    let curve = max(-1, min(1, rawCurve / 100))
    let depth: Double = curve * width * 0.28
    let curveSteps = 28
    let capSteps = 32
    struct Sample { var center: MarkPoint; var normal: MarkPoint; var tangent: MarkPoint }
    let line: [Sample] = (0...curveSteps).map { index in
        let progress = Double(index) / Double(curveSteps)
        let x: Double = -halfWidth + width * progress
        let normalizedX: Double = x / halfWidth
        let y: Double = depth * (1 - normalizedX * normalizedX)
        let slope: Double = -2 * depth * x / (halfWidth * halfWidth)
        let length = hypot(1, slope)
        return Sample(center: MarkPoint(x, y), normal: MarkPoint(-slope / length, 1 / length),
                      tangent: MarkPoint(1 / length, slope / length))
    }
    func cap(_ sample: Sample, from start: Double) -> [MarkPoint] {
        (0...capSteps).map { index in
            let angle: Double = start + Double(index) / Double(capSteps) * Double.pi
            let along: MarkPoint = cos(angle) * sample.tangent
            let across: MarkPoint = sin(angle) * sample.normal
            let offset: MarkPoint = (along + across) * halfHeight
            return sample.center + offset
        }
    }
    var points: [MarkPoint] = line.map { sample -> MarkPoint in
        let offset: MarkPoint = sample.normal * halfHeight
        return sample.center - offset
    }
    let bottom: [MarkPoint] = line.reversed().map { sample -> MarkPoint in
        let offset: MarkPoint = sample.normal * halfHeight
        return sample.center + offset
    }
    points.append(contentsOf: cap(line[line.count - 1], from: -Double.pi / 2).dropFirst())
    points.append(contentsOf: bottom.dropFirst())
    points.append(contentsOf: cap(line[0], from: Double.pi / 2).dropFirst())
    return points
}

private func mouthFeature(_ mouth: AvatarCharacter.Mouth, smile: Double) -> FaceFeature {
    guard mouth.enabled else { return .none }
    let points: [MarkPoint]
    switch mouth.shape {
    case .ellipse: points = ellipseMark(mouth.width, mouth.height)
    case .roundedTriangle: points = triangleMark(mouth.width, mouth.height)
    case .rounded: points = roundedRectangle(mouth.width, mouth.height, roundness: 1)
    case .curve:
        // The character's mouth as the face asks for it: only a mouth drawn as a line bends.
        var curve = mouth.curve
        if smile != 0 { curve += ((smile > 0 ? smilingCurve : frowningCurve) - curve) * abs(smile) }
        points = curveMouth(width: mouth.width, height: mouth.height, curve: curve)
    }
    return faceMark(mouth.x, mouth.y, angle: mouth.angle, points)
}

// MARK: - Drawing

/// Fill a mark in a context whose units are the atlas's: body units, y up.
func drawFaceFeature(_ feature: FaceFeature, in context: CGContext) {
    let path = CGMutablePath()
    for shape in feature.shapes where shape.count >= 2 {
        let points = shape.map { CGPoint(x: $0.x, y: $0.y) }
        path.move(to: points[0])
        if feature.smooth, points.count >= 3 {
            // avatar-core's `smoothClosedPath`: a cubic through each pair of points.
            let count = points.count
            for index in 0..<count {
                let previous = points[(index + count - 1) % count]
                let point = points[index]
                let next = points[(index + 1) % count]
                let afterNext = points[(index + 2) % count]
                let first = CGPoint(x: point.x + (next.x - previous.x) / 6, y: point.y + (next.y - previous.y) / 6)
                let second = CGPoint(x: next.x - (afterNext.x - point.x) / 6, y: next.y - (afterNext.y - point.y) / 6)
                path.addCurve(to: next, control1: first, control2: second)
            }
        } else {
            for point in points.dropFirst() { path.addLine(to: point) }
        }
        path.closeSubpath()
    }
    guard !path.isEmpty else { return }
    context.setFillColor(gray: 1, alpha: 1)
    context.addPath(path)
    context.fillPath(using: .winding)
}

// MARK: - Which marks face the viewer

/// A point of the head's front sheet and its normal, at local front coordinates in design units
/// with y up: avatar-core's `surfaceFrontSampleAt` for spheres, capsules, cubes and diamonds. The
/// other shapes are taken as the ellipsoid of their size.
private func frontSample(_ surface: AvatarSurface, _ x: Double, _ y: Double) -> (point: SIMD3<Double>, normal: SIMD3<Double>) {
    let radiusX: Double = surface.width == 0 ? 1 : surface.width / 2
    let radiusY: Double = surface.height == 0 ? 1 : surface.height / 2
    let radiusZ: Double = surface.depth == 0 ? 1 : surface.depth / 2
    func ellipsoid(_ radiusY: Double, centerY: Double) -> (SIMD3<Double>, SIMD3<Double>) {
        let localY = y - centerY
        let a: Double = (x / radiusX) * (x / radiusX)
        let b: Double = (localY / radiusY) * (localY / radiusY)
        let z: Double = radiusZ * sqrt(max(0, 1 - a - b))
        let normalX: Double = x / (radiusX * radiusX)
        let normalY: Double = localY / (radiusY * radiusY)
        let normalZ: Double = z / (radiusZ * radiusZ)
        let normal = SIMD3<Double>(normalX, normalY, normalZ)
        return (SIMD3<Double>(x, y, z), simd_normalize(normal))
    }
    func lp(_ exponent: Double) -> (SIMD3<Double>, SIMD3<Double>) {
        guard exponent.isFinite else {
            let clampedX: Double = max(-radiusX, min(radiusX, x))
            let clampedY: Double = max(-radiusY, min(radiusY, y))
            return (SIMD3<Double>(clampedX, clampedY, radiusZ), SIMD3<Double>(0, 0, 1))
        }
        let normalizedY = max(-1, min(1, y / radiusY))
        let available: Double = pow(max(0, 1 - pow(abs(normalizedY), exponent)), 1 / exponent)
        let surfaceX = max(-radiusX * available, min(radiusX * available, x))
        let normalizedX = surfaceX / radiusX
        let rest: Double = 1 - pow(abs(normalizedX), exponent) - pow(abs(normalizedY), exponent)
        let normalizedZ: Double = pow(max(0, rest), 1 / exponent)
        func signed(_ value: Double) -> Double { value < 0 ? -pow(-value, exponent - 1) : pow(value, exponent - 1) }
        let normalX: Double = signed(normalizedX) / radiusX
        let normalY: Double = signed(normalizedY) / radiusY
        let normalZ: Double = signed(normalizedZ) / radiusZ
        let normal = SIMD3<Double>(normalX, normalY, normalZ)
        let length: Double = simd_length(normal)
        let point = SIMD3<Double>(surfaceX, normalizedY * radiusY, radiusZ * normalizedZ)
        if length > 0 { return (point, normal / length) }
        return (point, SIMD3<Double>(0, 0, 1))
    }
    let roundness = max(0, min(2, surface.roundness))
    switch surface.type {
    case .capsule:
        let cap = min(radiusX, radiusY)
        let straight = max(0, radiusY - cap)
        return ellipsoid(cap, centerY: max(-straight, min(straight, y)))
    case .cube:
        return roundness <= 0 ? lp(.infinity) : lp(2 / (0.04 + roundness / 2 * 0.96))
    case .diamond:
        return lp(1 + roundness / 2)
    default:
        return ellipsoid(radiusY, centerY: 0)
    }
}

/// Which marks face the viewer, as avatar-core's `facesViewer` decides it: the normals of their
/// points, turned with the head, lean towards the viewer on the whole. And whether one of the
/// marks shown has a point past the horizon of the head, which the SVG renderer still draws.
func faceFeatureVisibility(_ features: [FaceFeature], scene: AvatarScene) -> (shown: [Bool], pastHorizon: Bool) {
    guard let head = scene.parts.first else { return (features.map { _ in false }, false) }
    let surface = scene.character.body.primary
    let turn = normalizedQuaternion(head.orientation)
    let perspective = scene.character.face.perspective
    let focal: Double = perspective > 0.0001 ? 620 / designRadius / perspective : 0
    let camera = SIMD3<Double>(0, 0, focal)
    var pastHorizon = false
    let shown: [Bool] = features.map { feature in
        var total = 0.0
        var behind = false
        for shape in feature.shapes {
            for point in shape {
                let sample = frontSample(surface, point.x * designRadius, point.y * designRadius)
                let normal = turn.act(sample.normal)
                total += normal.z
                let position: SIMD3<Double> = turn.act(sample.point / designRadius) + head.center
                let toViewer: SIMD3<Double> = perspective > 0.0001 ? camera - position : SIMD3(0, 0, 1)
                if simd_dot(normal, toViewer) < 0 { behind = true }
            }
        }
        let visible = total > 0
        if visible, behind { pastHorizon = true }
        return visible
    }
    return (shown, pastHorizon)
}

// MARK: - Spinner marks

func drawSpinnerMarks(_ marks: [AvatarSpinnerMark], radius: Double, in context: CGContext) {
    context.saveGState()
    context.scaleBy(x: radius, y: -radius)
    context.setFillColor(gray: 1, alpha: 1)
    context.setStrokeColor(gray: 1, alpha: 1)
    context.setLineCap(.round)
    context.setLineJoin(.round)

    for mark in marks {
        context.saveGState()
        switch mark {
        case .disc(let center, let r, let opacity):
            context.setAlpha(clamp(opacity))
            context.fillEllipse(in: CGRect(x: center.x - r, y: center.y - r, width: 2 * r, height: 2 * r))
        case .ring(let r, let width, let share, let opacity):
            context.setAlpha(clamp(opacity))
            context.setLineWidth(width)
            if let share, share < 1 {
                let start = -Double.pi / 2
                context.addArc(center: .zero, radius: r, startAngle: start, endAngle: start + 2 * .pi * share, clockwise: false)
                context.strokePath()
            } else {
                context.strokeEllipse(in: CGRect(x: -r, y: -r, width: 2 * r, height: 2 * r))
            }
        case .line(let points, let width, let opacity):
            context.setAlpha(clamp(opacity))
            context.setLineWidth(width)
            context.addLines(between: points.map { CGPoint(x: $0.x, y: $0.y) })
            context.strokePath()
        case .bar(let center, let size, let bottom, let turn, let pivot, let scale, let opacity):
            context.setAlpha(clamp(opacity))
            context.translateBy(x: pivot.x, y: pivot.y)
            context.rotate(by: radians(turn))
            context.translateBy(x: center.x - pivot.x, y: center.y - pivot.y)
            context.scaleBy(x: scale, y: scale)
            let topRadius = size.x / 2
            let bottomRadius = bottom / 2
            let h = size.y / 2
            let topY = -h + topRadius
            let bottomY = h - bottomRadius
            let path = CGMutablePath()
            path.move(to: CGPoint(x: -topRadius, y: topY))
            path.addArc(center: CGPoint(x: 0, y: topY), radius: topRadius, startAngle: .pi, endAngle: 2 * .pi, clockwise: false)
            path.addLine(to: CGPoint(x: bottomRadius, y: bottomY))
            path.addArc(center: CGPoint(x: 0, y: bottomY), radius: bottomRadius, startAngle: 0, endAngle: .pi, clockwise: false)
            path.closeSubpath()
            context.addPath(path)
            context.fillPath()
        }
        context.restoreGState()
    }
    context.restoreGState()
}
