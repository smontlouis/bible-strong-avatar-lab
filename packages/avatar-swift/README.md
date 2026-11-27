# AvatarSwift

AvatarSwift is a native Swift package for procedural avatars on macOS 15 and iOS 18 or later.
Swift reads the character and drives the animation. Metal draws the resulting scene. An avatar
definition, the catalogue and the renderer have independent lifecycles.

Each view receives an explicit character. The demo starts with **Strobi**, the character used
in the [avatar-react example](https://github.com/smontlouis/bible-strong-avatar-lab/blob/main/packages/avatar-react/README.md#minimal-example).
Apps supply their own definitions and share the animation catalogue.

## Install

AvatarSwift is the `AvatarSwift` library of this repository's Swift package. It is released with
the npm packages, under the same version, from AvatarSwift's first release, `1.3.0`.

In Xcode, choose **File › Add Package Dependencies…**, enter
`https://github.com/smontlouis/bible-strong-avatar-lab` and add the `AvatarSwift` library to your
app's target. In a `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/smontlouis/bible-strong-avatar-lab", from: "1.3.0"),
],
targets: [
    .target(name: "YourApp", dependencies: [
        .product(name: "AvatarSwift", package: "bible-strong-avatar-lab"),
    ]),
]
```

The package brings the shared catalogue, the character schema and the Metal shader as resources.
It needs Xcode 16 (Swift 6), and a device with Metal to draw.

Characters come from the Studio: its **Export** tab saves a `.avatar.json`, which you add to your
app and read with `createAvatar` (see [Import files](#import-files)).

## Preview

The demo app is its own package in `examples/avatar-swift-demo`. From the repository root, with
Xcode's Swift toolchain on a Mac with Metal:

```sh
swift run --package-path examples/avatar-swift-demo AvatarSwiftDemo
swift run --package-path examples/avatar-swift-demo -c release AvatarSwiftDemo --export ./new-reel.mp4
swift test
```

## Embed in SwiftUI

```swift
import AvatarSwift
import SwiftUI

struct AssistantAvatar: View {
    let character: AvatarCharacter
    var listening: Bool
    @State private var handle = AvatarHandle()

    var body: some View {
        AvatarView(
            character: character,
            state: listening ? "listening" : "idle",
            lookAt: listening ? SIMD2(-0.5, 0.26) : nil,
            settleAfterMs: 1_800,
            size: 96,
            accessibilityLabel: character.name ?? "Avatar",
            handle: handle
        )
        .contentShape(Rectangle())
        .onTapGesture { handle.poke(.nod) }
    }
}
```

`AvatarView` starts in `idle`. Pass `clip` with a nil `state` to loop a particular clip. A known
state takes precedence over a clip. Unknown names keep the current playback. A held `face`
takes precedence over both. `onStateChange` reports transitions, including automatic handovers
and nil for a clip played on its own.

Additional view options include:

- `library` for custom clips, states and faces. A custom clip or state can override a built-in
  name. Unknown faces fall back to `neutral`.
- `pose` for a fixed rotation or quaternion, position and zoom. Releasing it joins back to the
  animation. `paused` freezes playback.
- `lookAt` for a point between −1 and 1 on each axis and `followPointer` for native hover in
  the view. An explicit point takes priority.
- `emphasis` for a surprised face when the state supplies none, `muted` for a 300 ms grayscale
  fade, and `seed` for repeatable playback.
- `settleAfterMs` for stopping the frame loop when the eyes are open and transitions have
  finished. Offscreen views and background scenes stop their display links. Reduce Motion
  shows a settled frame on updates.
- `size` in points, or nil to fit the available space. Below 48 points the compact lists apply.
  Use SwiftUI modifiers for layout and styling. The view allows drawing room around its
  nominal frame. `accessibilityLabel` names the avatar image.

`AvatarHandle.poke` layers `.nod`, `.bounce` or `.spin` over playback. Spin accepts a turn count.

## Import files

```swift
let character = try createAvatar(Data(contentsOf: characterURL))
let read = try readAvatarLibrary(Data(contentsOf: libraryURL))
let avatar = AvatarView(character: character, state: "greeting", library: read.library)
```

`readCharacter` returns a result with RFC 6901 issue paths. It reads the current character
format and migrates neutral appearance from version 1. Version 1 expressions and animation
tracks are superseded by the shared catalogue. `validateCharacter` checks only the current
format. The library reader reports individual invalid or duplicate entries without discarding
their valid neighbors. Drawn faces accept artboard paths or supported SVG shapes, transforms,
fill rules and stroked marks.

A character file is the one the Studio exports and the web renderers read: AvatarSwift accepts
exactly the avatar-core format and refuses what avatar-core refuses.

## Advance without a view

```swift
var engine = AvatarEngine(seed: seedOfName(character.name ?? "avatar"))
engine.setState("thinking")
engine.advance(1.0 / 60.0)
let scene = renderCharacterFrame(character, engine.frame)
```

The engine exposes state and clip lookup, timeline seeking, held faces, manual poses,
gestures, gaze, alternate libraries, handover control and the current frame. It never relies
on a display link or Metal. `AvatarMetalRenderer.encode` accepts the scene and a shader-writable
BGRA8 texture for embedding in another renderer or exporting frames.

## Upstream

The Swift target bundles the state, clip and face catalogue, the character schema and the legacy
definition schema from [avatar-core](../avatar-core/README.md). The demo's Strobi definition preserves the
neutral appearance of the [React example](../../examples/react-vite-consumer/src/strobi.avatar.json).
See [LICENSE](LICENSE).
The native renderer uses 3D depth and returns a Swift scene. It looks through the same
perspective as avatar-core, lays the eyes on the head as avatar-core does and rounds a cube with
the same power. Silhouettes of the other surfaces, face transitions and antialiasing can differ
from the upstream SVG renderer.

## Parity with avatar-core

AvatarSwift is a second implementation of avatar-core's engine. `parity/frames.json` holds what
avatar-core's engine gives in the scenes of `parity/scenes.json`, and `swift test` plays the same
scenes and compares every frame. The Swift engine matches avatar-core in all 63 scenes.

After a change of avatar-core's engine or character format, run `pnpm swift:parity` at the root to
write the files again, then change the Swift engine until `swift test` passes.
