// swift-tools-version: 6.0
import PackageDescription

let core = "../../../avatar-core/src"
let runtime = "packages/avatar-swift/Sources/AvatarSwift"

let package = Package(
    name: "AvatarSwift",
    platforms: [.macOS(.v15), .iOS(.v18)],
    products: [
        .library(name: "AvatarSwift", targets: ["AvatarSwift"]),
        .executable(name: "AvatarSwiftDemo", targets: ["AvatarSwiftDemo"])
    ],
    targets: [
        .target(
            name: "AvatarSwift",
            path: runtime,
            resources: [
                .copy("\(core)/catalogue/clips.json"),
                .copy("\(core)/catalogue/faces.json"),
                .copy("\(core)/catalogue/states.json"),
                .copy("\(core)/avatarDefinition.schema.json"),
                .copy("../../Resources/Avatar.metal"),
                .copy("../../LICENSE")
            ]
        ),
        .executableTarget(
            name: "AvatarSwiftDemo",
            dependencies: ["AvatarSwift"],
            path: "packages/avatar-swift/Sources/AvatarSwiftDemo",
            resources: [.copy("Resources")]
        ),
        .testTarget(
            name: "AvatarSwiftTests",
            dependencies: ["AvatarSwift"],
            path: "packages/avatar-swift/Tests/AvatarSwiftTests"
        )
    ]
)
