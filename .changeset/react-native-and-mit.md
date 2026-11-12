---
'@bible-strong/avatar-core': minor
'@bible-strong/avatar-react': minor
'@bible-strong/avatar-web': minor
'@bible-strong/avatar-react-native': minor
---

Relicense the runtime packages from AGPL-3.0-only to MIT, and add
`@bible-strong/avatar-react-native`: a React Native renderer with the API of `avatar-react`, sampled
on the UI thread with Reanimated, plus `muted`, `settleAfterMs` and `frameRate`.

The renderers no longer compute a frame that would be identical to the one on screen: a pose held
between two blinks is drawn once. `avatar-core` exposes `nextAvatarFrameAt` and
`renderAvatarSample` for that. `avatar-react` and `avatar-web` also stop drawing an avatar scrolled
out of view, and create only the body path slots the definition can use.

Each package README now gives the setup, a minimal example, every prop, every error with its fix
and a checklist, for people and coding agents alike.
