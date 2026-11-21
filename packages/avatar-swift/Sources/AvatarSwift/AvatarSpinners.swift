import Foundation

public enum AvatarSpinnerPattern: String, CaseIterable, Codable, Sendable {
    case dots, orbit, radar, progress, gather, wave, send, receive, dock, ball, pencil, bang, standby

    public static let modes: [String: Self] = [
        "thinking": .dots, "orbit": .orbit, "radar": .radar, "progress": .progress, "spawning": .gather,
        "dictating": .wave, "sending": .send, "receiving": .receive, "uploading": .dock,
        "bouncing": .ball, "writing": .pencil, "alerting": .bang, "powering-down": .standby,
    ]

    var shotSeconds: Double? {
        switch self {
        case .progress: 2.5
        case .gather: 2
        default: nil
        }
    }
}

public enum AvatarSpinnerMark: Equatable, Sendable {
    case disc(center: SIMD2<Double>, radius: Double, opacity: Double)
    case ring(radius: Double, width: Double, share: Double?, opacity: Double)
    case line(points: [SIMD2<Double>], width: Double, opacity: Double)
    case bar(center: SIMD2<Double>, size: SIMD2<Double>, bottom: Double, turn: Double,
             pivot: SIMD2<Double>, scale: Double, opacity: Double)
}

public struct AvatarSpinnerCore: Equatable, Sendable {
    public var radius: Double
    public var position: SIMD2<Double> = .zero
    public var turn = 0.0
    public var opacity = 1.0
    public var drop = false
}

public struct AvatarSpinnerDrawing: Equatable, Sendable {
    public var core: AvatarSpinnerCore
    public var marks: [AvatarSpinnerMark]
}

public struct AvatarSpinnerFrame: Equatable, Sendable {
    public let pattern: AvatarSpinnerPattern
    public let amount: Double
    public let round: Double
    public let core: AvatarSpinnerCore
    public let marks: [AvatarSpinnerMark]
}

public func drawSpinner(_ pattern: AvatarSpinnerPattern, weight: Double, time: Double, shot: Double) -> AvatarSpinnerDrawing {
    let weight = clamp(weight)
    let unit = 114.2705
    let radii: [AvatarSpinnerPattern: Double] = [
        .dots: 22, .orbit: 19, .radar: 19, .progress: 19, .gather: 19, .wave: 16, .send: 20,
        .receive: 20, .dock: 20, .ball: 18, .pencil: 17, .bang: 13, .standby: 13,
    ]
    var core = AvatarSpinnerCore(radius: (radii[pattern] ?? 19) / unit)
    var marks: [AvatarSpinnerMark] = []
    func out(_ t: Double) -> Double { 1 - pow(1 - t, 3) }
    func back(_ t: Double) -> Double { 1 + 2.70158 * pow(t - 1, 3) + 1.70158 * pow(t - 1, 2) }
    func fract(_ t: Double) -> Double { t - floor(t) }
    func disc(_ x: Double, _ y: Double, _ r: Double, _ opacity: Double) {
        if r > 0, opacity > 0.004 { marks.append(.disc(center: SIMD2(x, y) / unit, radius: r / unit, opacity: opacity)) }
    }
    func ring(_ r: Double, _ width: Double, _ opacity: Double, _ share: Double? = nil) {
        if width > 0, opacity > 0.004 { marks.append(.ring(radius: r / unit, width: width / unit, share: share, opacity: opacity)) }
    }

    let shown = out(weight)
    switch pattern {
    case .dots:
        let phase = fract(time / 1.4 + 0.119)
        func swell(_ slot: Double) -> Double {
            let apart = abs(phase - slot / 3)
            return exp(-pow(min(apart, 1 - apart), 2) / 0.045)
        }
        for (side, slot, arrived) in [(-1.0, 0.0, weight), (1.0, 2.0, clamp((weight - 0.12) / 0.88))] {
            let size = swell(slot)
            disc(side * 62 * back(arrived), -9 * size * weight, 22 * out(arrived) * (0.84 + 0.22 * size) * 1.02,
                 out(arrived) * (0.5 + 0.5 * size))
        }
        let middle = swell(1)
        core.radius *= interpolate(1, 0.84 + 0.22 * middle, weight)
        core.position.y = -9 * middle * weight * weight / unit
        core.opacity = interpolate(1, 0.5 + 0.5 * middle, weight)
    case .orbit:
        let reach = 52 * back(weight)
        for i in 0..<5 {
            let angle = 1.7 * time + Double(i) * 2 * .pi / 5
            let near = cos(angle)
            disc(reach * sin(angle), -0.42 * reach * near, max(12 * (0.5 + 0.5 * clamp(near)) * shown, 0.3),
                 clamp((near + 0.4) / 0.6, 0.18, 1) * shown)
        }
    case .radar:
        for i in 0..<3 {
            let spread = fract(time / 1.3 + Double(i) / 3)
            ring(interpolate(19, 104, spread), 3.4 * (1 - 0.55 * spread), shown * (1 - spread) * 0.9)
        }
    case .progress:
        let r = 62 * back(weight)
        ring(r, 5, 0.16 * shown)
        ring(r, 5, shown, clamp(shot / (2.5 * 0.85)))
    case .gather:
        for slot in 0..<5 {
            let slot = Double(slot)
            let arrived = clamp((shot / 2 - slot * 0.09) / 0.62)
            guard arrived < 1 else { continue }
            let eased = out(arrived)
            let angle = 2.4 * slot + 2.2 * arrived
            let distance = 96 * (1 - eased)
            disc(distance * cos(angle), 0.8 * distance * sin(angle), 9 * (0.5 + 0.5 * eased) * shown,
                 shown * clamp(5 * arrived) * (1 - 0.25 * eased))
        }
    case .wave:
        for slot in [-2.0, -1.0, 1.0, 2.0] {
            let far = abs(slot)
            let arrived = clamp((weight - 0.1 * far) / (1 - 0.1 * far))
            let motion = 0.42 + 0.29 * sin(2.1 * time) * sin(3.4 * time) + 0.29 * sin(1.3 * time + 1.7)
            let level = motion * (0.55 + 0.45 * sin(12 * time - 1.05 * far))
            disc(44 * slot * back(arrived), -6 * clamp(level) * arrived, (7 + 9 * clamp(level, 0.08, 1)) * out(arrived), arrived)
        }
    case .send:
        let cycle = fract(time / 1.5)
        func flight(_ delay: Double) -> Double {
            let t = clamp((cycle - 0.18 - delay) / 0.55)
            return t * t * (0.4 + 0.6 * t)
        }
        let packet = flight(0)
        disc(0.74 * 108 * packet, -0.62 * 108 * packet, 10 * (1 - 0.55 * packet) * shown, shown * (1 - packet * packet))
        if cycle > 0.44 {
            let streak = flight(0.26)
            disc(0.74 * 108 * streak, -0.62 * 108 * streak, 5 * (1 - 0.6 * streak), 0.3 * shown * (1 - streak))
        }
        let launched = clamp((cycle - 0.18) / 0.3)
        if cycle > 0.18 { ring(20 + 34 * out(launched), 2.8 * (1 - launched), 0.8 * shown * (1 - launched)) }
        if cycle < 0.18 { core.radius *= 1 - 0.06 * sin(.pi * cycle / 0.18) * weight }
        else if cycle < 0.42 { core.radius *= 1 + 0.05 * sin(.pi * (cycle - 0.18) / 0.24) * weight }
    case .receive:
        let turn = time / 1.7
        let cycle = fract(turn)
        var random = AvatarRandom(seed: UInt32(truncatingIfNeeded: Int64(floor(turn))))
        let angle = (-1.25 + 1.5 * random.next()) * .pi
        let coming = clamp(cycle / 0.6)
        let eased = out(coming)
        let distance = 108 * (1 - eased)
        let bow = 18 * sin(.pi * coming) * (1 - 0.7 * eased)
        disc(cos(angle) * distance - sin(angle) * bow, sin(angle) * distance + cos(angle) * bow,
             3.5 + 6.5 * eased, shown * clamp(3.5 * coming) * (0.3 + 0.7 * eased))
        let taken = clamp((cycle - 0.58) / 0.32)
        if cycle > 0.58 { ring(20 + 26 * out(taken), 2.8 * (1 - taken), 0.8 * shown * (1 - taken)) }
        core.radius *= 1 + 0.11 * sin(.pi * clamp((cycle - 0.58) / 0.34)) * weight
    case .dock:
        for i in 0..<2 {
            let i = Double(i)
            let arrived = clamp((time - (0.2 + 1.3 * i)) / 0.9)
            let eased = out(arrived)
            let angle = 1.1 * time + i * .pi
            disc(interpolate(-120 + 30 * i, 42 * sin(angle), eased),
                 interpolate(95, 21 * cos(angle) + 2 * sin(3 * time + i), eased),
                 (7 + 3 * eased) * shown, shown * clamp(4 * arrived))
        }
    case .ball:
        let fall = 0.2719
        let phase = fract((time - fall) / 0.62)
        let height = time < fall ? 541.1 * time * time : 40 - 208 * phase * (1 - phase)
        core.position.y = height * weight / unit
    case .pencil:
        let phase = fract(time / 2.5)
        let writes = 0.68
        func writing(_ t: Double) -> SIMD2<Double> {
            let wiggle = 3.2 * sin(24 * t) * clamp(t / 0.08) * clamp((1 - t) / 0.08)
            return SIMD2(-54 + 118 * smooth(t), 26 + wiggle)
        }
        var start = 0.0
        var end = 1.0
        var point: SIMD2<Double>
        var turn = 17 + sin(0.6 * time)
        if phase < writes {
            end = phase / writes
            point = writing(end)
            point.y = interpolate(26, point.y, 0.5)
        } else {
            let share = (phase - writes) / (1 - writes)
            let eased = share < 0.5 ? 4 * pow(share, 3) : 1 - pow(-2 * share + 2, 3) / 2
            point = SIMD2(64 - 118 * eased, 26 - 20 * sin(.pi * eased))
            turn -= 2 * sin(.pi * eased)
            start = clamp((phase - writes) * 2.5 * 120 / 64)
        }
        core.drop = true
        core.position = point * weight / unit
        core.turn = turn * weight
        if end > start, weight > 0.004 {
            let points = (0...48).map { step in
                (writing(interpolate(start, end, Double(step) / 48)) + SIMD2(0, 19)) / unit
            }
            marks.append(.line(points: points, width: 6 / unit, opacity: clamp(1.2 * weight)))
        }
        let shaft = clamp(1.6 * weight - 0.3)
        if shaft > 0.004 {
            let angle = radians(turn - 90)
            let center = core.position + SIMD2(cos(angle), sin(angle)) * (68 * weight / unit)
            marks.append(.bar(center: center, size: SIMD2(30, 88) / unit, bottom: 30 / unit,
                              turn: turn * weight, pivot: center, scale: shown, opacity: shaft))
        }
    case .bang:
        let since = time.truncatingRemainder(dividingBy: 2.2)
        let shake = exp(-5.5 * since)
        core.position.y = 58 * weight / unit
        core.radius *= 1 + 0.04 * shake * weight
        let opacity = clamp(1.5 * weight - 0.2)
        if opacity > 0.004 {
            let height = -22 - 70 * (1 - out(clamp(1.1 * weight)))
            marks.append(.bar(center: SIMD2(0, height / unit), size: SIMD2(30, 96) / unit, bottom: 17 / unit,
                              turn: 2.2 * sin(42 * time) * shake, pivot: SIMD2(0, -74 / unit),
                              scale: clamp(1.2 * weight), opacity: opacity))
        }
    case .standby:
        let breath = 0.5 + 0.5 * sin(1.6 * time)
        disc(0, 0, 26 + 7 * breath, shown * (0.06 + 0.1 * breath))
        core.opacity = 1 - (0.28 + 0.2 * sin(1.6 * time)) * weight
    }
    return .init(core: core, marks: marks)
}
