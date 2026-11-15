---
'@bible-strong/avatar-core': minor
---

An engine can know clips and states of its own besides the catalogue's: `createAvatarEngine({ clips, states })`, `setEngineLibrary`, `engineStateOf` and `engineClipOf`. A state of its own draws its clips and the catalogue's and hands over to either. The renderers do not pass them yet. `avatarCharacterSchema` exports the JSON Schema a character file is checked against.
