---
'@bible-strong/avatar-react-native': patch
---

Fix a crash on Android (`IllegalStateException: Underflow in restore - more restores than saves`)
when the body fades or turns into a spinner's disc. react-native-svg on Android draws a `<G>` whose
opacity is not 1 into a layer and tests the opacity again at the end of the draw; when an animated
group opacity crossed 1 in between, it restored a canvas it never saved. On Android the body and
fading groups now keep an opacity of 1 and each path carries their product. iOS is unchanged.
