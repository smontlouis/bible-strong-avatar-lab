---
'@bible-strong/avatar-core': minor
'@bible-strong/avatar-react': minor
'@bible-strong/avatar-web': minor
'@bible-strong/avatar-react-native': minor
---

Add static body nodes. A node with `followsHead: false` keeps its place and its turn while the
head rotates, and still moves with the head when the head is moved. A node without the field
turns with the head, as before. `bodyNodeFrame(pose, node)` gives the pose a node is placed in.
