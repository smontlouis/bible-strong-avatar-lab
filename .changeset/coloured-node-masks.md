---
'@bible-strong/avatar-core': minor
'@bible-strong/avatar-react': minor
'@bible-strong/avatar-web': minor
'@bible-strong/avatar-react-native': minor
---

Sink a coloured body node into the head. A node whose colour differs from the body's used to jump
whole from behind the head to in front of it. It is now drawn behind the head, and drawn again in
front only where its surface is nearer than the head's, so the two meet along a line as solids do.
A node of the body's colour is unchanged and costs nothing more.

`AvatarScene.geometry` gains `frontClipPaths`, one clip per front path. A renderer that draws
scenes itself must clip a front path that has one by that clip and by the head path; the three
renderers of this project do.
