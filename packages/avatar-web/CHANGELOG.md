# @bible-strong/avatar-web

## 1.3.0

### Patch Changes

- Updated dependencies [f72df04]
  - @bible-strong/avatar-core@1.3.0

## 1.2.1

### Patch Changes

- 67b5812: The outline goes round the whole silhouette once, instead of round each part: a part of another colour no longer gets a line where it meets the head. Every shape is stroked underneath, twice as wide, and the fills drawn over it leave the outer half, so the line keeps the width the character gives it. Its opacity is the whole line's, so strokes that cross do not darken. React Native drew it this way already, at half the width; it now draws it as wide as the other renderers.
- Updated dependencies [67b5812]
  - @bible-strong/avatar-core@1.2.1

## 1.2.0

### Minor Changes

- e77f858: Eyes pass from one face to another through a capsule: its middle, angle, length and width are mixed. Straight eyes (`neutral`, `surprised`, `sad`, `squinted`, `inspecting`) turn about their middle the short way instead of shrinking through it; towards or away from the oval of `calm`, the capsule has the oval's size and swells into it late on the way there, instead of shrinking to a dot. Bent eyes (`happy`, `confused`, `sleepy`) still mix their numbers. New exports: `morphEyeShapes`, `eyeMorphOf`, the `EyeMorph` type, and `FaceEye.ovalMix`; `mixEyeShapes` is unchanged.
- f630df5: Drawn faces and libraries.

  - **Drawn faces.** A face can be drawn as the marks of its eyes: SVG paths on an artboard of 100 by 100, filled and/or stroked with round, butt or square ends and round, miter or bevel corners, holes included; the right eye mirrors the left unless drawn too. `compileFace` reads one into filled shapes, `faceFromSvg` and `faceEyesFromSvg` read an SVG file of the eye without a DOM, `flattenPath` reads path data. Clips and states name a drawn face like a built-in one; an unknown name shows `neutral`. A change to or from a drawn face is a blink (`FACE_SWAP_SECONDS`), and lids squash a drawn eye. Guide: https://avatars.bible-strong.app/face-authoring.md
  - **Libraries.** `readAvatarLibrary` reads `{ clips, states, faces }` as the Studio exports them (`avatar-library.json`). React and React Native take it as the `library` prop, the web renderer as the `library` option and `setLibrary`; clips asked for by name are looked up there first. The engine library has `faces`.
  - **Types.** The player's and the frame's face fields are now face names (`string`), and `PlayerFrame.eyes` are `PlayerEye`s, built-in (`FaceEye`) or drawn (`DrawnEye`). `RenderAvatarOptions.eyeOutlines` also takes `EyeShapes`. `settlePlayerFace` shows a face at once.

- 1f035f4: Two clip tracks: `opacity` fades the whole avatar (spinner marks included), and `eyeSize` scales both eyes about their place, on every face. Both rest at 1, are joined and counted in the loop's rest pose. `CharacterScene.opacity` carries the avatar's opacity; the three renderers give it to the moved group in place of the spinner's own.

### Patch Changes

- cbeb098: The published declarations type under `moduleResolution: nodenext` and `node16` (#20). Relative imports in the sources carry their `.js` extension, so `export * from './faces.js'` resolves in an ECMAScript package; before, `@bible-strong/avatar-core` exposed no exports there and the React, web and React Native packages' exports were `any`. avatar-core, avatar-react and avatar-web now emit their declarations under `NodeNext`, which refuses an import without its extension; `pnpm packages:types` types every package from a `nodenext` consumer in `pnpm check`.
- Updated dependencies [e77f858]
- Updated dependencies [f630df5]
- Updated dependencies [cbeb098]
- Updated dependencies [1f035f4]
  - @bible-strong/avatar-core@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [2457065]
  - @bible-strong/avatar-core@1.1.0

## 1.0.1

### Patch Changes

- Ship `CHANGELOG.md` in the package, and document in the README how to upgrade from 0.x: every
  prop, option, method and function of the first version, with what takes its place.
- Updated dependencies
  - @bible-strong/avatar-core@1.0.1

## 1.0.0

### Major Changes

- Second version.

  Every character plays one shared catalogue instead of its own expressions and animations: about
  fifty states (`idle`, `thinking`, `searching`, `happy`…) that draw their clips by their own
  rules and may hand over to the next state, nine faces, the gestures `nod`, `bounce` and `spin`,
  and thirteen spinner patterns a body can turn into. A file of the first version is still read,
  for its character. See « Upgrading from 0.x » in the README for every change, old to new.

  **Breaking changes**

  - The option `definition` becomes `character`; the same file is accepted.
  - `defaultAnimation`, `autoplay` and `defaultExpression` give way to `state` and `face`.
  - `onAnimationEnd`, `onExpressionChange` and `onError` give way to `onStateChange`.
  - The controller's `play` becomes `setState` (or `playClip`), `setExpression` becomes `setFace`,
    `stop` is gone, and `getState()` returns `{ state, clip, paused }`. `setState` and `playClip`
    return `false` for a name the catalogue lacks, instead of `{ ok: false, error }`.

  **New**: `playClip`, `setFace`, `setEmphasis`, `poke`, `resume`, `setLookAt`,
  `setFollowPointer`, `setMuted`, `setSettleAfterMs`, and the options `clip`, `face`, `lookAt`,
  `paused`, `followPointer`, `muted`, `settleAfterMs`, `seed`.

### Minor Changes

- 0bddfed: Sink a coloured body node into the head. A node whose colour differs from the body's used to
  jump whole from behind the head to in front of it. It is now drawn behind the head, and drawn
  again in front only where its surface is nearer than the head's: the two meet along the true line
  where the solids intersect, for every surface type, as a head and as a node. A node of the body's
  colour is unchanged and costs nothing more.

  `surfaceField(surface)` is new: the function that tells where a point is against a surface.

  `AvatarScene.geometry` gains `frontClipPaths`, one clip per front path. A renderer that draws
  scenes itself must clip a front path that has one by that clip; the three renderers of this
  project do.

- 1d70534: Add static body nodes. A node with `followsHead: false` keeps its place and its turn while the
  head rotates, and still moves with the head when the head is moved. A node without the field
  turns with the head, as before. `bodyNodeFrame(pose, node)` gives the pose a node is placed in.

### Patch Changes

- 4b65878: Draw a body node with the exact outline of its surface, as the head already was, instead of
  wrapping several hundred projected points. An avatar with sphere nodes computes a frame 7 to 19
  times faster; the outlines coincide with the previous ones. A trapezoid node keeps the sampled
  outline.
- 6b31bc1: Hide the nose and the mouth when the head is turned away, as the eyes already were. They used to
  show through the back of the head.
- Updated dependencies [0bddfed]
- Updated dependencies [4b65878]
- Updated dependencies [6b31bc1]
- Updated dependencies
- Updated dependencies [1d70534]
  - @bible-strong/avatar-core@1.0.0

## 0.2.0

### Minor Changes

- c09b737: Relicense the runtime packages from AGPL-3.0-only to MIT, and add
  `@bible-strong/avatar-react-native`: a React Native renderer with the API of `avatar-react`, sampled
  on the UI thread with Reanimated, plus `muted`, `settleAfterMs` and `frameRate`.

  The renderers no longer compute a frame that would be identical to the one on screen: a pose held
  between two blinks is drawn once. `avatar-core` exposes `nextAvatarFrameAt` and
  `renderAvatarSample` for that. `avatar-react` and `avatar-web` also stop drawing an avatar scrolled
  out of view, and create only the body path slots the definition can use.

  Each package README now gives the setup, a minimal example, every prop, every error with its fix
  and a checklist, for people and coding agents alike.

### Patch Changes

- Updated dependencies [c09b737]
  - @bible-strong/avatar-core@0.2.0
