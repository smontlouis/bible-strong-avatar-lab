# @bible-strong/avatar-core

## 1.0.1

### Patch Changes

- Ship `CHANGELOG.md` in the package, and document in the README how to upgrade from 0.x: every
  prop, option, method and function of the first version, with what takes its place.

## 1.0.0

### Major Changes

- Second version.

  Every character plays one shared catalogue instead of its own expressions and animations: about
  fifty states (`idle`, `thinking`, `searching`, `happy`…) that draw their clips by their own
  rules and may hand over to the next state, nine faces, the gestures `nod`, `bounce` and `spin`,
  and thirteen spinner patterns a body can turn into. A file of the first version is still read,
  for its character. See « Upgrading from 0.x » in the README for every change, old to new.

  **Breaking changes**

  - The playback of the first version is gone: `createAvatarPlaybackState`,
    `playAvatarAnimation`, `advanceAvatarPlayback`, `pauseAvatarPlayback`, `resumeAvatarPlayback`,
    `sampleAvatarFrame`, `renderAvatarFrame`, `renderAvatarSample`, `nextAvatarFrameAt`,
    `resolveAnimation`, `resolveExpression`, `renderAvatarDefinition` and `renderAvatarExpression`.
  - `parseAvatarDefinition`, `getSemanticKeyIssue`, `avatarDefinitionFileName` and the size limits
    of a definition are gone; `validateAvatarDefinition` stays, to read a file of the first
    version.
  - The entry point `@bible-strong/avatar-core/ambient-motion` is gone.
  - A renderer draws a `CharacterScene`: the same geometry, moved by `transform`, with the marks
    and the disc of a spinner.

  **New**: the character (`AvatarCharacter`, `readCharacter`, `validateCharacter`, `characterOf`),
  the catalogue (`states`, `clips`, `faces`, `stateAliases`), the engine (`createAvatarEngine`,
  `setEngineState`, `playEngineClip`, `setEngineFace`, `pokeEngine`, `setEngineLookAt`,
  `advanceEngine`, `engineFrame`, `engineAtRest`…) and `renderCharacterFrame`.

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
