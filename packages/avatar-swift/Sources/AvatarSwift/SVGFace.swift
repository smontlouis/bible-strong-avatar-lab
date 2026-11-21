import CoreGraphics
import Foundation

/// Imports the eye artboard supported by Avatar Lab. Unsupported SVG elements are reported.
public func faceEyesFromSVG(_ svg: String) throws -> (eyes: AvatarDrawnFace.Eyes, ignored: [String]) {
    let reader = SVGFaceReader()
    let parser = XMLParser(data: Data(svg.utf8))
    parser.shouldResolveExternalEntities = false
    parser.delegate = reader
    if parser.parse() { return reader.finish() }
    let fragment = SVGFaceReader()
    let wrapped = XMLParser(data: Data(("<g>" + svg + "</g>").utf8))
    wrapped.shouldResolveExternalEntities = false
    wrapped.delegate = fragment
    if wrapped.parse() { return fragment.finish() }
    throw AvatarFaceError(message: parser.parserError?.localizedDescription ?? "Invalid SVG.")
}

public func faceFromSVG(_ definition: AvatarDrawnFace) throws -> (face: AvatarDrawnFace, ignored: [String]) {
    guard let svg = definition.svg else { return (definition, []) }
    let imported = try faceEyesFromSVG(svg)
    return (.init(name: definition.name, eyes: imported.eyes, blinks: definition.blinks, smile: definition.smile),
            imported.ignored)
}

private final class SVGFaceReader: NSObject, XMLParserDelegate {
    struct Style {
        var fill = true
        var rule: AvatarFaceMark.FillRule = .nonzero
        var stroke = false
        var strokeWidth = 1.0
        var cap: AvatarFaceMark.Stroke.Cap?
        var join: AvatarFaceMark.Stroke.Join?

        func applying(_ attributes: [String: String]) -> Self {
            var style = self
            if let fill = attributes["fill"] { style.fill = fill != "none" }
            if let stroke = attributes["stroke"] { style.stroke = stroke != "none" }
            if attributes["fill-opacity"].flatMap(Double.init) == 0 { style.fill = false }
            if attributes["stroke-opacity"].flatMap(Double.init) == 0 { style.stroke = false }
            if let value = attributes["fill-rule"].flatMap(AvatarFaceMark.FillRule.init) { style.rule = value }
            if let value = attributes["stroke-width"].flatMap({ svgNumbers($0).first }) { style.strokeWidth = value }
            if let value = attributes["stroke-linecap"].flatMap(AvatarFaceMark.Stroke.Cap.init) { style.cap = value }
            if let value = attributes["stroke-linejoin"].flatMap(AvatarFaceMark.Stroke.Join.init) { style.join = value }
            return style
        }
    }

    struct Layer {
        var right = false
        var ignored = false
        var transform = CGAffineTransform.identity
        var style = Style()
    }

    struct Mark {
        let path: AvatarPath
        let right: Bool
        let style: Style
        let scale: Double
    }

    private let nonDrawing = Set(["defs", "clippath", "mask", "symbol", "pattern", "filter", "lineargradient",
                                  "radialgradient", "style", "script", "text", "foreignobject", "switch", "marker"])
    private let basicShapes = Set(["path", "line", "polyline", "polygon", "circle", "ellipse", "rect"])
    private var layers: [Layer] = [.init()]
    private var marks: [Mark] = []
    private var view: CGRect?
    private var sawSVG = false
    private var ignored: [String] = []

    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?,
                qualifiedName qName: String?, attributes raw: [String: String]) {
        let tag = name.lowercased().split(separator: ":").last.map(String.init) ?? name.lowercased()
        var layer = layers.last ?? .init()
        var attributes: [String: String] = [:]
        for (key, value) in raw { attributes[key.lowercased()] = value }
        for rule in (attributes["style"] ?? "").split(separator: ";") {
            let sides = rule.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            if sides.count == 2 { attributes[sides[0].lowercased()] = sides[1] }
        }
        if nonDrawing.contains(tag), !layer.ignored {
            ignored.append("<\(tag)>")
            layer.ignored = true
        }
        if attributes["display"] == "none" || attributes["visibility"] == "hidden" { layer.ignored = true }
        if attributes["opacity"].flatMap(Double.init) == 0 { layer.ignored = true }
        layer.right = layer.right || attributes["id"]?.lowercased() == "right"
        layer.style = layer.style.applying(attributes)
        layer.transform = svgTransform(attributes["transform"]).concatenating(layer.transform)

        if tag == "svg", !sawSVG {
            sawSVG = true
            let box = svgNumbers(attributes["viewbox"] ?? "")
            if box.count == 4, box[2] > 0, box[3] > 0 {
                view = CGRect(x: box[0], y: box[1], width: box[2], height: box[3])
            } else if let width = svgNumbers(attributes["width"] ?? "").first,
                      let height = svgNumbers(attributes["height"] ?? "").first, width > 0, height > 0 {
                view = CGRect(x: 0, y: 0, width: width, height: height)
            }
        }
        if !layer.ignored {
            if basicShapes.contains(tag) {
                if let data = pathData(tag, attributes), let path = try? parseAvatarPath(data) {
                    let matrix = layer.transform
                    let scale = sqrt(abs(matrix.a * matrix.d - matrix.b * matrix.c))
                    marks.append(.init(path: path.transformed(by: matrix), right: layer.right,
                                       style: layer.style, scale: scale))
                } else {
                    ignored.append("<\(tag)> with invalid path data")
                }
            } else if !["svg", "g", "a", "title", "desc", "metadata"].contains(tag) {
                ignored.append("<\(tag)>")
            }
            if attributes["filter"] != nil || attributes["mask"] != nil || attributes["clip-path"] != nil {
                ignored.append("filters, masks and clip paths")
            }
            if (attributes["fill"] ?? "").hasPrefix("url(") || (attributes["stroke"] ?? "").hasPrefix("url(") {
                ignored.append("gradients and patterns")
            }
        }
        layers.append(layer)
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?) {
        if layers.count > 1 { layers.removeLast() }
    }

    func finish() -> (eyes: AvatarDrawnFace.Eyes, ignored: [String]) {
        var box = view ?? marks.reduce(CGRect.null) { $0.union($1.path.cgPath.boundingBoxOfPath) }
        if box.isNull || box.isEmpty { box = CGRect(x: 0, y: 0, width: 100, height: 100) }
        else if view == nil {
            let padding = max(box.width, box.height) * 0.05
            box = box.insetBy(dx: -padding, dy: -padding)
        }
        let fit = 100 / max(box.width, box.height)
        let matrix = CGAffineTransform(a: fit, b: 0, c: 0, d: fit, tx: 50 - box.midX * fit, ty: 50 - box.midY * fit)
        var left: [AvatarFaceMark] = []
        var right: [AvatarFaceMark] = []
        for mark in marks {
            let stroke: AvatarFaceMark.Stroke? = mark.style.stroke && mark.style.strokeWidth > 0
                ? .init(width: mark.style.strokeWidth * fit * mark.scale, cap: mark.style.cap, join: mark.style.join)
                : nil
            if !mark.style.fill && stroke == nil { continue }
            let value = AvatarFaceMark(d: mark.path.transformed(by: matrix).svg, fill: mark.style.fill,
                                       fillRule: mark.style.rule, stroke: stroke)
            if mark.right { right.append(value) } else { left.append(value) }
        }
        if !sawSVG { ignored.append("no <svg> element; fitted to artwork") }
        return (.init(left: left, right: right.isEmpty ? nil : right), Array(Set(ignored)).sorted())
    }

    private func pathData(_ tag: String, _ attr: [String: String]) -> String? {
        func number(_ key: String) -> Double { svgNumbers(attr[key] ?? "").first ?? 0 }
        switch tag {
        case "path":
            return attr["d"]
        case "line":
            return "M\(number("x1")) \(number("y1"))L\(number("x2")) \(number("y2"))"
        case "polyline", "polygon":
            let points = svgNumbers(attr["points"] ?? "")
            guard points.count >= 4, points.count.isMultiple(of: 2) else { return nil }
            let trail = stride(from: 0, to: points.count, by: 2).map { "\(points[$0]) \(points[$0 + 1])" }
            return "M" + trail.joined(separator: "L") + (tag == "polygon" ? "Z" : "")
        case "circle", "ellipse":
            let x = number("cx"), y = number("cy")
            let rx = number(tag == "circle" ? "r" : "rx")
            let ry = number(tag == "circle" ? "r" : "ry")
            guard rx > 0, ry > 0 else { return nil }
            return "M\(x - rx) \(y)A\(rx) \(ry) 0 1 0 \(x + rx) \(y)A\(rx) \(ry) 0 1 0 \(x - rx) \(y)Z"
        case "rect":
            let x = number("x"), y = number("y"), w = number("width"), h = number("height")
            guard w > 0, h > 0 else { return nil }
            let rx = min(w / 2, attr["rx"] == nil ? number("ry") : number("rx"))
            let ry = min(h / 2, attr["ry"] == nil ? number("rx") : number("ry"))
            if rx <= 0 || ry <= 0 { return "M\(x) \(y)H\(x+w)V\(y+h)H\(x)Z" }
            let r = "A\(rx) \(ry) 0 0 1"
            return "M\(x+rx) \(y)H\(x+w-rx)\(r) \(x+w) \(y+ry)V\(y+h-ry)"
                + "\(r) \(x+w-rx) \(y+h)H\(x+rx)\(r) \(x) \(y+h-ry)V\(y+ry)\(r) \(x+rx) \(y)Z"
        default:
            return nil
        }
    }
}

private func svgNumbers(_ text: String) -> [Double] {
    let pattern = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/
    return text.matches(of: pattern).compactMap { Double($0.output) }.filter(\.isFinite)
}

private func svgTransform(_ text: String?) -> CGAffineTransform {
    guard let text else { return .identity }
    var matrix = CGAffineTransform.identity
    for match in text.matches(of: /(\w+)\s*\(([^)]*)\)/) {
        let values = svgNumbers(String(match.2))
        guard let a = values.first else { continue }
        let b = values.count > 1 ? values[1] : 0
        let next: CGAffineTransform
        switch match.1 {
        case "matrix" where values.count == 6:
            next = CGAffineTransform(a: a, b: b, c: values[2], d: values[3], tx: values[4], ty: values[5])
        case "translate":
            next = CGAffineTransform(translationX: a, y: b)
        case "scale":
            next = CGAffineTransform(scaleX: a, y: values.count > 1 ? b : a)
        case "rotate":
            let center = values.count == 3 ? CGPoint(x: b, y: values[2]) : .zero
            next = CGAffineTransform(translationX: center.x, y: center.y).rotated(by: radians(a))
                .translatedBy(x: -center.x, y: -center.y)
        case "skewX":
            next = CGAffineTransform(a: 1, b: 0, c: tan(radians(a)), d: 1, tx: 0, ty: 0)
        case "skewY":
            next = CGAffineTransform(a: 1, b: tan(radians(a)), c: 0, d: 1, tx: 0, ty: 0)
        default:
            continue
        }
        matrix = next.concatenating(matrix)
    }
    return matrix
}
