import CoreGraphics
import Foundation
import simd

// The eyes, as avatar-core's `faces.ts`, `drawnFaces.ts` and `player.ts` make them, function for
// function. An eye is drawn in its own frame: across points away from the middle of the face for
// both eyes, up is up, lengths are in head radii. A built-in eye is a line with a thickness; a
// drawn eye is filled polygons. One face turns into another by the morphs of `faces.ts`, or by a
// blink that shuts the eyes and moves them `towards` each other when a drawn face is involved.

typealias EyePoint = SIMD2<Double>

/// A built-in eye: avatar-core's `FaceEye`.
struct FaceEye: Equatable, Sendable {
    /// Where the eye's middle is from its place on the face: outward, and up.
    var off: EyePoint
    /// How far the top of the eye leans outward, in radians.
    var tilt: Double
    /// Half the thickness of the line.
    var wid: Double
    /// How open the eye is: 1 open.
    var lidY: Double
    /// The radii of the oval the eye turns into, or zeros for none.
    var oval: EyePoint
    /// How far the outline has become the oval while a face morphs towards or away from one.
    var ovalMix: Double?
    /// Three anchors, each `[x, y, inX, inY, outX, outY]`: eighteen numbers.
    var path: [Double]

    init(off: EyePoint, tilt: Double, wid: Double, lidY: Double, oval: EyePoint, ovalMix: Double? = nil,
         path: [Double]) {
        self.off = off
        self.tilt = tilt
        self.wid = wid
        self.lidY = lidY
        self.oval = oval
        self.ovalMix = ovalMix
        self.path = path
    }

    init(_ stored: AvatarFaceShape.Eye) {
        let offX: Double = stored.off.count > 0 ? stored.off[0] : 0
        let offY: Double = stored.off.count > 1 ? stored.off[1] : 0
        let ovalX: Double = stored.oval.count > 0 ? stored.oval[0] : 0
        let ovalY: Double = stored.oval.count > 1 ? stored.oval[1] : 0
        var path = stored.path
        if path.count < 18 { path += Array(repeating: 0, count: 18 - path.count) }
        self.init(off: EyePoint(offX, offY), tilt: 0, wid: stored.wid, lidY: 1, oval: EyePoint(ovalX, ovalY),
                  path: path)
    }
}

/// A drawn eye: avatar-core's `DrawnEye`, filled polygons in the eye's frame.
struct DrawnEye: Equatable, Sendable {
    var shapes: [[EyePoint]]
    /// Whether the shapes are drawn as smooth curves through their points.
    var smooth = false
    /// How far the eye is shut while one face gives way to another: 0 open, 1 shut.
    var shut: Double?
}

/// An eye as the player gives it.
enum PlayerEye: Equatable, Sendable {
    case builtin(FaceEye)
    case drawn(DrawnEye)

    var isDrawn: Bool {
        if case .drawn = self { return true }
        return false
    }
}

private func mixed(_ from: Double, _ to: Double, _ progress: Double) -> Double { from + (to - from) * progress }

private func smoothstep(_ value: Double) -> Double {
    let clamped = max(0, min(1, value))
    return clamped * clamped * (3 - 2 * clamped)
}

// MARK: - Morphs between built-in eyes (`faces.ts`)

/// An oval this small across is whole; a smaller one only rounds the eye towards it.
private let ovalFull = 0.08
private let lineSteps = 10
private let capSteps = 8
/// Closed, an eye is a flat bar this tall for its width.
private let closedEyeRatio = 0.42

private func hasOval(_ eye: FaceEye) -> Bool { eye.oval.x > 1e-4 && eye.oval.y > 1e-4 }

private func ovalShare(_ eye: FaceEye) -> Double {
    eye.ovalMix ?? smoothstep(min(eye.oval.x, eye.oval.y) / ovalFull)
}

func mixEyeShapes(_ from: FaceEye, _ to: FaceEye, _ progress: Double) -> FaceEye {
    var path: [Double] = []
    path.reserveCapacity(from.path.count)
    for index in from.path.indices { path.append(mixed(from.path[index], to.path[index], progress)) }
    let offX: Double = mixed(from.off.x, to.off.x, progress)
    let offY: Double = mixed(from.off.y, to.off.y, progress)
    let ovalX: Double = mixed(from.oval.x, to.oval.x, progress)
    let ovalY: Double = mixed(from.oval.y, to.oval.y, progress)
    var eye = FaceEye(off: EyePoint(offX, offY), tilt: mixed(from.tilt, to.tilt, progress),
                      wid: mixed(from.wid, to.wid, progress), lidY: mixed(from.lidY, to.lidY, progress),
                      oval: EyePoint(ovalX, ovalY), path: path)
    // An eye left halfway to an oval goes on from where its outline is.
    if from.ovalMix != nil || to.ovalMix != nil {
        eye.ovalMix = mixed(ovalShare(from), ovalShare(to), progress)
    }
    return eye
}

/// Whether the line of an eye bends away from the straight line between its ends.
private func isBent(_ eye: FaceEye) -> Bool {
    if hasOval(eye) { return false }
    let line = eyeLine(eye.path, scale: 1)
    guard let first = line.first, let last = line.last else { return false }
    let across: EyePoint = last - first
    let length: Double = simd_dot(across, across)
    if length < 1e-8 { return false }
    var farthest = 0.0
    for point in line {
        let share: Double = simd_dot(point - first, across) / length
        let foot: EyePoint = first + share * across
        farthest = max(farthest, simd_length(point - foot))
    }
    return farthest > max(0.012, eye.wid * 0.2)
}

enum EyeMorph { case numbers, capsule, oval }

/// How the two eyes of a face pass to those of another.
func eyeMorphOf(_ from: [FaceEye], _ to: [FaceEye]) -> EyeMorph {
    if from.contains(where: isBent) || to.contains(where: isBent) { return .numbers }
    return from.contains(where: hasOval) || to.contains(where: hasOval) ? .oval : .capsule
}

/// A capsule: its middle on the face, the angle of its length from up, its half sizes.
private struct Capsule {
    var center: EyePoint
    var angle: Double
    var halfLength: Double
    var halfWidth: Double
}

private func capsuleOf(_ eye: FaceEye) -> Capsule {
    let cosine = cos(eye.tilt)
    let sine = sin(eye.tilt)
    if hasOval(eye) {
        let across = eye.oval.x
        let up = eye.oval.y
        return Capsule(center: eye.off, angle: eye.tilt + (across >= up ? Double.pi / 2 : 0),
                       halfLength: max(across, up), halfWidth: min(across, up))
    }
    let first = EyePoint(eye.path[0], eye.path[1])
    let last = EyePoint(eye.path[12], eye.path[13])
    let middle: EyePoint = (first + last) / 2
    let reach: Double = simd_length(last - first) / 2
    let centerX: Double = eye.off.x + middle.x * cosine + middle.y * sine
    let centerY: Double = eye.off.y - middle.x * sine + middle.y * cosine
    let angle: Double = reach < 1e-9 ? eye.tilt : atan2(last.x - first.x, last.y - first.y) + eye.tilt
    return Capsule(center: EyePoint(centerX, centerY), angle: angle, halfLength: reach + eye.wid, halfWidth: eye.wid)
}

/// The eye drawn as a capsule: a straight line turned to its angle, as thick as the capsule.
private func capsuleEye(_ capsule: Capsule, lidY: Double, ovalMix: Double) -> FaceEye {
    let reach = max(0, capsule.halfLength - capsule.halfWidth)
    let third = reach / 3
    let path: [Double] = [0, -reach, 0, 0, 0, third, 0, 0, 0, -third, 0, third, 0, reach, 0, -third, 0, 0]
    let oval = ovalMix > 1e-4 ? EyePoint(capsule.halfWidth, capsule.halfLength) : EyePoint(0, 0)
    return FaceEye(off: capsule.center, tilt: capsule.angle, wid: capsule.halfWidth, lidY: lidY, oval: oval,
                   ovalMix: ovalMix > 1e-4 ? ovalMix : nil, path: path)
}

/// The turn from one angle to another, the short way: a capsule is the same either way up.
private func turnBetween(_ from: Double, _ to: Double) -> Double {
    var turn = to - from
    while turn > Double.pi / 2 { turn -= Double.pi }
    while turn < -Double.pi / 2 { turn += Double.pi }
    return turn
}

private func capsuleBetween(_ from: Capsule, _ to: Capsule, _ progress: Double) -> Capsule {
    let center = EyePoint(mixed(from.center.x, to.center.x, progress), mixed(from.center.y, to.center.y, progress))
    return Capsule(center: center, angle: from.angle + turnBetween(from.angle, to.angle) * progress,
                   halfLength: max(mixed(from.halfLength, to.halfLength, progress), 1e-4),
                   halfWidth: max(mixed(from.halfWidth, to.halfWidth, progress), 1e-4))
}

/// Towards or away from an oval: a capsule of the oval's size swells into the oval late on the
/// way there and leaves it early on the way back.
private func ovalMorph(_ from: FaceEye, _ to: FaceEye, _ progress: Double) -> FaceEye {
    if progress <= 1e-4 { return from }
    if progress >= 0.995 { return to }
    let start = ovalShare(from)
    let towardsOval = hasOval(to)
    let rest = 1 - progress
    let eased: Double = towardsOval ? 1 - rest * rest * rest : progress * progress * progress
    let share: Double = start + ((towardsOval ? 1 : 0) - start) * eased
    return capsuleEye(capsuleBetween(capsuleOf(from), capsuleOf(to), progress),
                      lidY: mixed(from.lidY, to.lidY, progress), ovalMix: share)
}

/// Between straight eyes: a capsule that turns about its middle the short way.
private func capsuleMorph(_ from: FaceEye, _ to: FaceEye, _ progress: Double) -> FaceEye {
    if progress >= 0.9999 { return to }
    let start = capsuleOf(from)
    let end = capsuleOf(to)
    let halfWidth = max(1e-4, mixed(start.halfWidth, end.halfWidth, progress))
    let straight = mixed(max(0, start.halfLength - start.halfWidth), max(0, end.halfLength - end.halfWidth), progress)
    var capsule = capsuleBetween(start, end, progress)
    capsule.halfLength = straight + halfWidth
    capsule.halfWidth = halfWidth
    return capsuleEye(capsule, lidY: mixed(from.lidY, to.lidY, progress), ovalMix: 0)
}

/// The eyes on their way from one face to another, `progress` from 0 to 1.
func morphEyeShapes(_ from: [FaceEye], _ to: [FaceEye], _ progress: Double) -> [FaceEye] {
    if progress >= 1 { return to }
    let way = eyeMorphOf(from, to)
    return zip(from, to).map { start, end in
        switch way {
        case .oval: ovalMorph(start, end, progress)
        case .capsule: capsuleMorph(start, end, progress)
        case .numbers: mixEyeShapes(start, end, progress)
        }
    }
}

// MARK: - Outlines of built-in eyes

private func cubicAt(_ from: Double, _ first: Double, _ second: Double, _ to: Double, _ progress: Double) -> Double {
    let rest = 1 - progress
    let a: Double = rest * rest * rest * from
    let b: Double = 3 * rest * rest * progress * first
    let c: Double = 3 * rest * progress * progress * second
    let d: Double = progress * progress * progress * to
    return a + b + c + d
}

/// The points of an eye's line, through its three anchors.
private func eyeLine(_ path: [Double], scale: Double) -> [EyePoint] {
    var points: [EyePoint] = []
    for segment in 0..<2 {
        let from = segment * 6
        let to = from + 6
        for step in (segment == 0 ? 0 : 1)...lineSteps {
            let progress = Double(step) / Double(lineSteps)
            let x = cubicAt(path[from], path[from] + path[from + 4], path[to] + path[to + 2], path[to], progress)
            let y = cubicAt(path[from + 1], path[from + 1] + path[from + 5], path[to + 1] + path[to + 3],
                            path[to + 1], progress)
            points.append(EyePoint(scale * x, scale * y))
        }
    }
    return points
}

/// The outline of a line of a given half thickness, with round ends.
private func strokeOutline(_ line: [EyePoint], radius: Double) -> [EyePoint] {
    var length = 0.0
    for index in 1..<max(1, line.count) { length += simd_length(line[index] - line[index - 1]) }
    // A line with no length is a point: its outline is a circle.
    if length < 1e-6 {
        let steps = capSteps * 4
        return (0..<steps).map { step in
            let angle: Double = Double(step) / Double(steps) * Double.pi * 2
            let offset = EyePoint(cos(angle) * radius, sin(angle) * radius)
            return line[0] + offset
        }
    }
    let last = line.count - 1
    func directionAt(_ index: Int) -> EyePoint {
        let delta: EyePoint = line[min(last, index + 1)] - line[max(0, index - 1)]
        let size = simd_length(delta)
        return size > 0 ? delta / size : delta
    }
    var outline: [EyePoint] = []
    // Along one side, round the far end, back along the other side, round the near end.
    for index in 0...last {
        let direction = directionAt(index)
        let offset = EyePoint(-direction.y * radius, direction.x * radius)
        outline.append(line[index] + offset)
    }
    func cap(_ index: Int, _ heading: Double) {
        for step in 1..<capSteps {
            let angle: Double = heading + Double.pi / 2 - Double(step) / Double(capSteps) * Double.pi
            let offset = EyePoint(cos(angle) * radius, sin(angle) * radius)
            outline.append(line[index] + offset)
        }
    }
    let end = directionAt(last)
    cap(last, atan2(end.y, end.x))
    for index in stride(from: last, through: 0, by: -1) {
        let direction = directionAt(index)
        let offset = EyePoint(direction.y * radius, -direction.x * radius)
        outline.append(line[index] + offset)
    }
    let start = directionAt(0)
    cap(0, atan2(-start.y, -start.x))
    return outline
}

/// The outline of an eye in its own frame. `size` scales the eye about its middle, `lids`
/// closes it: 0 open, 1 closed.
func eyeOutline(_ eye: FaceEye, size: Double = 1, lids: Double = 0) -> [EyePoint] {
    var outline = strokeOutline(eyeLine(eye.path, scale: size), radius: eye.wid * size)
    // Towards an oval, each point of the outline moves to the oval's edge in its own direction.
    let share = ovalShare(eye)
    if share > 0 {
        let radiusX = max(eye.oval.x * size, 1e-6)
        let radiusY = max(eye.oval.y * size, 1e-6)
        outline = outline.map { point in
            let distance = simd_length(point) > 0 ? simd_length(point) : 1e-6
            let unit: EyePoint = point / distance
            let edge: Double = 1 / hypot(unit.x / radiusX, unit.y / radiusY)
            let x: Double = mixed(point.x, unit.x * edge, share)
            let y: Double = mixed(point.y, unit.y * edge, share)
            return EyePoint(x, y)
        }
    }
    if lids > 1e-4 {
        // A closing eye is a bar as wide as the eye, which flattens where the eye stands.
        let low = outline.reduce(EyePoint(repeating: .infinity)) { simd_min($0, $1) }
        let high = outline.reduce(EyePoint(repeating: -.infinity)) { simd_max($0, $1) }
        let width = high.x - low.x
        let open = high.y - low.y
        let height: Double = open + (closedEyeRatio * width - open) * min(1, lids)
        let center: EyePoint = (low + high) / 2
        let radius = min(width, height) / 2
        let reach = max(width, height) / 2 - radius
        let along: EyePoint = height >= width ? EyePoint(0, reach) : EyePoint(reach, 0)
        let bar: [EyePoint] = [center - along, center + along]
        outline = strokeOutline(reach < 1e-6 ? [bar[0], bar[0]] : bar, radius: radius)
    }
    let cosine = cos(eye.tilt)
    let sine = sin(eye.tilt)
    return outline.map { point in
        let y: Double = point.y * eye.lidY
        let x: Double = point.x * cosine + y * sine + eye.off.x
        let up: Double = -point.x * sine + y * cosine + eye.off.y
        return EyePoint(x, up)
    }
}

// MARK: - The eyes on the head

/// Where the eyes sit on a head that is a ball of radius one: this far to each side.
private let eyeTurn = 18.38 * Double.pi / 180

/// How far an eye's place is from the middle of the face, along the head, in head radii.
func eyeReach(gap: Double) -> Double { eyeTurn * gap }

/// Lay a point of an eye's frame on the ball of the head, and give where it lands seen from the
/// front: across to the right of the screen, and down.
func eyePointOnFace(side: Double, outward: Double, up: Double, gap: Double) -> EyePoint {
    let turn = eyeTurn * gap
    let placeX = side * sin(turn)
    let placeZ = cos(turn)
    let reach = hypot(outward, up)
    if reach < 1e-9 { return EyePoint(placeX, 0) }
    let along = sin(reach) / reach
    let x: Double = cos(reach) * placeX + along * outward * side * placeZ
    let y: Double = along * up
    return EyePoint(x, -y)
}

// MARK: - Drawn eyes (`drawnFaces.ts`)

/// How many head radii the artboard's 100 units are.
private let artboardUnit = 0.6 / 100
/// Closing a drawn eye squashes it towards a line this far up from its bottom.
private let lidLine = 0.4
/// Shut while a face gives way to another, an eye keeps this much of its height.
private let shutHeight = 0.03

private func signedArea(_ points: [EyePoint]) -> Double {
    var total = 0.0
    for index in points.indices {
        let a = points[index]
        let b = points[(index + 1) % points.count]
        total += a.x * b.y - b.x * a.y
    }
    return total
}

private func counterclockwise(_ polygon: [EyePoint]) -> [EyePoint] {
    signedArea(polygon) < 0 ? polygon.reversed() : polygon
}

private func inside(_ point: EyePoint, _ polygon: [EyePoint]) -> Bool {
    var crossings = false
    var last = polygon.count - 1
    for index in polygon.indices {
        let a = polygon[index]
        let b = polygon[last]
        if (a.y > point.y) != (b.y > point.y) {
            let x: Double = (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
            if point.x < x { crossings.toggle() }
        }
        last = index
    }
    return crossings
}

/// The fill of a mark's polygons, turned so that `nonzero` draws what the mark's rule draws.
private func fillShapes(_ polygons: [[EyePoint]], rule: AvatarFaceMark.FillRule) -> [[EyePoint]] {
    let usable = polygons.filter { $0.count >= 3 && abs(signedArea($0)) > 1e-12 }
    guard let largest = usable.max(by: { abs(signedArea($0)) < abs(signedArea($1)) }) else { return [] }
    if rule == .evenodd {
        return usable.enumerated().map { index, polygon in
            var depth = 0
            for (other, outer) in usable.enumerated() where other != index && inside(polygon[0], outer) { depth += 1 }
            let turned = counterclockwise(polygon)
            return depth % 2 == 1 ? turned.reversed() : turned
        }
    }
    let flip = signedArea(largest) < 0
    return usable.map { flip ? $0.reversed() : $0 }
}

/// The subpaths of a flattened path, as points.
private func polylines(_ path: CGPath) -> [[CGPoint]] {
    var lines: [[CGPoint]] = []
    path.applyWithBlock { element in
        let item = element.pointee
        switch item.type {
        case .moveToPoint: lines.append([item.points[0]])
        case .addLineToPoint:
            if lines.isEmpty { lines.append([]) }
            lines[lines.count - 1].append(item.points[0])
        default: break
        }
    }
    return lines
}

/// The subpaths of a path, each its own path.
private func subpaths(_ path: CGPath) -> [CGPath] {
    var result: [CGMutablePath] = []
    path.applyWithBlock { element in
        let item = element.pointee
        if item.type == .moveToPoint || result.isEmpty { result.append(CGMutablePath()) }
        let current = result[result.count - 1]
        switch item.type {
        case .moveToPoint: current.move(to: item.points[0])
        case .addLineToPoint: current.addLine(to: item.points[0])
        case .addQuadCurveToPoint: current.addQuadCurve(to: item.points[1], control: item.points[0])
        case .addCurveToPoint: current.addCurve(to: item.points[2], control1: item.points[0], control2: item.points[1])
        case .closeSubpath: current.closeSubpath()
        @unknown default: break
        }
    }
    return result
}

/// Read the marks of one eye into its shapes, in the eye's frame. `side` is -1 for the eye on
/// the left of the screen, whose outward is to the left, and 1 for the right one. Fills and
/// strokes are flattened and outlined by CoreGraphics where avatar-core does it by hand.
func drawnEyeShapes(_ marks: [AvatarCompiledFace.Mark], side: Double) -> [[EyePoint]] {
    let tolerance = 0.15
    func toFrame(_ point: CGPoint) -> EyePoint {
        EyePoint(side * (point.x - 50) * artboardUnit, -(point.y - 50) * artboardUnit)
    }
    var shapes: [[EyePoint]] = []
    for mark in marks {
        let path = mark.path.cgPath
        if mark.fill {
            let lines = polylines(path.flattened(threshold: tolerance)).map { $0.map(toFrame) }
            shapes += fillShapes(lines, rule: mark.rule)
        }
        if let stroke = mark.stroke, stroke.width > 0 {
            let cap: CGLineCap = switch stroke.cap ?? .butt { case .round: .round; case .square: .square; case .butt: .butt }
            let join: CGLineJoin = switch stroke.join ?? .miter { case .round: .round; case .bevel: .bevel; case .miter: .miter }
            for line in subpaths(path) {
                let outline = line.copy(strokingWithWidth: stroke.width, lineCap: cap, lineJoin: join, miterLimit: 4)
                let pieces = polylines(outline.flattened(threshold: tolerance)).map { $0.map(toFrame) }
                shapes += fillShapes(pieces, rule: .nonzero)
            }
        }
    }
    return shapes
}

/// The shapes of a drawn eye as they are drawn: scaled by `size`, closed by `lids` towards its
/// lid line, and by `shut` down to a hair.
func drawnEyeShapes(_ eye: DrawnEye, size: Double = 1, lids: Double = 0) -> [[EyePoint]] {
    let shut = max(0, min(1, eye.shut ?? 0))
    let closing = max(0, min(1, lids))
    var shapes = eye.shapes.map { shape in shape.map { $0 * size } }
    if closing <= 1e-4, shut <= 1e-4 { return shapes }
    var low = EyePoint(repeating: .infinity)
    var high = EyePoint(repeating: -.infinity)
    for shape in shapes {
        for point in shape {
            low = simd_min(low, point)
            high = simd_max(high, point)
        }
    }
    let height = high.y - low.y
    guard height > 0 else { return shapes }
    let closedShare: Double = min(1, closedEyeRatio * (high.x - low.x) / height)
    let lidded: Double = 1 + (closedShare - 1) * closing
    let kept: Double = lidded * (1 + (shutHeight - 1) * shut)
    let line: Double = low.y + lidLine * height
    shapes = shapes.map { shape in shape.map { EyePoint($0.x, line + ($0.y - line) * kept) } }
    return shapes
}

// MARK: - A blink from one face to another (`player.ts`)

/// A built-in eye as shapes, to shut it as a drawn eye shuts.
func asDrawn(_ eye: PlayerEye) -> DrawnEye {
    switch eye {
    case .drawn(let drawn): drawn
    case .builtin(let face): DrawnEye(shapes: [eyeOutline(face)], smooth: true)
    }
}

struct EyeBounds {
    var center: EyePoint
    var width: Double
}

func boundsOf(_ eye: DrawnEye) -> EyeBounds {
    var low = EyePoint(repeating: .infinity)
    var high = EyePoint(repeating: -.infinity)
    for shape in eye.shapes {
        for point in shape {
            low = simd_min(low, point)
            high = simd_max(high, point)
        }
    }
    guard low.x.isFinite else { return EyeBounds(center: .zero, width: 0) }
    return EyeBounds(center: (low + high) / 2, width: high.x - low.x)
}

/// An eye moved and stretched across from where it is towards a box between two.
func towards(_ eye: DrawnEye, from: EyeBounds, to: EyeBounds, amount: Double) -> DrawnEye {
    guard amount > 0, from.width > 1e-6 else { return eye }
    let stretch: Double = 1 + (to.width / from.width - 1) * amount
    let x: Double = from.center.x + (to.center.x - from.center.x) * amount
    let y: Double = from.center.y + (to.center.y - from.center.y) * amount
    var moved = eye
    moved.shapes = eye.shapes.map { shape in
        shape.map { point -> EyePoint in
            let movedX: Double = x + (point.x - from.center.x) * stretch
            let movedY: Double = point.y - from.center.y + y
            return EyePoint(movedX, movedY)
        }
    }
    return moved
}
