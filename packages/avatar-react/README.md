# @bible-strong/avatar-react

React 19 renderer for a Bible Strong `AvatarDefinition` (an `.avatar.json` file exported by
[Avatar Lab](https://avatars.bible-strong.app)). It draws an inline SVG and animates it with
`requestAnimationFrame`.

MIT licensed. Runs in the browser, and in React Native Web.

## Which package

| Target                       | Package                             |
| ---------------------------- | ----------------------------------- |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` |
| Browser without React        | `@bible-strong/avatar-web`          |
| Your own renderer, or a test | `@bible-strong/avatar-core`         |

All four read the same `.avatar.json`.

## Setup

```sh
npm install @bible-strong/avatar-react
```

React and React DOM 19 are peer dependencies. `@bible-strong/avatar-core` comes as a dependency.
Import the stylesheet once, in the entry point of the application:

```tsx
import '@bible-strong/avatar-react/styles.css'
```

The component reads `window` when it renders: in a server-rendered application, render it in a
client component only.

## Minimal example

```tsx
import { createAvatar } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import avatarJson from './strobi.avatar.json'

// Validates the JSON once. `animation` and `expression` are typed with its keys.
const StrobiAvatar = createAvatar(avatarJson)

export function Assistant({ thinking }: { thinking: boolean }) {
  return <StrobiAvatar animation={thinking ? 'thinking' : 'idle'} size={96} />
}
```

`resolveJsonModule` must be on in `tsconfig.json` for the keys to be typed.

For a definition loaded at run time, use `Avatar` and validate first:

```tsx
import { parseAvatarDefinition } from '@bible-strong/avatar-core'
import { Avatar } from '@bible-strong/avatar-react'

const parsed = parseAvatarDefinition(jsonText)
if (!parsed.ok) throw new Error(parsed.errors[0].message)

<Avatar definition={parsed.value} defaultAnimation="idle" />
```

The definition is validated once per object reference, and the avatar starts again when that
reference changes: keep the validated object, do not rebuild it at every render.

## Props

### Target

| Prop                | Type                    | Default  | Behavior                                                                     |
| ------------------- | ----------------------- | -------- | ---------------------------------------------------------------------------- |
| `definition`        | `AvatarDefinition`      | required | The validated definition. Absent from a component made by `createAvatar`.    |
| `animation`         | `AnimationKey`          | —        | Controlled timeline. Changing it plays the new one from the frame on screen. |
| `expression`        | `ExpressionKey`         | —        | Controlled single expression, reached with a 420 ms transition.              |
| `defaultAnimation`  | `AnimationKey`          | —        | Uncontrolled initial timeline, read on mount.                                |
| `defaultExpression` | `ExpressionKey`         | —        | Uncontrolled initial expression, read on mount.                              |
| `autoplay`          | `boolean`               | `true`   | Starts `defaultAnimation` on mount.                                          |
| `ref`               | `Ref<AvatarController>` | —        | The imperative API below.                                                    |

`animation` with `expression`, or `defaultAnimation` with `defaultExpression`, throws: choose one.
A controlled target takes priority over an uncontrolled default.

### Presentation

| Prop        | Type               | Default             | Behavior                                                             |
| ----------- | ------------------ | ------------------- | -------------------------------------------------------------------- |
| `size`      | `number \| string` | `240`               | Number or CSS value for the width and height of the wrapper.         |
| `className` | `string`           | —                   | Class added to the wrapper.                                          |
| `style`     | `CSSProperties`    | —                   | Inline styles of the wrapper. `width` and `height` come from `size`. |
| `ariaLabel` | `string`           | `Procedural avatar` | Accessible name of the image.                                        |

The stylesheet exposes `.bs-avatar` (wrapper) and `.bs-avatar__svg`. To grey an avatar out, set
`style={{ filter: 'grayscale(1)' }}`.

### Callbacks

| Prop                 | Receives                                                               |
| -------------------- | ---------------------------------------------------------------------- |
| `onAnimationEnd`     | The key of a `once` animation when it completes.                       |
| `onExpressionChange` | The key of the displayed expression, on mount and whenever it changes. |
| `onError`            | An `AvatarRuntimeError` for an unknown key passed through props.       |

Without `onError`, the error is written with `console.error`.

## Imperative API

```tsx
const avatar = useRef<AvatarController>(null)

<StrobiAvatar ref={avatar} defaultAnimation="idle" />
<button onClick={() => avatar.current?.play('celebrate')}>Celebrate</button>
```

| Method                      | Returns               | Behavior                                                      |
| --------------------------- | --------------------- | ------------------------------------------------------------- |
| `play(animation)`           | `AvatarCommandResult` | Starts an animation, or resumes it when it is the paused one. |
| `setExpression(expression)` | `AvatarCommandResult` | Shows one expression.                                         |
| `pause()`                   | `void`                | Freezes the exact frame.                                      |
| `stop()`                    | `void`                | Returns an uncontrolled avatar to `neutral`.                  |
| `getState()`                | `AvatarPlaybackState` | `{ activeAnimation?, activeExpression, status }`.             |

`play` and `setExpression` return `{ ok: true }` or `{ ok: false, error }`.

| `error.code`          | Cause                                                           | Fix                          |
| --------------------- | --------------------------------------------------------------- | ---------------------------- |
| `unknown_animation`   | The key is not in `definition.animations`.                      | Use a key of the JSON.       |
| `unknown_expression`  | The key is not in `definition.expressions`.                     | Use a key of the JSON.       |
| `controlled_by_props` | `animation` or `expression` is set: the parent owns the target. | Change the prop, or drop it. |

`status` is `playing`, `paused` or `stopped`.

## Errors thrown on render

| Message starts with                             | Cause                               | Fix                                                |
| ----------------------------------------------- | ----------------------------------- | -------------------------------------------------- |
| `Invalid avatar definition`                     | The JSON does not match the schema. | Export it again from Avatar Lab, or read `errors`. |
| `Avatar accepts either animation or expression` | Two targets were given.             | Keep one.                                          |
| `window is not defined`                         | The component rendered on a server. | Render it in a client component.                   |

## Behavior to know

- The frame loop stops by itself on an expression with no blink and no ambient motion, and on a
  paused avatar.
- A pose held between two blinks is drawn once: nothing is computed until the next blink or step.
- An avatar scrolled out of view keeps its timeline and its callbacks, but is not drawn.
- With `prefers-reduced-motion: reduce`, transitions and ambient motion jump to their target.
- The avatar does not receive pointer events. Wrap it in a `button` to make it one.
- In a React Native app, do not render this package on iOS or Android: use
  `@bible-strong/avatar-react-native` there and keep this one for the `.web.tsx` file.

## Check your integration

1. `npx tsc --noEmit` passes, and a wrong animation key is a type error with `createAvatar`.
2. The avatar appears at the expected size: if it is unstyled, the stylesheet import is missing.
3. Changing `animation` moves the avatar from its current pose, without a jump.

## Versions

The public component never exposes Studio IDs or document types. The package follows Semantic
Versioning. While it remains below `1.0.0`, breaking API changes increment the minor version and
fixes increment the patch version.
