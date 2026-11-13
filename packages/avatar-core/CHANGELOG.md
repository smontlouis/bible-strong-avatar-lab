# @bible-strong/avatar-core

## 0.3.0

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
