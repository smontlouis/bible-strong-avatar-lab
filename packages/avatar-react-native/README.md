# @bible-strong/avatar-react-native

React Native renderer for a Bible Strong avatar. It draws with `react-native-svg`, and the avatar's
engine runs on the UI thread with Reanimated: an animated avatar costs the JS thread nothing.

MIT licensed. iOS and Android only.

## Which package

| Target                       | Package                             |
| ---------------------------- | ----------------------------------- |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        |
| Browser without React        | `@bible-strong/avatar-web`          |
| Your own renderer, or a test | `@bible-strong/avatar-core`         |

All four read the same file: the character exported by
[Avatar Lab](https://avatars.bible-strong.app), or an `.avatar.json` of the first version, of
which only the character is kept (body, colours, outline, nose, mouth, perspective). In an app
that ships both native and web, put the native renderer in `MyAvatar.tsx` and the web one in
`MyAvatar.web.tsx`: this package throws on the web.

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
import strobi from './strobi.avatar.json'

// Checks the file once.
const Strobi = createAvatar(strobi)

export function Assistant({ thinking }: { thinking: boolean }) {
  return <Strobi state={thinking ? 'thinking' : 'idle'} size={96} />
}
```

For a character already checked (`readCharacter` of `@bible-strong/avatar-core`), render `Avatar`
with `character`. Keep the same object at every render: another object is another avatar, which
starts afresh.

## What an avatar does

Every character plays the same catalogue, exported by `@bible-strong/avatar-core`: states
(`stateNames`, `stateGroups`), clips (`clipNames`), faces (`faceNames`) and the gestures `nod`,
`bounce` and `spin`. The README of `@bible-strong/avatar-web` lists the states by group.

## Props

| Prop                 | Type                   | Default       | Behavior                                                           |
| -------------------- | ---------------------- | ------------- | ------------------------------------------------------------------ |
| `character`          | `AvatarCharacter`      | required      | Absent from a component made by `createAvatar`.                    |
| `state`              | `string`               | `idle`        | What the avatar is in. Changing it goes there from where it is.    |
| `clip`               | `string`               | —             | A clip to play alone, round and round. A state wins over it.       |
| `face`               | `string`               | —             | A face to hold whatever the avatar does.                           |
| `lookAt`             | `[x, y] \| null`       | `null`        | A point to look at: right and up, each from -1 to 1.               |
| `paused`             | `boolean`              | `false`       | Stops the avatar where it is: nothing is computed meanwhile.       |
| `emphasis`           | `boolean`              | `false`       | A state without a face of its own shows surprise.                  |
| `seed`               | `number`               | from the name | Two avatars with the same seed draw the same clips.                |
| `size`               | `number`               | `240`         | Width and height, in density-independent pixels.                   |
| `style`              | `StyleProp<ViewStyle>` | —             | Style of the wrapping `View`. `width` and `height` come from size. |
| `accessibilityLabel` | `string`               | `Avatar`      | The avatar is exposed as one image with this name.                 |
| `muted`              | `boolean`              | `false`       | Fades every colour to its grey in 300 ms.                          |
| `settleAfterMs`      | `number`               | `0`           | Holds the pose this long after the last change, eyes open.         |
| `frameRate`          | `30 \| 60`             | `30`          | Frames computed per second on the UI thread.                       |
| `onStateChange`      | function               | —             | Receives the new state, or `null` while a clip plays alone.        |
| `ref`                | `Ref<AvatarHandle>`    | —             | `poke(gesture, turns?)` lays a gesture over what plays.            |

An unknown state or clip changes nothing. Under 48 points an avatar is compact: a state with a
shorter list of clips uses it. `onStateChange` runs on the JS thread, a frame or so after the UI
thread changed state. The avatar does not receive touches: wrap it in a `Pressable`.

The body may move past its box while a clip plays (a jump, a stretch). The SVG is drawn half as
large again as the box, centred on it, so that nothing is cut: leave some room around the avatar.

## Looking at a point

`lookAt={[x, y]}` turns the head towards a point, `x` to the right and `y` up, each from -1 to 1:
`[-0.6, 0.2]` is up and to the left. The head turns there smoothly, from one point to the next,
and back when `lookAt` is `null`, whatever the avatar plays. Over a state or a clip the clip goes
on: the gaze weighs 0.85 over its turns of the head, so it keeps a little of its own. A spinner has
no head to turn. A new array of the same point is not a change.

## When it stops computing

The avatar always moves: `idle` plays its clips round and round. The frame callback stops, and
starts again on the next prop change or `poke`:

- while the app is not active;
- while the avatar is paused;
- when the device asks for reduced motion: the avatar holds one settled picture;
- once `settleAfterMs` has passed since the last change, at a moment the eyes are open.

Give `settleAfterMs` to any avatar that decorates a row, a card or a list: it moves for a moment,
then costs nothing. A muted avatar keeps moving unless you settle it:

```tsx
<Strobi state="sleeping" muted={idle} settleAfterMs={idle ? 1 : 0} />
```

## Errors thrown on render

| Message starts with                                | Cause                                                       | Fix                                           |
| -------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| `… needs the Bundle Mode of react-native-worklets` | Step 3 of the setup is missing, or Metro kept an old cache. | Do step 3, then restart Metro with `--clear`. |
| `… only renders on iOS and Android`                | The component was rendered on the web.                      | Render `@bible-strong/avatar-react` there.    |
| `Invalid avatar character`                         | `createAvatar` got no character.                            | Export it again from Avatar Lab.              |
| `Invalid avatar definition`                        | A first-version file is broken.                             | Export it again from Avatar Lab.              |

## Do not

- Do not run the engine on the JS thread with `requestAnimationFrame`: measured in a production
  app with the first version, 12 to 19 % of a core at rest, and a runaway loop in background.
- Do not write the paths with `setNativeProps`: about 64 ms a frame under Fabric.
- Do not import this package in a file that the web bundle loads.
- Do not rebuild the character object at every render.

## Check your integration

1. The avatar appears and moves on an iOS simulator and on an Android emulator.
2. Changing `state` moves the avatar from its current pose, without a jump, and `onStateChange`
   receives it.
3. `state="searching"` turns the body into a spinner.
4. No frame is computed after the app goes to background.

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

| 0.x                                                                                          | 1.0                                                                              |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `createAvatar(definitionJson)`                                                               | Unchanged. The keys are no longer typed from the JSON: `state` is a string.      |
| `<Avatar definition={validated} />`                                                          | `<Avatar character={readCharacter(json).value} />` (`@bible-strong/avatar-core`) |
| `animation`, `defaultAnimation`, `autoplay`                                                  | `state`                                                                          |
| `expression`, `defaultExpression`                                                            | `face` for one of the nine faces, or a `state`                                   |
| `ref.current.play(key)`                                                                      | Change `state`                                                                   |
| `ref.current.setExpression(key)`                                                             | Change `face`                                                                    |
| `ref.current.pause()`, `ref.current.stop()`                                                  | `paused`                                                                         |
| `ref.current.getState()`                                                                     | `onStateChange`                                                                  |
| `onAnimationEnd`                                                                             | `onStateChange`: a state that hands over (`waking` → `idle`) reports the next    |
| `onExpressionChange`, `onError`, `controlled_by_props`                                       | Removed: an unknown state or clip changes nothing                                |
| `muted`, `frameRate`                                                                         | Unchanged                                                                        |
| `settleAfterMs`, counted from the start of an animation                                      | Counted from the last change of a prop, or `poke`                                |
| Types `AvatarController`, `AvatarCommandResult`, `AvatarPlaybackState`, `AvatarRuntimeError` | `AvatarHandle`, whose only method is `poke(gesture)`                             |

The setup does not change: Bundle Mode, with `@bible-strong/avatar-core` in
`importForwarding.moduleNames`. The avatar always moves (`idle` plays its clips round and round), so
the frame callback no longer stops by itself on a still expression; give `settleAfterMs` to an avatar
that only decorates a row or a card. The SVG is drawn half as large again as the box so that a jump
is not cut: leave some room around the avatar.

## Versions

Verified with React Native 0.88, Reanimated 4.7, Worklets 0.13 and `react-native-svg` 15.16. The
peer ranges of Reanimated and Worklets start there, because Bundle Mode and its import forwarding
are recent. The `strictGlobal` option of the worklets plugin is not tested.

The package follows Semantic Versioning; every version is described in `CHANGELOG.md`, shipped in
the package. Version 1 replaced the expressions and animations of
each avatar with the shared catalogue of states, clips, faces and gestures. To move from 0.x, see « Upgrading from 0.x ».
