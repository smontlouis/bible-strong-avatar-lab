# @bible-strong/avatar-core

Validation, playback and scene generation for Bible Strong procedural avatars, with no React, DOM,
Motion or storage dependency. An avatar is one `.avatar.json` file exported by
[Avatar Lab](https://avatars.bible-strong.app); this package turns it into SVG path strings, frame
after frame.

MIT licensed. Runs in Node, in the browser, and on the UI thread of React Native.

## Which package

| Target                       | Package                             |
| ---------------------------- | ----------------------------------- |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` |
| Browser without React        | `@bible-strong/avatar-web`          |
| Your own renderer, or a test | `@bible-strong/avatar-core`         |

Install this package directly only to validate a definition, to type one, or to write a renderer.
The three renderers already depend on it.

## Setup

```sh
npm install @bible-strong/avatar-core
```

## The definition

```ts
type AvatarDefinition = {
  schema: 'bible-strong/avatar-definition'
  schemaVersion: 1
  name?: string
  body: { primary: Surface; nodes: BodyNode[] }
  colors: { body: HexColor; eyes: HexColor }
  style?: { outline?: { enabled: boolean; color: HexColor; width: number; opacity: number } }
  expressions: Record<ExpressionKey, AvatarExpressionDefinition>
  expressionOrder: ExpressionKey[]
  animations: Record<AnimationKey, AvatarAnimationDefinition>
  animationOrder: AnimationKey[]
}
```

- Keys are semantic, in kebab case (`happy`, `side-glance`). `neutral` always exists and comes
  first in `expressionOrder`.
- An animation is a list of steps. Each step names an expression, a transition (`spring`, `smooth`
  or `snappy`) and two durations: `transitionMs` to reach it, then `holdMs` on it.
- `playbackMode` is `loop`, `once` or `pingPong`.
- The JSON is the only source of what an avatar can play: nothing is added implicitly.
- Do not write a definition by hand. Author it in Avatar Lab and export it.

The JSON Schema (Draft 2020-12) is exported as `@bible-strong/avatar-core/schema`.

## Validate

```ts
import { parseAvatarDefinition, validateAvatarDefinition } from '@bible-strong/avatar-core'

// Untrusted text: enforces 256 KiB, a depth of 32 and no duplicate keys before the schema.
const parsed = parseAvatarDefinition(jsonText)

// A value already in memory, such as an imported JSON module.
const validated = validateAvatarDefinition(avatarJson)

if (!validated.ok) {
  const { path, code, message } = validated.errors[0]
  throw new Error(`${path}: ${message} (${code})`)
}
const definition = validated.value
```

Both return `{ ok: true, value }` or `{ ok: false, errors }` and never mutate the input. The value
is deeply frozen. Each error has an RFC 6901 JSON Pointer `path`, a `code` and a `message`.

| `code`                   | Meaning                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `invalid_json`           | The text is not JSON.                                           |
| `max_bytes`              | The text is over 256 KiB.                                       |
| `unknown_expression`     | An animation step names an expression that does not exist.      |
| `incomplete_order`       | `expressionOrder` or `animationOrder` misses a key.             |
| `unknown_order_key`      | An order lists a key that does not exist.                       |
| `neutral_not_first`      | `neutral` is not the first expression.                          |
| `invalid_interval_range` | A blink has `minIntervalMs` above `maxIntervalMs`.              |
| `unsupported_version`    | `schemaVersion` is not 1.                                       |
| other codes              | A schema rule, named after the JSON Schema keyword that failed. |

## Play and render

Playback is a pure state machine: you supply the clock and the random source.

```ts
import {
  advanceAvatarPlayback,
  playAvatarAnimation,
  renderAvatarFrame,
} from '@bible-strong/avatar-core'

const environment = { random: Math.random, reduceMotion: false }

const started = playAvatarAnimation(definition, 'idle', performance.now())
if (!started.ok) throw new Error(started.error.message)
let state = started.value

function tick(now: number) {
  state = advanceAvatarPlayback(definition, state, now, environment)
  const scene = renderAvatarFrame(definition, state, now, environment)
  draw(scene)
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
```

| Function                                                          | Use                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| `createAvatarPlaybackState()`                                     | A stopped state on `neutral`.                                  |
| `playAvatarAnimation(definition, key, now, from?)`                | A state playing `key`. `from` is the frame to transition from. |
| `advanceAvatarPlayback(definition, state, now, env)`              | The state at `now`. Call it once per frame.                    |
| `pauseAvatarPlayback(state, now)`                                 | Freezes the exact position.                                    |
| `resumeAvatarPlayback(state, now)`                                | Resumes where it paused.                                       |
| `sampleAvatarFrame(definition, state, now, env)`                  | The interpolated expression, colours and blink of a frame.     |
| `renderAvatarFrame(definition, state, now, env)`                  | The scene of a frame, ambient motion included.                 |
| `renderAvatarDefinition(definition, expressionKey?)`              | The static scene of one expression. Throws on an unknown key.  |
| `renderAvatarExpression(definition, expression, colors?, blink?)` | The scene of an expression you sampled yourself.               |
| `resolveAnimation`, `resolveExpression`                           | Look a key up, with a typed error.                             |

Functions that take a key return `{ ok: true, value }` or `{ ok: false, error }`, where
`error.code` is `unknown_animation` or `unknown_expression`.

With `reduceMotion: true`, transitions and ambient motion jump to their target; blinks declared by
an animation stay.

## The scene

Every render function returns the same shape. All paths share the view box `-150 -150 300 300`.

```ts
type AvatarScene = {
  geometry: {
    backPaths: string[] // body nodes behind the head, back to front
    headPath: string
    leftPath: string // left eye
    rightPath: string
    leftVisible: boolean
    rightVisible: boolean
    nosePath: string
    mouthPath: string
    mouthStrokeWidth: number // above 0: stroke the mouth; 0: fill it
    frontPaths: string[] // body nodes in front of the head
  }
  colors: { body: string; eyes: string }
  bodyColors: { back: string[]; front: string[] } // one colour per body path
}
```

`geometry` also carries `backNodeIds`, `frontNodeIds` and `wirePaths`, which a renderer of the
finished avatar does not need.

Draw in this order: `backPaths`, `headPath`, then eyes, nose and mouth clipped to `headPath`, then
`frontPaths`. A body node moves between `backPaths` and `frontPaths` as the head turns, so a
renderer keeps `definition.body.nodes.length + 2` slots on each side and reads an empty string for
an unused slot. When `definition.style.outline.enabled` is true, stroke the body and head paths
underneath with its colour, width and opacity.

## Entry points

- `@bible-strong/avatar-core`: everything above.
- `@bible-strong/avatar-core/schema`: the JSON Schema.
- `@bible-strong/avatar-core/geometry`, `/body`, `/surfaces`, `/ambient-motion`: pure primitives
  for renderer authors.

## Versions

Definitions from the earlier pre-release export may contain `standardAnimationSet: 1`; the marker
is accepted and adds no animation.

The package follows Semantic Versioning. While it remains below `1.0.0`, breaking API changes
increment the minor version and fixes increment the patch version.
