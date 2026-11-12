# @bible-strong/avatar-web

DOM renderer for a Bible Strong `AvatarDefinition` (an `.avatar.json` file exported by
[Avatar Lab](https://avatars.bible-strong.app)), without any framework. It mounts an inline SVG in
an element and returns a controller.

MIT licensed. Runs in the browser.

## Which package

| Target                       | Package                             |
| ---------------------------- | ----------------------------------- |
| Browser without React        | `@bible-strong/avatar-web`          |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` |
| Your own renderer, or a test | `@bible-strong/avatar-core`         |

All four read the same `.avatar.json`.

## Setup

```sh
npm install @bible-strong/avatar-web
```

`@bible-strong/avatar-core` comes as a dependency. There is no stylesheet to import.

## Minimal example

```js
import { createAvatar } from '@bible-strong/avatar-web'
import definition from './strobi.avatar.json'

const avatar = createAvatar('#avatar', {
  definition,
  defaultAnimation: 'idle',
  size: 96,
})

avatar.play('happy')
```

`createAvatar` validates the definition, appends its own `span` to the target and starts. Call
`avatar.destroy()` before removing the target from the page.

Without a bundler, load the ESM build through an import map or a CDN and fetch the JSON:

```html
<div id="avatar"></div>
<script type="module">
  import { createAvatar } from 'https://cdn.example.com/avatar-web.js'

  const definition = await fetch('./strobi.avatar.json').then(response => response.json())
  createAvatar('#avatar', { definition, defaultExpression: 'neutral' })
</script>
```

## Options of `createAvatar(target, options)`

`target` is a CSS selector or an `HTMLElement`.

| Option               | Type               | Default             | Behavior                                                  |
| -------------------- | ------------------ | ------------------- | --------------------------------------------------------- |
| `definition`         | `unknown`          | required            | The JSON definition, validated before anything is drawn.  |
| `defaultAnimation`   | `AnimationKey`     | —                   | Timeline started on mount.                                |
| `defaultExpression`  | `ExpressionKey`    | —                   | Expression shown on mount, without a timeline.            |
| `autoplay`           | `boolean`          | `true`              | Starts `defaultAnimation` on mount.                       |
| `size`               | `number \| string` | `240`               | Number or CSS value for the width and height.             |
| `className`          | `string`           | —                   | Class added to the mounted `span`, next to `bs-avatar`.   |
| `ariaLabel`          | `string`           | `Procedural avatar` | Accessible name of the image.                             |
| `onAnimationEnd`     | function           | —                   | Receives the key of a `once` animation when it completes. |
| `onExpressionChange` | function           | —                   | Receives the key of the displayed expression.             |
| `onError`            | function           | —                   | Receives an `AvatarRuntimeError` for an unknown key.      |

## Controller

| Method                      | Returns               | Behavior                                                      |
| --------------------------- | --------------------- | ------------------------------------------------------------- |
| `play(animation)`           | `AvatarCommandResult` | Starts an animation, or resumes it when it is the paused one. |
| `setExpression(expression)` | `AvatarCommandResult` | Shows one expression with a short transition.                 |
| `pause()`                   | `void`                | Freezes the exact frame.                                      |
| `stop()`                    | `void`                | Stops and returns to `neutral`.                               |
| `getState()`                | `AvatarPlaybackState` | `{ activeAnimation?, activeExpression, status }`.             |
| `destroy()`                 | `void`                | Cancels the scheduled frame and removes the mounted `span`.   |

`play` and `setExpression` return `{ ok: true }` or `{ ok: false, error }`, where `error.code` is
`unknown_animation` or `unknown_expression`: use a key of the JSON.

## Errors thrown by `createAvatar`

| Message starts with                                   | Cause                               | Fix                              |
| ----------------------------------------------------- | ----------------------------------- | -------------------------------- |
| `Avatar target '…' was not found`                     | The selector matches no element.    | Call it once the element exists. |
| `Invalid avatar definition`                           | The JSON does not match the schema. | Export it again from Avatar Lab. |
| `Choose either defaultAnimation or defaultExpression` | Two initial targets were given.     | Keep one.                        |

## Check your integration

1. The avatar appears in the target and blinks.
2. `avatar.play('<key>')` returns `{ ok: true }` for a key of the JSON.
3. `avatar.destroy()` is called wherever the page removes the target.

## Versions

The package follows Semantic Versioning. While it remains below `1.0.0`, breaking API changes
increment the minor version and fixes increment the patch version.
