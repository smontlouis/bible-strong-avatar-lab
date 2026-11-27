// swift-tools-version: 6.0
import PackageDescription

// A macOS app that shows AvatarSwift as an outside app uses it: through the package at the root of
// this repository. Run it with `swift run --package-path examples/avatar-swift-demo AvatarSwiftDemo`.
let package = Package(
    name: "AvatarSwiftDemo",
    platforms: [.macOS(.v15)],
    dependencies: [.package(name: "AvatarSwift", path: "../..")],
    targets: [
        .executableTarget(
            name: "AvatarSwiftDemo",
            dependencies: [.product(name: "AvatarSwift", package: "AvatarSwift")],
            resources: [.copy("Resources")]
        )
    ]
)
