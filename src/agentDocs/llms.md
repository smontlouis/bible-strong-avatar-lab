# Bible Strong Avatar Lab

> Procedural 2D avatars and the engine that animates them. A character (body, colours, outline,
> nose, mouth, eyes) plays one shared catalogue of states, clips, faces and gestures. Four MIT
> npm packages draw a character in React, React Native or plain JavaScript. The Studio at
> {{origin}}/ designs characters and clips in the browser. Strobi, the blue sphere, is the
> assistant of the Bible Strong app.

Everything below is plain text or JSON meant to be read by agents. `{{origin}}/llms-full.txt`
holds all the guides in one file.

## What do you need to do?

- **Show an avatar in an app**: pick the package for the target, read its guide from setup to
  checklist, and use a character file (yours, exported from the Studio, or one of the Studio's
  own below). A character never needs to be written by hand.
- **Make a new clip** (a piece of motion: a hop, a nod, a spin): read the clip guide. You write
  the clip as JSON and hand it over as a link to the Studio, where the person sees it, edits it
  and saves it. Look at your work on the frame sheet before handing it over.
- **Make a new character** (a fox, a robot): not documented for agents yet. A person builds
  characters in the Studio's Avatars tab and exports them.

## Put an avatar in an app

| Target                       | Package                             | Guide                                  |
| ---------------------------- | ----------------------------------- | -------------------------------------- |
| React DOM, React Native Web  | `@bible-strong/avatar-react`        | {{origin}}/docs/avatar-react.md        |
| React Native (iOS, Android)  | `@bible-strong/avatar-react-native` | {{origin}}/docs/avatar-react-native.md |
| Browser without React        | `@bible-strong/avatar-web`          | {{origin}}/docs/avatar-web.md          |
| Your own renderer, or a test | `@bible-strong/avatar-core`         | {{origin}}/docs/avatar-core.md         |

Each guide is the package's README, the same one that ships in `node_modules`. The three
renderers share one vocabulary: `createAvatar(character)` for a file known at build time, then
`state`, `lookAt`, `muted`, `settleAfterMs` and gestures over the shared catalogue.

### Character files

A character file is `<name>.avatar.json`, from the Studio's Export tab. The Studio's own
characters, ready to use:

{{characters}}

## Make a clip

- [Clip guide]({{origin}}/clip-authoring.md): the format, its units, the link that opens a clip
  in the Studio, the frame sheet, joins and loops, easing presets, the craft of motion, and a
  complete example.
- [Clip schema]({{origin}}/clip.schema.json): JSON Schema (draft 2020-12) of a clip.
- [Catalogue clips]({{origin}}/catalogue/clips.json): the 28 clips every avatar plays, by name.
  Read the ones closest to what you are asked for, and reuse their amplitudes and timing.
- [Catalogue states]({{origin}}/catalogue/states.json): the states an app asks for (`idle`,
  `thinking`, `happy`…), the clips each one draws and how.

A clip made this way plays in the Studio, on every avatar. The packages play the catalogue only:
putting a new clip into an app is not possible yet.

## Words

A **character** is what an avatar is; a **state** is what it is in; a **clip** is a piece of
motion of a set length, made of tracks with keys; a **face** is the shape of the eyes; a
**gesture** is a short move laid over the clip. The glossary:
https://github.com/smontlouis/bible-strong-avatar-lab/blob/main/CONTEXT.md

## Optional

- [All the guides in one file]({{origin}}/llms-full.txt)
- [Source code](https://github.com/smontlouis/bible-strong-avatar-lab): the packages are MIT,
  the Studio AGPL-3.0.
