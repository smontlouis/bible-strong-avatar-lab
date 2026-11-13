# @bible-strong/avatar-react

React 19 renderer for a Bible Strong avatar. It draws an inline SVG once and writes each frame of
the avatar's engine on it with `requestAnimationFrame`, without a render of React.

MIT licensed. Runs in the browser, and in React Native Web.

## Which package

| Target                       | Package                             |
| ---------------------------- | ----------------------------------- |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` |
| Browser without React        | `@bible-strong/avatar-web`          |
| Your own renderer, or a test | `@bible-strong/avatar-core`         |

All four read the same file: the character exported by
[Avatar Lab](https://avatars.bible-strong.app), or an `.avatar.json` of the first version, of
which only the character is kept (body, colours, outline, nose, mouth, perspective).

## Setup

```sh
npm install @bible-strong/avatar-react
```

React and React DOM 19 are peer dependencies. `@bible-strong/avatar-core` comes as a dependency.
There is no stylesheet to import.

The component reads `window` when it renders: in a server-rendered application, render it in a
client component only.

## Minimal example

```tsx
import { createAvatar } from '@bible-strong/avatar-react'
import strobi from './strobi.avatar.json'

// Checks the file once.
const Strobi = createAvatar(strobi)

export function Assistant({ thinking }: { thinking: boolean }) {
  return <Strobi state={thinking ? 'thinking' : 'idle'} size={96} />
}
```

For a character already checked, use `Avatar`:

```tsx
import { readCharacter } from '@bible-strong/avatar-core'
import { Avatar } from '@bible-strong/avatar-react'

const read = readCharacter(JSON.parse(jsonText))
if (!read.ok) throw new Error(read.errors[0].message)

<Avatar character={read.value} state="idle" />
```

## What an avatar does

Every character plays the same catalogue, exported by `@bible-strong/avatar-core`: states
(`stateNames`, `stateGroups`), clips (`clipNames`), faces (`faceNames`) and the gestures `nod`,
`bounce` and `spin`. The README of `@bible-strong/avatar-web` lists the states by group.

## Props

| Prop            | Type                | Default       | Behavior                                                        |
| --------------- | ------------------- | ------------- | --------------------------------------------------------------- |
| `character`     | `AvatarCharacter`   | required      | Absent from a component made by `createAvatar`.                 |
| `state`         | `string`            | `idle`        | What the avatar is in. Changing it goes there from where it is. |
| `clip`          | `string`            | —             | A clip to play alone, round and round. A state wins over it.    |
| `face`          | `string`            | —             | A face to hold whatever the avatar does.                        |
| `pose`          | `FreePose`          | —             | A pose set by hand, which pauses what plays (for an editor).    |
| `paused`        | `boolean`           | `false`       | Stops the avatar where it is: nothing is computed meanwhile.    |
| `lookAt`        | `[x, y] \| null`    | `null`        | A point to look at: right and up, each from -1 to 1.            |
| `followPointer` | `boolean`           | `false`       | The head follows the pointer. `lookAt` comes before it.         |
| `emphasis`      | `boolean`           | `false`       | A state without a face of its own shows surprise.               |
| `muted`         | `boolean`           | `false`       | Fades every colour to its grey in 300 ms (a CSS filter).        |
| `settleAfterMs` | `number`            | `0`           | Holds the pose this long after the last change, eyes open.      |
| `seed`          | `number`            | from the name | Two avatars with the same seed draw the same clips.             |
| `size`          | `number \| string`  | `240`         | Width and height. A number is in pixels.                        |
| `className`     | `string`            | —             | Class of the `svg`.                                             |
| `style`         | `CSSProperties`     | —             | Inline styles of the `svg`.                                     |
| `ariaLabel`     | `string`            | `Avatar`      | Accessible name of the image.                                   |
| `onStateChange` | function            | —             | Receives the new state, or `null` while a clip plays alone.     |
| `ref`           | `Ref<AvatarHandle>` | —             | `poke(gesture, turns?)` lays a gesture over what plays.         |

An unknown state or clip changes nothing. Under 48 pixels an avatar is compact: a state with a
shorter list of clips uses it.

## Looking at a point

`lookAt={[x, y]}` turns the head towards a point, `x` to the right and `y` up, each from -1 to 1:
`[-0.6, 0.2]` is up and to the left. The head turns there smoothly, from one point to the next,
and back when `lookAt` is `null`, whatever the avatar plays. Over a state or a clip the clip goes
on: the gaze weighs 0.85 over its turns of the head, so it keeps a little of its own. A spinner has
no head to turn. A new array of the same point is not a change.

## Behavior to know

- The avatar always moves: `idle` plays its clips round and round. The frame loop stops while the
  avatar is out of view, while it is paused, and once `settleAfterMs` has passed since the last
  change, at a moment its eyes are open and no gesture plays. A prop change, a `poke`, or the
  pointer it follows wakes it. Give `settleAfterMs` to an avatar that decorates a row, a card or
  a list.
- With `prefers-reduced-motion: reduce`, the avatar holds one settled picture, drawn again when a
  prop changes.
- The body may move past its box while a clip plays: the `svg` has `overflow: visible`. Leave some
  room around it.
- The avatar does not receive pointer events. Wrap it in a `button` to make it one.
- In a React Native app, do not render this package on iOS or Android: use
  `@bible-strong/avatar-react-native` there and keep this one for the `.web.tsx` file.

## Errors thrown

| Message starts with         | Cause                               | Fix                              |
| --------------------------- | ----------------------------------- | -------------------------------- |
| `Invalid avatar character`  | `createAvatar` got no character.    | Export it again from Avatar Lab. |
| `Invalid avatar definition` | A first-version file is broken.     | Export it again from Avatar Lab. |
| `window is not defined`     | The component rendered on a server. | Render it in a client component. |

## Check your integration

1. The avatar appears at the expected size and moves.
2. Changing `state` moves the avatar from its current pose, without a jump, and `onStateChange`
   receives it.

## Upgrading from 0.x

Version 1 replaces each avatar's own expressions and animations with one shared catalogue of
states, clips, faces and gestures. Keep your `.avatar.json`: `createAvatar` still reads it and keeps
its character (body, colours, outline, nose, mouth, perspective, the height of the eyes). Its
expressions and animations are no longer read.

The standard animations of the first version are states of the catalogue under the same names:
`idle`, `sleeping`, `waking`, `listening`, `thinking`, `searching`, `working`, `excited`, `bored`,
`suspicious`, `angry`, `drowsy`, `happy`, `curious`, `confused`, `surprised`, `proud`, `shy`, `sad`,
`laughing`, `scared`, `playful`, `celebrate`. An animation or an expression you created under
another name is not carried over: pick the nearest state, or one of the nine faces (`neutral`,
`happy`, `surprised`, `sad`, `sleepy`, `squinted`, `calm`, `inspecting`, `confused`). Some states
look different: `thinking` now turns the body into a spinner of three dots.

| 0.x                                                                    | 1.0                                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `createAvatar(definitionJson)`                                         | Unchanged. The keys are no longer typed from the JSON: `state` is a string.      |
| `<Avatar definition={validated} />`                                    | `<Avatar character={readCharacter(json).value} />` (`@bible-strong/avatar-core`) |
| `animation`, `defaultAnimation`, `autoplay`                            | `state`                                                                          |
| `expression`, `defaultExpression`                                      | `face` for one of the nine faces, or a `state`                                   |
| `ref.current.play(key)`                                                | Change `state`                                                                   |
| `ref.current.setExpression(key)`                                       | Change `face`                                                                    |
| `ref.current.pause()`, `ref.current.stop()`                            | `paused`                                                                         |
| `ref.current.getState()`                                               | `onStateChange`                                                                  |
| `onAnimationEnd`                                                       | `onStateChange`: a state that hands over (`waking` → `idle`) reports the next    |
| `onExpressionChange`, `onError`, `controlled_by_props`                 | Removed: an unknown state or clip changes nothing                                |
| `import '@bible-strong/avatar-react/styles.css'`                       | Remove it: the package ships no stylesheet                                       |
| `filter: grayscale(1)` and a timer to pause                            | `muted` and `settleAfterMs`                                                      |
| Types `AvatarController`, `AvatarCommandResult`, `AvatarPlaybackState` | `AvatarHandle`, whose only method is `poke(gesture)`                             |

`className` and `style` now apply to the `svg` itself: there is no wrapper any more. The avatar
always moves (`idle` plays its clips round and round); give `settleAfterMs` to one that only
decorates a row or a card.

## Versions

The package follows Semantic Versioning; every version is described in `CHANGELOG.md`, shipped in
the package. Version 1 replaced the expressions and animations of
each avatar with the shared catalogue of states, clips, faces and gestures, and dropped the
stylesheet. To move from 0.x, see « Upgrading from 0.x ».
