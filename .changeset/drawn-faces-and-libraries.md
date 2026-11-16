---
'@bible-strong/avatar-core': minor
'@bible-strong/avatar-react': minor
'@bible-strong/avatar-web': minor
'@bible-strong/avatar-react-native': minor
---

Drawn faces and libraries.

- **Drawn faces.** A face can be drawn as the marks of its eyes: SVG paths on an artboard of 100 by 100, filled and/or stroked with round, butt or square ends and round, miter or bevel corners, holes included; the right eye mirrors the left unless drawn too. `compileFace` reads one into filled shapes, `faceFromSvg` and `faceEyesFromSvg` read an SVG file of the eye without a DOM, `flattenPath` reads path data. Clips and states name a drawn face like a built-in one; an unknown name shows `neutral`. A change to or from a drawn face is a blink (`FACE_SWAP_SECONDS`), and lids squash a drawn eye. Guide: https://avatars.bible-strong.app/face-authoring.md
- **Libraries.** `readAvatarLibrary` reads `{ clips, states, faces }` as the Studio exports them (`avatar-library.json`). React and React Native take it as the `library` prop, the web renderer as the `library` option and `setLibrary`; clips asked for by name are looked up there first. The engine library has `faces`.
- **Types.** The player's and the frame's face fields are now face names (`string`), and `PlayerFrame.eyes` are `PlayerEye`s, built-in (`FaceEye`) or drawn (`DrawnEye`). `RenderAvatarOptions.eyeOutlines` also takes `EyeShapes`. `settlePlayerFace` shows a face at once.
