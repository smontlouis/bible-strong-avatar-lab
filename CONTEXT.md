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

A piece of motion of a set length, made of tracks (position, rotation, stretch, zoom, eyelids, eye size, opacity,
face), each with its own keys and the easing between them. The catalogue's Clips are read-only
data. Avoid “animation” and “sequence”: everything the avatar does is animated, and a Clip's
tracks run side by side, not one after the other.

### Custom Clip

A Clip a creator keeps in the Studio, saved from a Draft; the Clip it was copied from stays as it
was. It has the shape of a catalogue Clip and a name no catalogue Clip has. Custom Clips are kept
by the Studio beside the Avatars, not inside one: every Avatar plays them, and Custom States draw
them. Apps play them through a Library. Shown as “My clips”.

### Custom State

A State a creator keeps in the Studio, saved from a Draft, beside the catalogue's States, which
stay read-only. It draws catalogue Clips and Custom Clips by one of the three Rules, may hold a
Face and turn the body into a Spinner, and hands over to any State. Its name is not a catalogue
State's nor an Alias. Shown as "My states".

### Draft

The Clip, State, Character or Drawn Face being made, before it is saved: a new one, a copy, a saved one opened
again, or one opened from a link. A Draft lives in the address of the page, not in the browser's
storage: every change rewrites the address, and a new address changes the Draft. It is how a
person and an agent work on the same thing. There is one Draft of each kind at a time; the address
holds the Draft of the tab shown. A State Draft may bring new Clips of its own, saved with it. A
Character Draft is an Avatar marked as a draft until it is saved among the Avatars.

### Run

What a State does over time from the moment the avatar enters it, as an engine with a fixed seed
plays it: each play of a Clip, each Join, the hand-over and what follows. Shown with each State.

### Sheet

A Clip, or a State's Run, drawn at every frame of a rate, side by side, with the curves of its
tracks: the whole motion in one picture, read the way an animator checks spacing. A Character's
sheet shows it from every side and with every Face. Avoid “filmstrip” and “storyboard”.

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

The shape of the two eyes: one of nine built in (`neutral`, `happy`, `sleepy`…), or a Drawn Face.
The Clip asks for a Face, a State may hold one over it, and a Face held from outside comes before
both. A name the avatar does not know shows `neutral`.

### Drawn Face

A Face made of Marks, kept in the Studio beside the Custom Clips and States and named by its exact
name, never a built-in Face's or an Alias. Each eye is drawn on the Artboard; the right one mirrors
the left unless drawn too. It comes and goes with a blink, where built-in Faces morph. Shown as
“My faces”.

### Mark

One path of a Drawn Face's eye, filled, stroked (with a width, ends and corners), or both. The
Marks of an eye add up to one shape in the Character's eye colour.

### Artboard

The square of 100 by 100 a Drawn Face's eye is drawn on, y down; its middle is where the eye sits.

### Library

What an app gives an avatar besides the catalogue: Custom Clips, Custom States and Drawn Faces,
each with its name, as the Studio's Export tab downloads it (`avatar-library.json`).

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
