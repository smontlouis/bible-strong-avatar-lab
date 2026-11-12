---
'@bible-strong/avatar-core': patch
'@bible-strong/avatar-react': patch
'@bible-strong/avatar-web': patch
'@bible-strong/avatar-react-native': patch
---

Draw a body node with the exact outline of its surface, as the head already was, instead of
wrapping several hundred projected points. An avatar with sphere nodes computes a frame 7 to 19
times faster; the outlines coincide with the previous ones. A trapezoid node keeps the sampled
outline.
