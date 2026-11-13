# @bible-strong/avatar-web

DOM renderer for a Bible Strong avatar, without any framework. It mounts an inline SVG in an
element, runs the avatar's engine at every frame and returns a controller.

MIT licensed. Runs in the browser.

## Which package

| Target                       | Package                             |
| ---------------------------- | ----------------------------------- |
| Browser without React        | `@bible-strong/avatar-web`          |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` |
| Your own renderer, or a test | `@bible-strong/avatar-core`         |

All four read the same file: the character exported by
[Avatar Lab](https://avatars.bible-strong.app), or an `.avatar.json` of the first version, of
which only the character is kept (body, colours, outline, nose, mouth, perspective).

## Setup

```sh
npm install @bible-strong/avatar-web
```

`@bible-strong/avatar-core` comes as a dependency. There is no stylesheet to import.

## Minimal example

```js
import { createAvatar } from '@bible-strong/avatar-web'
import strobi from './strobi.avatar.json'

const avatar = createAvatar('#avatar', { character: strobi, state: 'idle', size: 96 })

avatar.setState('thinking')
avatar.poke('nod')
```

`createAvatar` checks the file, appends its own `span` to the target and starts. Call
`avatar.destroy()` before removing the target from the page.

Without a bundler, load the ESM build through an import map or a CDN and fetch the JSON:

```html
<div id="avatar"></div>
<script type="module">
  import { createAvatar } from 'https://cdn.example.com/avatar-web.js'

  const character = await fetch('./strobi.avatar.json').then(response => response.json())
  createAvatar('#avatar', { character })
</script>
```

## What an avatar does

Every character plays the same catalogue, exported by `@bible-strong/avatar-core`.

- **States** (`stateNames`, `stateGroups`): what the avatar is in, as the app declares it. A state
  draws its clips by its own rule; some hold a face, some turn the body into a spinner, some hand
  over to the next state when they are over (`finished` goes back to `idle`).
  - Lifecycle: idle, listening, thinking, streaming, searching, reading, working, coding, running,
    computing, controlling, waiting, blocked, finished, failed, sleeping, waking
  - Reactions: happy, excited, laughing, proud, curious, playful, shy, surprised, suspicious,
    angry, confused, sad, drowsy, bored, scared, celebrate, approving
  - Spinners: progress, spawning, dictating, sending, receiving, uploading, writing, alerting,
    bouncing, powering-down
  - Product: humming, notifying, dragging
  - Showcase: logo, showcase, turntable
  - Older names lead to their state: `dots` → `thinking`, `radar` → `searching`, `orbit` →
    `waiting`, `loading` → `progress`.
- **Clips** (`clipNames`): one piece of motion, played alone and round and round.
- **Faces** (`faceNames`): the shape of the eyes, held over whatever plays.
- **Gestures**: `nod`, `bounce`, `spin`, laid over whatever plays.

## Options of `createAvatar(target, options)`

`target` is a CSS selector or an `HTMLElement`.

| Option          | Type               | Default       | Behavior                                                       |
| --------------- | ------------------ | ------------- | -------------------------------------------------------------- |
| `character`     | `unknown`          | required      | The file, checked before anything is drawn.                    |
| `state`         | `string`           | `idle`        | The state the avatar starts in.                                |
| `clip`          | `string`           | —             | A clip to play alone instead of a state. A state wins over it. |
| `face`          | `string`           | —             | A face to hold whatever the avatar does.                       |
| `emphasis`      | `boolean`          | `false`       | A state without a face of its own shows surprise.              |
| `paused`        | `boolean`          | `false`       | Start still: nothing is computed until `resume()`.             |
| `followPointer` | `boolean`          | `false`       | The head follows the pointer.                                  |
| `seed`          | `number`           | from the name | Two avatars with the same seed draw the same clips.            |
| `size`          | `number \| string` | `240`         | Number of pixels, or a CSS value, for the width and height.    |
| `className`     | `string`           | —             | Class added to the mounted `span`, next to `bs-avatar`.        |
| `ariaLabel`     | `string`           | `Avatar`      | Accessible name of the image.                                  |
| `onStateChange` | function           | —             | Receives the new state, or `null` while a clip plays alone.    |

Under 48 pixels an avatar is compact: a state with a shorter list of clips uses it.

## Controller

| Method                  | Returns          | Behavior                                                         |
| ----------------------- | ---------------- | ---------------------------------------------------------------- |
| `setState(state)`       | `boolean`        | Goes into a state. `false` for a name the catalogue lacks.       |
| `playClip(clip)`        | `boolean`        | Plays one clip alone. `false` for a name the catalogue lacks.    |
| `setFace(face \| null)` | `void`           | Holds a face, or lets the avatar decide again.                   |
| `setEmphasis(on)`       | `void`           | See the option.                                                  |
| `poke(gesture, turns?)` | `void`           | Lays a gesture over what plays. Gestures add up.                 |
| `pause()` / `resume()`  | `void`           | Freezes the picture; what is asked meanwhile plays on `resume`.  |
| `setFollowPointer(on)`  | `void`           | See the option.                                                  |
| `getState()`            | `AvatarSnapshot` | `{ state, clip, paused }`.                                       |
| `destroy()`             | `void`           | Stops everything the avatar runs and removes the mounted `span`. |

## Errors thrown by `createAvatar`

| Message starts with               | Cause                            | Fix                              |
| --------------------------------- | -------------------------------- | -------------------------------- |
| `Avatar target '…' was not found` | The selector matches no element. | Call it once the element exists. |
| `Invalid avatar character`        | The file is not a character.     | Export it again from Avatar Lab. |
| `Invalid avatar definition`       | A first-version file is broken.  | Export it again from Avatar Lab. |

## Behavior to know

- The avatar always moves: `idle` plays its clips round and round. The frame loop stops while the
  avatar is out of view, and while it is paused.
- With `prefers-reduced-motion: reduce`, the avatar holds one settled picture, drawn again when it
  is asked for something.
- The body may move past its box while a clip plays (a jump, a stretch): the SVG does not clip
  it. Leave some room around the target.

## Check your integration

1. The avatar appears in the target and moves.
2. `avatar.setState('thinking')` returns `true`, and `onStateChange` receives `thinking`.
3. `avatar.destroy()` is called wherever the page removes the target.

## Versions

The package follows Semantic Versioning. Version 1 replaced the expressions and animations of
each avatar with the shared catalogue of states, clips, faces and gestures.
