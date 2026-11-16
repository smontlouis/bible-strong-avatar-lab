---
'@bible-strong/avatar-core': patch
'@bible-strong/avatar-react': patch
'@bible-strong/avatar-web': patch
'@bible-strong/avatar-react-native': patch
---

The outline goes round the whole silhouette once, instead of round each part: a part of another colour no longer gets a line where it meets the head. Every shape is stroked underneath, twice as wide, and the fills drawn over it leave the outer half, so the line keeps the width the character gives it. Its opacity is the whole line's, so strokes that cross do not darken. React Native drew it this way already, at half the width; it now draws it as wide as the other renderers.
