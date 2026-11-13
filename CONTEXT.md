# Avatar Lab Context

## Purpose

Bible Strong Avatar Lab builds procedural 2D avatars and the engine that animates them. A
creator builds a Character in the Studio; every Character plays the same catalogue of Clips,
States, Faces and Gestures. The runtime packages draw a Character and do not depend on the Studio.

## Ubiquitous language

### Character

What an avatar is, apart from what it does: its body, colours, outline, nose, mouth, the build of
its eyes (size, gap, height) and its perspective. A Character is what an app is given and what the
Studio exports.

### Avatar

A Character as the Studio keeps it, with a name and a place in the library. An Avatar owns no
Clip, State or Face.

### Body

The primary shape, which carries the face, and the parts set around it. A part may follow the
head's turn or stay still while the head turns.

### Clip

A piece of motion of a set length, made of tracks (position, rotation, stretch, zoom, eyelids,
face), each with its own keys and the easing between them. Clips are read-only data of the
catalogue. Avoid “animation” and “sequence”: everything the avatar does is animated, and a Clip's
tracks run side by side, not one after the other.

### Key

A value of a track at a time of a Clip, with the easing that leads to the next Key.

### Join

The short passage from where the body is to the starting pose of the next Clip, or back from a
Hand pose to the Clip. Avoid “transition” for it.

### State

What the avatar is in, as an app declares it (`thinking`, `finished`, `happy`). A State draws its
Clips by a Rule, may hold a Face and may turn the body into a Spinner. States are grouped
(Lifecycle, Reactions, Spinners, Product, Showcase) for display only; the group is not part of a
State's meaning.

### Rule

How a State plays its Clips: shuffled without end (each once a round), a single Clip looping,
once then the next State, or for a time then the next State.

### Hand over

A State's passing to the next State when its Rule says so. The engine hands over by default; the
Studio can keep the State instead, to look at it.

### Alias

A second name of a State that plays exactly what another plays (`dots` for `thinking`). The engine
leads an Alias to its State; the catalogue lists each State once.

### Face

The shape of the two eyes, one of nine (`neutral`, `happy`, `sleepy`…). The Clip asks for a Face,
a State may hold one over it, and a Face held from outside comes before both.

### Gesture

A short move laid over whatever plays (`nod`, `bounce`, `spin`). Gestures add up and fade away.

### Spinner

What the body turns into while a State asks for it: a disc in the body's colour with its pattern
of marks (`dots`, `radar`, `progress`…). The face fades out while it shows.

### Hand pose

A pose set by hand, by dragging the avatar or in the Pose tab. It pauses what plays; letting it go
joins back to the Clip where it waited.

### Player

The bar of the Studio that says what plays (State, Clip, time) and holds what lies over it: play
and stop, the held Face and the Gestures.

## Invariants

- A Character carries no Clip, State or Face of its own: all Characters play the same catalogue.
- The primary shape carries the face's coordinate frame; Faces work on any body.
- The Studio keeps one thing between visits: the library of Avatars.
- An Avatar of the first version keeps only its Character: its expressions and animations are not
  read.
- Geometry, the player and the engine stay independent from React.

## Architecture boundaries

- `packages/avatar-core` holds the geometry, the catalogue, the player and the engine.
- `packages/avatar-react`, `avatar-web` and `avatar-react-native` draw what the engine gives.
- `src/features/editor` is the Studio; its state lives in `useEditor`, its drawing in the stage.
- Motion that changes at every frame is drawn without going through React state.

Accepted architecture decisions live under `docs/adr/`.
