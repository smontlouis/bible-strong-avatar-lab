import CoreGraphics
import Foundation
import simd

/// A native path kept as value data so animation frames can be passed across actors.
public struct AvatarPath: Equatable, Sendable {
    public enum Command: Equatable, Sendable {
        case move(SIMD2<Double>)
        case line(SIMD2<Double>)
        case quadratic(control: SIMD2<Double>, end: SIMD2<Double>)
        case cubic(first: SIMD2<Double>, second: SIMD2<Double>, end: SIMD2<Double>)
        case close
    }

    public let commands: [Command]

    public init(_ commands: [Command]) { self.commands = commands }

    public var cgPath: CGPath {
        let path = CGMutablePath()
        func point(_ value: SIMD2<Double>) -> CGPoint { CGPoint(x: value.x, y: value.y) }
        for command in commands {
            switch command {
            case .move(let to): path.move(to: point(to))
            case .line(let to): path.addLine(to: point(to))
            case .quadratic(let control, let to): path.addQuadCurve(to: point(to), control: point(control))
            case .cubic(let a, let b, let to): path.addCurve(to: point(to), control1: point(a), control2: point(b))
            case .close: path.closeSubpath()
            }
        }
        return path
    }

    func transformed(by transform: CGAffineTransform) -> AvatarPath {
        func apply(_ point: SIMD2<Double>) -> SIMD2<Double> {
            let result = CGPoint(x: point.x, y: point.y).applying(transform)
            return SIMD2(result.x, result.y)
        }
        return AvatarPath(commands.map {
            switch $0 {
            case .move(let p): .move(apply(p))
            case .line(let p): .line(apply(p))
            case .quadratic(let a, let p): .quadratic(control: apply(a), end: apply(p))
            case .cubic(let a, let b, let p): .cubic(first: apply(a), second: apply(b), end: apply(p))
            case .close: .close
            }
        })
    }

    var svg: String {
        func point(_ value: SIMD2<Double>) -> String { "\(value.x) \(value.y)" }
        return commands.map {
            switch $0 {
            case .move(let p): "M" + point(p)
            case .line(let p): "L" + point(p)
            case .quadratic(let a, let p): "Q" + point(a) + " " + point(p)
            case .cubic(let a, let b, let p): "C" + point(a) + " " + point(b) + " " + point(p)
            case .close: "Z"
            }
        }.joined()
    }
}

public struct AvatarPathError: LocalizedError, Equatable, Sendable {
    public let offset: Int
    public var errorDescription: String? { "Invalid SVG path at UTF-8 byte \(offset)." }
}

public func parseAvatarPath(_ input: String) throws -> AvatarPath {
    var parser = SVGPathParser(input)
    return try parser.parse()
}

/// A polyline approximation for tools that need points instead of curves.
public func flattenPath(_ input: String) throws -> [[SIMD2<Double>]] {
    let path = try parseAvatarPath(input)
    var paths: [[SIMD2<Double>]] = []
    var point = SIMD2<Double>.zero
    var start = point
    for command in path.commands {
        switch command {
        case .move(let to):
            paths.append([to])
            point = to
            start = to
        case .line(let to):
            if !paths.isEmpty { paths[paths.count - 1].append(to) }
            point = to
        case .quadratic(let control, let to):
            if !paths.isEmpty {
                for step in 1...12 {
                    let t = Double(step) / 12
                    let u = 1 - t
                    paths[paths.count - 1].append(u * u * point + 2 * u * t * control + t * t * to)
                }
            }
            point = to
        case .cubic(let first, let second, let to):
            if !paths.isEmpty {
                for step in 1...16 {
                    let t = Double(step) / 16
                    let u = 1 - t
                    let a = (u * u * u) * point + (3 * u * u * t) * first
                    let b = (3 * u * t * t) * second + (t * t * t) * to
                    paths[paths.count - 1].append(a + b)
                }
            }
            point = to
        case .close:
            if !paths.isEmpty, point != start { paths[paths.count - 1].append(start) }
            point = start
        }
    }
    return paths
}

private struct SVGPathParser {
    let bytes: [UInt8]
    var index = 0
    var commands: [AvatarPath.Command] = []
    var point = SIMD2<Double>.zero
    var start = SIMD2<Double>.zero
    var control: SIMD2<Double>?
    var previous: UInt8 = 0

    init(_ input: String) { bytes = Array(input.utf8) }

    mutating func parse() throws -> AvatarPath {
        var active: UInt8 = 0
        while true {
            skipSeparators()
            guard index < bytes.count else { break }
            let candidate = bytes[index]
            if (65...90).contains(candidate) || (97...122).contains(candidate) {
                active = candidate
                index += 1
            }
            let kind = upper(active)
            guard !commands.isEmpty || kind == 77 else { throw failure }
            let relative = active >= 97
            let oldPoint = point
            let oldControl = control
            control = nil
            switch kind {
            case 77:
                point = try readPoint(relative)
                start = point
                commands.append(.move(point))
                active = relative ? 108 : 76
            case 76:
                point = try readPoint(relative)
                commands.append(.line(point))
            case 72:
                let x = try readNumber()
                point.x = x + (relative ? oldPoint.x : 0)
                commands.append(.line(point))
            case 86:
                let y = try readNumber()
                point.y = y + (relative ? oldPoint.y : 0)
                commands.append(.line(point))
            case 67, 83:
                let first: SIMD2<Double>
                if kind == 67 { first = try readPoint(relative) }
                else if previous == 67 || previous == 83, let oldControl { first = 2 * point - oldControl }
                else { first = point }
                let second = try readPoint(relative)
                let to = try readPoint(relative)
                commands.append(.cubic(first: first, second: second, end: to))
                point = to
                control = second
            case 81, 84:
                let handle: SIMD2<Double>
                if kind == 81 { handle = try readPoint(relative) }
                else if previous == 81 || previous == 84, let oldControl { handle = 2 * point - oldControl }
                else { handle = point }
                let to = try readPoint(relative)
                commands.append(.quadratic(control: handle, end: to))
                point = to
                control = handle
            case 65:
                let rx = try readNumber()
                let ry = try readNumber()
                let angle = try readNumber()
                let large = try readFlag()
                let sweep = try readFlag()
                let to = try readPoint(relative)
                commands += arc(from: point, to: to, rx: abs(rx), ry: abs(ry),
                                angle: radians(angle), large: large, sweep: sweep)
                point = to
            case 90:
                commands.append(.close)
                point = start
                active = 0
            default:
                throw failure
            }
            previous = kind
        }
        guard !commands.isEmpty else { throw failure }
        return AvatarPath(commands)
    }

    private mutating func readPoint(_ relative: Bool) throws -> SIMD2<Double> {
        let x = try readNumber()
        let y = try readNumber()
        return SIMD2(x, y) + (relative ? point : .zero)
    }

    private var failure: AvatarPathError { AvatarPathError(offset: index) }

    private func upper(_ byte: UInt8) -> UInt8 { byte >= 97 ? byte - 32 : byte }

    private mutating func skipSeparators() {
        while index < bytes.count, [9, 10, 13, 32, 44].contains(bytes[index]) { index += 1 }
    }

    private mutating func readFlag() throws -> Bool {
        skipSeparators()
        guard index < bytes.count, bytes[index] == 48 || bytes[index] == 49 else { throw failure }
        defer { index += 1 }
        return bytes[index] == 49
    }

    private mutating func readNumber() throws -> Double {
        skipSeparators()
        let start = index
        if index < bytes.count, bytes[index] == 43 || bytes[index] == 45 { index += 1 }
        consumeDigits()
        if index < bytes.count, bytes[index] == 46 {
            index += 1
            consumeDigits()
        }
        if index < bytes.count, bytes[index] == 69 || bytes[index] == 101 {
            index += 1
            if index < bytes.count, bytes[index] == 43 || bytes[index] == 45 { index += 1 }
            consumeDigits()
        }
        let token = String(decoding: bytes[start..<index], as: UTF8.self)
        guard let value = Double(token), value.isFinite, abs(value) <= 1e8 else { throw failure }
        return value
    }

    private mutating func consumeDigits() {
        while index < bytes.count, (48...57).contains(bytes[index]) { index += 1 }
    }
}

private func arc(from: SIMD2<Double>, to: SIMD2<Double>, rx: Double, ry: Double, angle: Double,
                 large: Bool, sweep: Bool) -> [AvatarPath.Command] {
    guard from != to else { return [] }
    guard rx > 1e-10, ry > 1e-10 else { return [.line(to)] }
    let cosine = cos(angle)
    let sine = sin(angle)
    let delta = (from - to) / 2
    let local = SIMD2(cosine * delta.x + sine * delta.y, -sine * delta.x + cosine * delta.y)
    let grow = max(1, simd_length(local / SIMD2(rx, ry)))
    let radii = SIMD2(rx, ry) * grow
    let normalized = local / radii
    let size = simd_length_squared(normalized)
    guard size > 1e-14 else { return [.line(to)] }
    let sign = large == sweep ? -1.0 : 1.0
    let reach: Double = sign * sqrt(max(0, (1 - size) / size))
    let across = SIMD2<Double>(normalized.y, -normalized.x)
    let localCenter: SIMD2<Double> = reach * across
    let initial = normalized - localCenter
    let final = -normalized - localCenter
    let start = atan2(initial.y, initial.x)
    var span = atan2(initial.x * final.y - initial.y * final.x, simd_dot(initial, final))
    if sweep, span < 0 { span += 2 * .pi }
    if !sweep, span > 0 { span -= 2 * .pi }
    let segments = max(1, Int(ceil(abs(span) / (.pi / 2))))
    let step = span / Double(segments)

    func point(_ p: SIMD2<Double>) -> SIMD2<Double> {
        let local = (p + localCenter) * radii
        return SIMD2(cosine * local.x - sine * local.y, sine * local.x + cosine * local.y) + (from + to) / 2
    }

    return (0..<segments).map { index in
        let begin = start + Double(index) * step
        let end = begin + step
        let first = SIMD2(cos(begin), sin(begin))
        let last = SIMD2(cos(end), sin(end))
        let control = 4.0 / 3.0 * tan(step / 4)
        return .cubic(first: point(first + SIMD2(-first.y, first.x) * control),
                      second: point(last - SIMD2(-last.y, last.x) * control),
                      end: index == segments - 1 ? to : point(last))
    }
}
