import CoreGraphics
import Foundation
import simd

struct FaceAtlasKey: Equatable {
    let face: AvatarCharacter.Face
    let art: FacePresentation
    let radius: Double
    let lids: Double
    let eyeSize: Double
    let eyeScales: SIMD2<Double>

    init(_ scene: AvatarScene) {
        face = scene.character.face
        art = scene.frame.presentation
        radius = scene.faceRadius
        lids = scene.frame.pose.lids
        eyeSize = scene.frame.pose.eyeSize
        eyeScales = scene.frame.eyeScales
    }
}

func drawAvatarFace(_ face: FaceAtlasKey, in context: CGContext) {
    let build = face.face.eyes
    let radius = face.radius
    let spacing = sin(radians(18.38 * build.gap)) * radius
    let height = -build.shiftY * radius
    let blink = max(0.06, 1 - 0.94 * max(face.lids, face.art.shut))
    let wrap = EyeWrap(radius: radius, gap: build.gap, shiftY: build.shiftY)
    context.setFillColor(gray: 1, alpha: 1)
    context.setStrokeColor(gray: 1, alpha: 1)

    for index in 0..<2 {
        let side = index == 0 ? -1.0 : 1.0
        let eyeSize = face.eyeSize * face.eyeScales[index]
        context.saveGState()
        switch face.art.artwork {
        case .builtin(let expression):
            guard index < expression.eyes.count else {
                context.restoreGState()
                continue
            }
            let eye = expression.eyes[index]
            let path = eyePath(eye)
            let width = radius * build.width * eyeSize
            let minimumGap = max(spacing, 0.02 * radius - path.boundingBoxOfPath.minX * width)
            let placed = CGAffineTransform(scaleX: side * width, y: radius * build.height * eyeSize * blink)
                .concatenating(CGAffineTransform(translationX: side * minimumGap, y: height))
            wrappedFill(path, placed, side: side, wrap: wrap, in: context)
        case .drawn(let drawing):
            let marks = index == 0 ? drawing.left : drawing.right ?? drawing.left
            let mirror = index == 1 && drawing.right == nil
            let unit = 0.006 * radius * eyeSize
            let width = unit * build.width
            let heightScale = -unit * build.height * blink
            let inmost = marks.map { $0.path.cgPath.boundingBoxOfPath }.reduce(CGRect.null) { $0.union($1) }
            let reach = side < 0 ? inmost.maxX - 50 : (mirror ? inmost.maxX - 50 : 50 - inmost.minX)
            let placed = CGAffineTransform(translationX: -50, y: -50)
                .concatenating(CGAffineTransform(scaleX: (mirror ? -1 : 1) * width, y: heightScale))
                .concatenating(CGAffineTransform(translationX: side * max(spacing, 0.02 * radius + width * reach), y: height))
            for mark in marks { paintWrapped(mark, placed, side: side, wrap: wrap, in: context) }
        }
        context.restoreGState()
    }

    if let nose = face.face.nose, nose.enabled {
        let size = CGSize(width: abs(nose.width) / 120, height: abs(nose.height) / 120)
        let shape: CGPath
        switch nose.shape {
        case .ellipse: shape = CGPath(ellipseIn: centered(size), transform: nil)
        case .rounded:
            shape = CGPath(roundedRect: centered(size), cornerWidth: size.width * 0.32,
                           cornerHeight: size.height * 0.32, transform: nil)
        case .invertedTriangle:
            shape = triangle(size: size, inverted: true, rounding: clamp((nose.roundness ?? 50) / 100))
        }
        feature(shape, at: CGPoint(x: nose.x / 120, y: -nose.y / 120), angle: nose.angle, in: context)
    }

    if let mouth = face.face.mouth, mouth.enabled {
        let size = CGSize(width: abs(mouth.width) / 120, height: abs(mouth.height) / 120)
        let shape: CGPath
        switch mouth.shape {
        case .ellipse: shape = CGPath(ellipseIn: centered(size), transform: nil)
        case .rounded:
            shape = CGPath(roundedRect: centered(size), cornerWidth: size.height / 2,
                           cornerHeight: size.height / 2, transform: nil)
        case .roundedTriangle: shape = triangle(size: size, inverted: true, rounding: 0.6)
        case .curve:
            let curve = interpolate(mouth.curve, face.art.smile > 0 ? 85 : -70, abs(face.art.smile))
            let bend = clamp(curve / 100, -1.5, 1.5) * size.width * 0.29
            let path = CGMutablePath()
            path.move(to: CGPoint(x: -size.width / 2, y: bend / 2))
            path.addQuadCurve(to: CGPoint(x: size.width / 2, y: bend / 2),
                              control: CGPoint(x: 0, y: -bend))
            shape = path.copy(strokingWithWidth: max(0.001, size.height), lineCap: .round,
                              lineJoin: .round, miterLimit: 2)
        }
        feature(shape, at: CGPoint(x: mouth.x / 120, y: -mouth.y / 120), angle: mouth.angle, in: context)
    }
}

private func eyePath(_ eye: AvatarFaceShape.Eye) -> CGPath {
    let x = eye.off.first ?? 0
    let y = eye.off.dropFirst().first ?? 0
    let shape = CGMutablePath()
    if eye.oval.count == 2, min(eye.oval[0], eye.oval[1]) > 0.04 {
        shape.addEllipse(in: CGRect(x: x - eye.oval[0], y: y - eye.oval[1],
                                    width: 2 * eye.oval[0], height: 2 * eye.oval[1]))
        return shape
    }
    guard eye.path.count == 18 else { return shape }
    func point(_ offset: Int) -> CGPoint { CGPoint(x: x + eye.path[offset], y: y + eye.path[offset + 1]) }
    func handle(_ offset: Int, _ point: CGPoint) -> CGPoint {
        CGPoint(x: point.x + eye.path[offset], y: point.y + eye.path[offset + 1])
    }
    let first = point(0)
    let middle = point(6)
    let last = point(12)
    if first == middle, middle == last {
        shape.addEllipse(in: CGRect(x: first.x - eye.wid, y: first.y - eye.wid,
                                    width: 2 * eye.wid, height: 2 * eye.wid))
        return shape
    }
    shape.move(to: first)
    shape.addCurve(to: middle, control1: handle(4, first), control2: handle(8, middle))
    shape.addCurve(to: last, control1: handle(10, middle), control2: handle(14, last))
    return shape.copy(strokingWithWidth: max(0.001, 2 * eye.wid), lineCap: .round, lineJoin: .round, miterLimit: 2)
}

private func centered(_ size: CGSize) -> CGRect {
    CGRect(x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height)
}

private func triangle(size: CGSize, inverted: Bool, rounding: Double) -> CGPath {
    let w = size.width / 2
    let h = (inverted ? 1.0 : -1.0) * size.height / 2
    let curve = 0.08 + 0.37 * rounding
    let path = CGMutablePath()
    path.move(to: CGPoint(x: -w * (1 - curve), y: h))
    path.addLine(to: CGPoint(x: w * (1 - curve), y: h))
    path.addQuadCurve(to: CGPoint(x: w * (1 - 0.4 * curve), y: h * (1 - 2 * curve)),
                      control: CGPoint(x: w, y: h))
    path.addLine(to: CGPoint(x: w * curve, y: -h * (1 - 0.6 * curve)))
    path.addQuadCurve(to: CGPoint(x: -w * curve, y: -h * (1 - 0.6 * curve)), control: CGPoint(x: 0, y: -h))
    path.addLine(to: CGPoint(x: -w * (1 - 0.4 * curve), y: h * (1 - 2 * curve)))
    path.addQuadCurve(to: CGPoint(x: -w * (1 - curve), y: h), control: CGPoint(x: -w, y: h))
    path.closeSubpath()
    return path
}

private func feature(_ path: CGPath, at position: CGPoint, angle: Double, in context: CGContext) {
    context.saveGState()
    context.translateBy(x: position.x, y: position.y)
    context.rotate(by: -radians(angle))
    context.addPath(path)
    context.fillPath()
    context.restoreGState()
}

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


/// Lays an eye drawn flat around its place on the ball of the head, as avatar-core's
/// `eyePointOnFace` does, and gives where it lands seen from the front.
private struct EyeWrap {
    let radius: Double
    let gap: Double
    let shiftY: Double

    func apply(_ point: CGPoint, side: Double) -> CGPoint {
        let turn = radians(18.38) * gap
        let placeX = side * sin(turn)
        let placeZ = cos(turn)
        // The flat drawing puts the eye at sin(turn) across: what is beyond is the eye's own frame.
        let outward = side * point.x / radius - sin(turn)
        let up = point.y / radius + shiftY
        let reach = hypot(outward, up)
        guard reach > 1e-9 else { return CGPoint(x: placeX * radius, y: -shiftY * radius) }
        let along = sin(reach) / reach
        let x = cos(reach) * placeX + along * outward * side * placeZ
        return CGPoint(x: x * radius, y: (along * up - shiftY) * radius)
    }

    func wrapped(_ path: CGPath, side: Double) -> CGPath {
        let flat = path.flattened(threshold: 0.0015 * radius)
        let result = CGMutablePath()
        flat.applyWithBlock { element in
            let e = element.pointee
            switch e.type {
            case .moveToPoint: result.move(to: apply(e.points[0], side: side))
            case .addLineToPoint: result.addLine(to: apply(e.points[0], side: side))
            case .closeSubpath: result.closeSubpath()
            default: break
            }
        }
        return result
    }
}

private func wrappedFill(_ path: CGPath, _ placed: CGAffineTransform, side: Double, wrap: EyeWrap,
                         rule: CGPathFillRule = .winding, in context: CGContext) {
    var transform = placed
    guard let onFace = path.copy(using: &transform) else { return }
    context.addPath(wrap.wrapped(onFace, side: side))
    context.fillPath(using: rule)
}

private func paintWrapped(_ mark: AvatarCompiledFace.Mark, _ placed: CGAffineTransform, side: Double,
                          wrap: EyeWrap, in context: CGContext) {
    let path = mark.path.cgPath
    if mark.fill {
        wrappedFill(path, placed, side: side, wrap: wrap, rule: mark.rule == .evenodd ? .evenOdd : .winding, in: context)
    }
    if let stroke = mark.stroke, stroke.width > 0 {
        let cap: CGLineCap = switch stroke.cap ?? .butt { case .round: .round; case .square: .square; case .butt: .butt }
        let join: CGLineJoin = switch stroke.join ?? .miter { case .round: .round; case .bevel: .bevel; case .miter: .miter }
        let outline = path.copy(strokingWithWidth: stroke.width, lineCap: cap, lineJoin: join, miterLimit: 10)
        wrappedFill(outline, placed, side: side, wrap: wrap, in: context)
    }
}
