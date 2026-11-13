# @bible-strong/avatar-core

The engine, the catalogue and the geometry of Bible Strong procedural avatars, with no React, DOM
or storage dependency. A character exported by [Avatar Lab](https://avatars.bible-strong.app)
plays the shared catalogue of states, clips, faces and gestures; this package turns it into SVG
path strings, frame after frame.

MIT licensed. Runs in Node, in the browser, and on the UI thread of React Native.

## Which package

| Target                       | Package                             |
| ---------------------------- | ----------------------------------- |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` |
| Browser without React        | `@bible-strong/avatar-web`          |
| Your own renderer, or a test | `@bible-strong/avatar-core`         |

Install this package directly only to read a character, to list the catalogue, or to write a
renderer. The three renderers already depend on it.

## Setup

```sh
npm install @bible-strong/avatar-core
```

## The character

```ts
type AvatarCharacter = {
  name?: string
  body: { primary: Surface; nodes: BodyNode[] }
  colors: { body: HexColor; eyes: HexColor }
  style?: { outline?: { enabled: boolean; color: HexColor; width: number; opacity: number } }
  face: {
    // The build of the eyes against the standard face: 1 is the standard size and gap.
    eyes: { width: number; height: number; gap: number; shiftY: number }
    nose?: Nose
    mouth?: Mouth
    perspective: number // 0 draws the face flat on the body
  }
}
```

A character carries no motion of its own: every character plays the same catalogue. Do not write
one by hand. Author it in Avatar Lab and export it.

## Read a file

```ts
import { characterOf, readCharacter } from '@bible-strong/avatar-core'

// A result to inspect…
const read = readCharacter(JSON.parse(jsonText))
if (!read.ok) throw new Error(`${read.errors[0].path}: ${read.errors[0].message}`)

// …or the character outright, with an error that names the first fault.
const character = characterOf(strobiJson)
```

`readCharacter` accepts a character, and an `.avatar.json` of the first version, of which only the
character is kept: body, colours, outline, nose, mouth, perspective and the height of the eyes. Its
expressions and animations are not read. `validateCharacter` accepts a character only, and
`validateAvatarDefinition` a file of the first version only. Each returns `{ ok: true, value }` or
`{ ok: false, errors }`, where each error has an RFC 6901 JSON Pointer `path`, a `code` and a
`message`; the value is a copy.

## The catalogue

| Export                   | What it is                                             |
| ------------------------ | ------------------------------------------------------ |
| `states`, `stateNames`   | The states, and how each draws its clips.              |
| `stateGroups`            | The states by group, for display only.                 |
| `stateAliases`           | Older names: `dots`, `radar`, `orbit`, `loading`.      |
| `resolveStateName(name)` | The state an alias leads to, or the name itself.       |
| `clips`, `clipNames`     | The clips, each a set of tracks with keys and easings. |
| `faces`, `faceNames`     | The nine shapes of the eyes.                           |
| `gestureNames`           | `nod`, `bounce`, `spin`.                               |
| `spinnerPatterns`        | The thirteen patterns of marks a body can turn into.   |

A state plays its clips by a rule: shuffled without end, a single clip looping, once then the next
state, or for a time then the next state. It may hold a face, and it may turn the body into a
spinner.

## Run an avatar

The engine is a plain mutable object. You supply the time step; it holds its own seeded random
source, so two engines with the same seed and the same steps draw the same clips.

```ts
import {
  advanceEngine,
  createAvatarEngine,
  engineFrame,
  renderCharacterFrame,
  seedOfName,
  setEngineState,
} from '@bible-strong/avatar-core'

const engine = createAvatarEngine({ seed: seedOfName(character.name ?? 'avatar') })
setEngineState(engine, 'idle')

let last: number | undefined
function tick(now: number) {
  advanceEngine(engine, last === undefined ? 0 : (now - last) / 1000)
  last = now
  draw(renderCharacterFrame(character, engineFrame(engine)))
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
```

| Function                                      | Use                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `createAvatarEngine({ seed?, compact? })`     | An engine at rest. `compact` picks the shorter lists of small sizes.   |
| `setEngineState(engine, name)`                | Goes into a state, from where the body is. An unknown name is a no-op. |
| `playEngineClip(engine, clip)`                | Plays one clip of `clips` alone, outside any state.                    |
| `setEngineFace(engine, face \| null)`         | Holds a face over everything, or lets the clip and the state decide.   |
| `setEngineEmphasis(engine, on)`               | A state without a face of its own holds `surprised`.                   |
| `pokeEngine(engine, gesture, turns?)`         | Lays a gesture over what plays. Gestures add up and fade away.         |
| `setEngineGaze(engine, [x, y] \| null)`       | Looks at a point, each axis from -1 to 1.                              |
| `setEngineLookAt(engine, [x, y] \| null)`     | Looks at a point whatever plays: 0.85 over a clip's turns of the head. |
| `engineAtRest(engine)`                        | No gesture, no turning gaze, no join back on its way.                  |
| `setEngineGazeAlways(engine, on)`             | On, the gaze is laid over a clip that plays; off, only a still body.   |
| `pauseEngine(engine)`, `resumeEngine(engine)` | Stops and restarts the clip where it is.                               |
| `stopEngine(engine)`                          | Leaves the avatar at rest: no state, no clip, no gesture.              |
| `seekEngine(engine, seconds)`                 | Puts the clip that plays at a time.                                    |
| `setEngineHandover(engine, on)`               | Off, a state that would hand over starts again instead.                |
| `setEnginePose(engine, pose \| null)`         | A pose set by hand takes the place of what the clip asks.              |
| `releaseEnginePose(engine)`                   | Lets the pose go, joining back to the clip.                            |
| `advanceEngine(engine, seconds)`              | Moves time on. A step is capped at a tenth of a second.                |
| `engineFrame(engine)`                         | What to draw now: the pose, the face, the eyelids, the spinner.        |
| `renderCharacterFrame(character, frame)`      | The scene of that frame for a character.                               |

`engine.state` is the state that plays, or `null` while a clip plays alone; `engine.player.clip`
is the clip. A state that hands over changes `engine.state` by itself: compare it after each step
to report it.

## The scene

`renderCharacterFrame` returns a `CharacterScene`. All paths share the view box
`-150 -150 300 300`.

```ts
type CharacterScene = {
  geometry: {
    backPaths: string[] // body nodes behind the head, back to front
    headPath: string
    leftPath: string // left eye
    rightPath: string
    leftVisible: boolean
    rightVisible: boolean
    nosePath: string
    mouthPath: string
    frontPaths: string[] // body nodes in front of the head
    frontClipPaths: string[] // one clip per front path, or an empty string
  }
  colors: { body: string; eyes: string }
  bodyColors: { back: string[]; front: string[] } // one colour per body path
  transform: [a, b, c, d, e, f] // how the clip moves the drawing: SVG `matrix(a b c d e f)`
  spinner: null | {
    marks: { d: string; opacity: number; strokeWidth?: number }[] // under the body, not moved
    round: number // 0 to 1: fade the parts and the face by it, draw `disc` with it as opacity
    disc: string
    opacity: number // of the body as a whole
  }
}
```

Draw the spinner's marks first, then, inside a group moved by `transform`: `backPaths`,
`headPath`, the eyes, nose and mouth clipped to `headPath`, `frontPaths`, and the disc. When
`frontClipPaths[i]` is not empty, clip `frontPaths[i]` by it: that path is the part of a coloured
node that is nearer than the head's surface (see below). A body node moves between `backPaths` and
`frontPaths` as the head turns, so a renderer keeps `character.body.nodes.length + 2` slots on
each side and reads an empty string for an unused slot. A spinner draws at most twelve marks at
once. When `character.style.outline.enabled` is true, stroke the body and head paths underneath
with its colour, width and opacity. A clip may move the body past the view box: do not clip it.

### Coloured nodes and the head

Two shapes of one colour merge into one flat area, so which is in front cannot be seen: a node
without a colour of its own is drawn wholly behind or wholly in front of the head, by the depth of
its centre. A node whose `color` differs from the body's is measured instead. It is in
`backPaths`, and it is in `frontPaths` too, with a clip, wherever its surface is nearer than the
head's: it sinks into the head along a line, as two solids would. A node that stands whole in
front of the head is in `frontPaths` only, without a clip.

The line is the true one where the two solids meet, found on the node's own surface and drawn as
curves through exact points. Every surface type works, as a head and as a node. Two things are
left out: the ears of `mickey` and the tip of `cursor`, which are drawn behind the head whatever
the node does, and two nodes against each other, which are sorted whole, by depth. Measuring a
node costs about as much as drawing two or three more nodes, and nothing for a node of the body's
colour.

`surfaceField(surface)` gives the function behind this: zero on the surface, negative inside,
growing outward, in the surface's own space.

### Static nodes

A body node turns with the head, as if the two were one object. A node with `followsHead: false`
is static: it keeps its place and its turn while the head rotates, and still moves with the head
when the head is moved. The head can then turn into a static node, and a coloured one sinks into
it along the same line as above.

## Entry points

- `@bible-strong/avatar-core`: everything above.
- `@bible-strong/avatar-core/schema`: the JSON Schema of a file of the first version.
- `@bible-strong/avatar-core/geometry`, `/body`, `/surfaces`: pure primitives for renderer
  authors.

## Versions

The package follows Semantic Versioning. Version 1 replaced the expressions and animations of each
avatar, and their playback (`playAvatarAnimation`, `renderAvatarFrame` and the rest), with the
engine and the shared catalogue. A file of the first version is still read, for its character.
