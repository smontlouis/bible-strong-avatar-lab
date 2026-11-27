import CoreFoundation
import Foundation

public struct AvatarFileIssue: Equatable, Sendable {
    /// RFC 6901 JSON Pointer. The empty pointer denotes the document.
    public let path: String
    public let code: String
    public let message: String

    public init(path: String, code: String, message: String) {
        self.path = path
        self.code = code
        self.message = message
    }
}

public struct AvatarFileError: LocalizedError, Equatable, Sendable {
    public let errors: [AvatarFileIssue]
    public var errorDescription: String? {
        guard let first = errors.first else { return "Invalid avatar character." }
        let location = first.path.isEmpty ? "" : " at \(first.path)"
        return "Invalid avatar character\(location): \(first.message)"
    }

    init(_ errors: [AvatarFileIssue]) { self.errors = errors }
}

/// Decodes a current character, or migrates the neutral appearance of a version 1 definition.
public func readCharacter(_ data: Data) -> Result<AvatarCharacter, AvatarFileError> {
    readCharacter(data, acceptLegacy: true)
}

public func validateCharacter(_ data: Data) -> Result<AvatarCharacter, AvatarFileError> {
    readCharacter(data, acceptLegacy: false)
}

public func characterOf(_ data: Data) throws -> AvatarCharacter { try readCharacter(data).get() }

private func readCharacter(_ data: Data, acceptLegacy: Bool) -> Result<AvatarCharacter, AvatarFileError> {
    do {
        let value = try JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed)
        let legacy = acceptLegacy && (value as? JSONObject)?["schema"] as? String == "bible-strong/avatar-definition"
        let schema = legacy ? CharacterSchemas.legacy : CharacterSchemas.current
        var checker = SchemaChecker(definitions: schema["$defs"] as? [String: JSONObject] ?? [:])
        checker.visit(value, schema: schema, path: "")
        if checker.errors.isEmpty, legacy, let object = value as? JSONObject {
            checker.errors = legacyIssues(object)
        }
        guard checker.errors.isEmpty else { return .failure(AvatarFileError(checker.errors)) }

        let decoder = JSONDecoder()
        if legacy {
            return .success(try decoder.decode(LegacyCharacter.self, from: data).character)
        }
        return .success(try decoder.decode(AvatarCharacter.self, from: data))
    } catch {
        return .failure(AvatarFileError([.init(path: "", code: "decode", message: error.localizedDescription)]))
    }
}

typealias JSONObject = [String: Any]

func jsonPointer(_ path: String, _ segment: String) -> String {
    path + "/" + segment.replacingOccurrences(of: "~", with: "~0").replacingOccurrences(of: "/", with: "~1")
}

func jsonNumber(_ value: Any?) -> Double? {
    guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(), value.doubleValue.isFinite
    else { return nil }
    return value.doubleValue
}

private enum CharacterSchemas {
    // Both are avatar-core's own: the first format's schema, and the character schema it exports
    // (`avatarCharacterSchema`), written to `Resources/avatarCharacter.schema.json` by
    // `pnpm swift:parity`.
    static let legacyData = load("avatarDefinition.schema")
    static let currentData = load("avatarCharacter.schema")
    static var legacy: JSONObject { object(legacyData) }
    static var current: JSONObject { object(currentData) }

    private static func load(_ name: String) -> Data {
        do { return try AvatarResources.data(name, extension: "json") }
        catch { preconditionFailure("Missing packaged avatar schema: \(error)") }
    }

    private static func object(_ data: Data) -> JSONObject {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? JSONObject
        else { preconditionFailure("Invalid packaged avatar schema.") }
        return object
    }
}

/// The keyword subset used by the bundled Avatar Lab schemas.
private struct SchemaChecker {
    let definitions: [String: JSONObject]
    var errors: [AvatarFileIssue] = []

    mutating func visit(_ value: Any, schema: JSONObject, path: String) {
        if let reference = schema["$ref"] as? String,
           let resolved = definitions[String(reference.dropFirst("#/$defs/".count))] {
            visit(value, schema: resolved, path: path)
        }
        for rule in schema["allOf"] as? [JSONObject] ?? [] {
            visit(value, schema: rule, path: path)
        }
        if let type = schema["type"] as? String, !isType(value, type) {
            issue(path, "type", "Expected \(type).")
            return
        }
        if let constant = schema["const"], !equal(value, constant) {
            issue(path, path == "/schemaVersion" ? "unsupported_version" : "const", "Expected \(constant).")
        }
        if let options = schema["enum"] as? [Any], !options.contains(where: { equal(value, $0) }) {
            issue(path, "enum", "Expected one of \(options.map { String(describing: $0) }.joined(separator: ", ")).")
        }
        if let number = jsonNumber(value) {
            if let minimum = jsonNumber(schema["minimum"]), number < minimum {
                issue(path, "minimum", "Must be at least \(minimum).")
            }
            if let maximum = jsonNumber(schema["maximum"]), number > maximum {
                issue(path, "maximum", "Must be at most \(maximum).")
            }
        }
        if let string = value as? String {
            if let limit = schema["maxLength"] as? Int, string.unicodeScalars.count > limit {
                issue(path, "maxLength", "Must contain at most \(limit) characters.")
            }
            if let pattern = schema["pattern"] as? String,
               string.range(of: pattern, options: .regularExpression) == nil {
                issue(path, "pattern", "Must match \(pattern).")
            }
        }
        if let array = value as? [Any] { check(array, schema: schema, path: path) }
        if let object = value as? JSONObject { check(object, schema: schema, path: path) }
    }

    private mutating func check(_ value: [Any], schema: JSONObject, path: String) {
        checkCount(value.count, schema: schema, path: path, minKey: "minItems", maxKey: "maxItems")
        if schema["uniqueItems"] as? Bool == true {
            for index in value.indices where value[..<index].contains(where: { equal($0, value[index]) }) {
                issue(jsonPointer(path, String(index)), "uniqueItems", "Repeated item.")
            }
        }
        let prefix = schema["prefixItems"] as? [JSONObject] ?? []
        for (index, item) in value.enumerated() {
            let childPath = jsonPointer(path, String(index))
            if index < prefix.count { visit(item, schema: prefix[index], path: childPath) }
            else if let rule = schema["items"] as? JSONObject { visit(item, schema: rule, path: childPath) }
            else if schema["items"] as? Bool == false { issue(childPath, "items", "Unexpected item.") }
        }
    }

    private mutating func check(_ value: JSONObject, schema: JSONObject, path: String) {
        checkCount(value.count, schema: schema, path: path, minKey: "minProperties", maxKey: "maxProperties")
        let properties = schema["properties"] as? [String: JSONObject] ?? [:]
        for key in schema["required"] as? [String] ?? [] where value[key] == nil {
            issue(jsonPointer(path, key), "required", "Missing required property.")
        }
        for key in value.keys.sorted() {
            guard let item = value[key] else { continue }
            let childPath = jsonPointer(path, key)
            if let names = schema["propertyNames"] as? JSONObject { visit(key, schema: names, path: childPath) }
            if let rule = properties[key] { visit(item, schema: rule, path: childPath) }
            else if let rule = schema["additionalProperties"] as? JSONObject { visit(item, schema: rule, path: childPath) }
            else if schema["additionalProperties"] as? Bool == false {
                issue(childPath, "additionalProperties", "Unknown property.")
            }
        }
    }

    private mutating func checkCount(_ value: Int, schema: JSONObject, path: String, minKey: String, maxKey: String) {
        if let low = schema[minKey] as? Int, value < low { issue(path, minKey, "Expected at least \(low) entries.") }
        if let high = schema[maxKey] as? Int, value > high { issue(path, maxKey, "Expected at most \(high) entries.") }
    }

    private mutating func issue(_ path: String, _ code: String, _ message: String) {
        errors.append(.init(path: path, code: code, message: message))
    }

    private func isType(_ value: Any, _ type: String) -> Bool {
        switch type {
        case "object": value is JSONObject
        case "array": value is [Any]
        case "string": value is String
        case "number": jsonNumber(value) != nil
        case "integer": jsonNumber(value).map { $0.rounded() == $0 } ?? false
        case "boolean": (value as? NSNumber).map { CFGetTypeID($0) == CFBooleanGetTypeID() } ?? false
        case "null": value is NSNull
        default: false
        }
    }

    private func equal(_ lhs: Any, _ rhs: Any) -> Bool {
        if let left = lhs as? NSNumber, let right = rhs as? NSNumber,
           (CFGetTypeID(left) == CFBooleanGetTypeID()) != (CFGetTypeID(right) == CFBooleanGetTypeID()) { return false }
        return (lhs as? NSObject)?.isEqual(rhs) ?? false
    }
}

private func legacyIssues(_ object: JSONObject) -> [AvatarFileIssue] {
    let expressions = object["expressions"] as? JSONObject ?? [:]
    let animations = object["animations"] as? JSONObject ?? [:]
    var issues: [AvatarFileIssue] = []

    func checkOrder(_ key: String, _ items: JSONObject) {
        let order = object[key] as? [String] ?? []
        for name in items.keys.sorted() where !order.contains(name) {
            issues.append(.init(path: "/" + key, code: "incomplete_order", message: "Missing '\(name)' from order."))
        }
        for (index, name) in order.enumerated() where items[name] == nil {
            issues.append(.init(path: "/\(key)/\(index)", code: "unknown_order_key", message: "Unknown '\(name)'."))
        }
    }

    checkOrder("expressionOrder", expressions)
    checkOrder("animationOrder", animations)
    if (object["expressionOrder"] as? [String])?.first != "neutral" {
        issues.append(.init(path: "/expressionOrder/0", code: "neutral_not_first", message: "Place neutral first."))
    }
    for (name, content) in animations {
        guard let animation = content as? JSONObject else { continue }
        let path = jsonPointer("/animations", name)
        if let blink = animation["blink"] as? JSONObject,
           let low = jsonNumber(blink["minIntervalMs"]), let high = jsonNumber(blink["maxIntervalMs"]), low > high {
            issues.append(.init(path: path + "/blink/minIntervalMs", code: "invalid_interval_range",
                                message: "The lower interval is greater than the upper interval."))
        }
        for (index, step) in (animation["steps"] as? [JSONObject] ?? []).enumerated() {
            if let expression = step["expression"] as? String, expressions[expression] == nil {
                issues.append(.init(path: path + "/steps/\(index)/expression", code: "unknown_expression",
                                    message: "Unknown expression '\(expression)'."))
            }
        }
    }
    return issues
}

private struct LegacyCharacter: Decodable {
    struct Neutral: Decodable {
        struct Eyes: Decodable {
            struct Eye: Decodable { let y: Double }
            let left: Eye
            let right: Eye
        }
        let eyes: Eyes
        let nose: AvatarCharacter.Nose?
        let mouth: AvatarCharacter.Mouth?
        let perspective: Double
    }

    let name: String?
    let body: AvatarCharacter.Body
    let colors: AvatarCharacter.Colors
    let style: AvatarCharacter.Style?
    let expressions: [String: Neutral]

    var character: AvatarCharacter {
        let neutral = expressions["neutral"]!
        let radius = min(body.primary.width, body.primary.height) / 2
        let height = (neutral.eyes.left.y + neutral.eyes.right.y) / (2 * radius)
        return AvatarCharacter(name: name, body: body, colors: colors, style: style,
                               face: .init(eyes: .init(shiftY: height), perspective: neutral.perspective,
                                           nose: neutral.nose, mouth: neutral.mouth))
    }
}
