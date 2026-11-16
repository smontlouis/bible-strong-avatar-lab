# ADR-0024: Drawn faces as marks, and libraries given to the renderers

## Status

Accepted

## Context

A Face was one of nine built-in shapes, each a thick Bézier line with an optional oval, morphed
number by number into another. People want faces of their own (star eyes, crossed eyes, a ring)
drawn as they would in a vector tool, and want the Clips, States and Faces they make in the Studio
to play in their apps. The renderers only knew the catalogue; the engine had a library of Clips
and States that nothing passed it.

## Decision

- A **Drawn Face** is the marks of its eyes: SVG paths on an artboard of 100 by 100 whose middle is
  the eye's place, filled and/or stroked with SVG's caps and joins. The eye on the left of the
  screen is drawn as seen; the right one mirrors it unless drawn too. Its name is exact and cannot
  be a built-in Face's or an Alias.
- `avatar-core` reads a Drawn Face once (`compileFace`) into filled polygons in each eye's frame,
  turned so that they fill together under SVG's `nonzero` rule, capped at 600 points per eye. The
  frame carries those shapes; the renderers draw an eye as one path of several subpaths, with no
  stroke of their own. SVG files are read in `avatar-core` without a DOM, so the same code runs on
  React Native's UI thread and in Node.
- Built-in Faces keep morphing (now through a capsule for straight and oval eyes). A change to or
  from a Drawn Face is a blink: the eyes shut on one shape, meet the other in a box between the
  two, and open on it. Lids squash a Drawn Face.
- Face names in Clips and States are kept as written and resolved when the face changes, against
  the player's Drawn Faces first: a name the avatar does not know shows `neutral`.
- A **Library** is `{ clips, states, faces }`, lists of named items as the Studio exports them.
  `readAvatarLibrary` reads it into an engine library. React and React Native take it as a prop,
  read again only when its content changes; React Native reads it on the JS thread and sends what
  it read to the UI thread. The web renderer takes it as an option and `setLibrary`.

## Consequences

- Apps play what creators make in the Studio by exporting `avatar-library.json`.
- `PlayerFrame.face` and the player's face fields are names (`string`), and `PlayerFrame.eyes` are
  built-in or drawn eyes: renderers of their own must handle both, or use `renderCharacterFrame`.
- Drawn Faces are one colour and have no holes beyond what their fills make; pupils, highlights and
  gradients would need layers of their own.
