# @bible-strong/avatar-react-native

React Native renderer for a Bible Strong `AvatarDefinition` (an `.avatar.json` file exported by
[Avatar Lab](https://avatars.bible-strong.app)). It draws with `react-native-svg` and samples every
frame on the UI thread with Reanimated, so an animated avatar costs the JS thread nothing.

MIT licensed. iOS and Android only.

## Which package

| Target                       | Package                             |
| ---------------------------- | ----------------------------------- |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        |
| Browser without React        | `@bible-strong/avatar-web`          |
| Your own renderer, or a test | `@bible-strong/avatar-core`         |

All four read the same `.avatar.json`. In an app that ships both native and web, put the native
renderer in `MyAvatar.tsx` and the web one in `MyAvatar.web.tsx`: this package throws on the web.

## Setup

Complete every step. The component throws on first render when step 3 is missing.

1. Install the package and its peers. `@bible-strong/avatar-core` comes as a dependency.

   ```sh
   npx expo install react-native-reanimated react-native-worklets react-native-svg
   npm install @bible-strong/avatar-react-native
   ```

2. Follow the Reanimated installation for your project, if it is not already done.

3. Turn on the **Bundle Mode** of `react-native-worklets` and forward the core to the UI thread.
   The upstream guide is at <https://docs.swmansion.com/react-native-worklets/docs/bundleMode/setup>.

   `babel.config.js`, with the worklets plugin last:

   ```js
   module.exports = {
     presets: ['babel-preset-expo'],
     plugins: [
       [
         'react-native-worklets/plugin',
         {
           bundleMode: true,
           importForwarding: { moduleNames: ['@bible-strong/avatar-core'] },
         },
       ],
     ],
   }
   ```

   `metro.config.js`:

   ```js
   const { getDefaultConfig } = require('expo/metro-config')
   const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode')

   module.exports = getBundleModeMetroConfig(getDefaultConfig(__dirname))
   ```

4. Restart Metro with a clean cache (`npx expo start --clear`). Rebuild the native app if
   Reanimated, Worklets or SVG were just added.

If the app also builds for the web or runs Jest, keep `bundleMode` off there
(`bundleMode: !isWeb && !isTest`) and keep the plain Metro configuration for a web-only run.
Under Jest the Bundle Mode check is skipped, so a test can render the component.

## Minimal example

```tsx
import { createAvatar } from '@bible-strong/avatar-react-native'
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
import { Avatar } from '@bible-strong/avatar-react-native'

const parsed = parseAvatarDefinition(jsonText)
if (!parsed.ok) throw new Error(parsed.errors[0].message)

<Avatar definition={parsed.value} defaultAnimation="idle" />
```

Keep the validated object and pass the same reference at every render. A new reference is a new
avatar: its playback starts again.

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

### Presentation

| Prop                 | Type                   | Default             | Behavior                                                                              |
| -------------------- | ---------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `size`               | `number`               | `240`               | Width and height, in density-independent pixels.                                      |
| `style`              | `StyleProp<ViewStyle>` | —                   | Style of the wrapping `View`. `width` and `height` come from `size`.                  |
| `accessibilityLabel` | `string`               | `Procedural avatar` | The avatar is exposed as one image with this name.                                    |
| `muted`              | `boolean`              | `false`             | Fades every colour to its grey in 300 ms.                                             |
| `settleAfterMs`      | `number`               | `0`                 | Stops sampling this long after a target starts, at the next held pose with eyes open. |
| `frameRate`          | `30 \| 60`             | `30`                | Frames sampled per second. 30 halves the work and stays fluid at small sizes.         |

The avatar does not receive touches. Wrap it in a `Pressable` to make it a button.

### Callbacks

| Prop                 | Receives                                                               |
| -------------------- | ---------------------------------------------------------------------- |
| `onAnimationEnd`     | The key of a `once` animation when it completes.                       |
| `onExpressionChange` | The key of the displayed expression, on mount and whenever it changes. |
| `onError`            | An `AvatarRuntimeError` for an unknown key passed through props.       |

Callbacks run on the JS thread, one frame or so after the UI thread reached the state. Without
`onError`, the error is written with `console.error`.

## Imperative API

```tsx
const avatar = useRef<AvatarController>(null)

<StrobiAvatar ref={avatar} defaultAnimation="idle" />
<Button title="Celebrate" onPress={() => avatar.current?.play('celebrate')} />
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

`getState()` answers at once with the target of the last command, then follows what the UI thread
reports. `status` is `playing`, `paused` or `stopped`.

## When it stops sampling

A pose held between two blinks is sampled once: nothing is computed on the UI thread until the
next blink or step. For an avatar whose expressions have no ambient motion, that is about four
frames in five.

Beyond that, the frame callback stops by itself, and starts again on the next command or prop
change:

- while the app is not active;
- on a paused avatar;
- on an expression with no blink and no ambient motion;
- on any expression, when the device asks for reduced motion;
- once `settleAfterMs` has elapsed and the pose is held.

Give `settleAfterMs` to any avatar that decorates a row, a card or a list: it plays its entrance,
then costs nothing. A muted avatar keeps moving unless you settle it:

```tsx
<StrobiAvatar animation="sleeping" muted={idle} settleAfterMs={idle ? 1 : 0} />
```

## Errors thrown on render

| Message starts with                                | Cause                                                       | Fix                                                |
| -------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| `… needs the Bundle Mode of react-native-worklets` | Step 3 of the setup is missing, or Metro kept an old cache. | Do step 3, then restart Metro with `--clear`.      |
| `… only renders on iOS and Android`                | The component was rendered on the web.                      | Render `@bible-strong/avatar-react` on the web.    |
| `Invalid avatar definition`                        | The JSON does not match the schema.                         | Export it again from Avatar Lab, or read `errors`. |
| `Avatar accepts either animation or expression`    | Two targets were given.                                     | Keep one.                                          |

## Do not

- Do not sample frames on the JS thread (`requestAnimationFrame` with `renderAvatarFrame`). Measured
  in a production app: 12 to 19 % of a core at rest, and a runaway loop in background.
- Do not write the paths with `setNativeProps`: about 64 ms a frame, against about 2 ms here.
- Do not import this package in a file that the web bundle loads.
- Do not rebuild the definition object at every render.

## Check your integration

1. `npx tsc --noEmit` passes, and a wrong animation key is a type error with `createAvatar`.
2. The avatar appears and blinks on an iOS simulator and on an Android emulator.
3. Changing `animation` moves the avatar from its current pose, without a jump.
4. No frame is sampled after the app goes to background.

## Versions

Verified with React Native 0.88, Reanimated 4.7, Worklets 0.13 and `react-native-svg` 15.16, on
iOS and Android. The peer ranges of Reanimated and Worklets start there, because Bundle Mode and
its import forwarding are recent. The `strictGlobal` option of the worklets plugin is not tested.

The package follows Semantic Versioning. While it remains below `1.0.0`, breaking API changes
increment the minor version and fixes increment the patch version.
