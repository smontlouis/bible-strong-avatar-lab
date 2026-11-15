# Bible Strong Avatar Lab

> Procedural 2D avatars and the engine that animates them. A character (body, colours, outline,
> nose, mouth, eyes) plays one shared catalogue of states, clips, faces and gestures. Four MIT
> npm packages draw a character in React, React Native or plain JavaScript. The Studio at
> {{origin}}/ designs characters, clips and states in the browser. Strobi, the blue sphere, is the
> assistant of the Bible Strong app.

Everything below is plain text or JSON meant to be read by agents. `{{origin}}/llms-full.txt`
holds all the guides in one file.

## What do you need to do?

- **Show an avatar in an app**: pick the package for the target, read its guide from setup to
  checklist, and use a character file (yours, exported from the Studio, or one of the Studio's
  own below).
- **Make a new clip** (a piece of motion: a hop, a nod, a spin): read the clip guide.
- **Make a new state** (what the avatar does while an app is in some state: shuffled clips, a
  reaction that hands over to `idle`, a held face, a spinner): read the state guide. A state may
  bring new clips of its own.
- **Make a new character** (a fox, a robot, a flower): read the character guide.

The three work the same way. You write the clip, state or character as JSON and hand it over as a
link to the Studio, which opens it as a **draft** (nothing is saved until the person saves it), in
the browser of whoever opens it. Each kind has a view made for checking it in one screenshot: the
frame sheet of a clip, the run of a state, the character sheet. While the draft is shown, the
Studio rewrites the link with every change the person makes, and takes up at once a new link
written in the same tab: an agent driving the browser and the person work on the same draft. The
catalogue's clips and states and the Studio's characters are never changed: you make new ones, from
nothing or from a copy.

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
- [Catalogue clips]({{origin}}/catalogue/clips.json): the 28 clips every avatar plays, an object
  of clips by name. Read the ones closest to what you are asked for, and reuse their amplitudes and
  timing.
- [Catalogue states]({{origin}}/catalogue/states.json): the states an app asks for (`idle`,
  `thinking`, `happy`…), as `{ states, groups, aliases }`: each state by name, the states by group
  of use (Lifecycle, Reactions, Spinners, Product, Showcase), and older names.

A link `{{origin}}/#avatar=strobi&view=frames&clip={...}` opens a clip on the avatar named by its
file above, with the frame sheet; the guide says how to capture the sheet and read it.

## Make a state

- [State guide]({{origin}}/state-authoring.md): the format, the three rules (shuffled, once then
  next, for a time then next), held faces, spinners, small-size lists, clips brought along
  (`newClips`), the link, and the run that shows what a state does over time.
- [State schema]({{origin}}/state.schema.json).
- [Catalogue states]({{origin}}/catalogue/states.json), to learn from.

A link `{{origin}}/#avatar=strobi&state={...}` opens a state on an avatar, playing, with its run.

## Make a character

- [Character guide]({{origin}}/character-authoring.md): the file field by field, the drawing
  space, the nine surface types and their parameters, parts and how they sit in front of or behind
  the head, eyes, nose, mouth, outline, perspective, what breaks a character, the Studio's ten
  characters taken apart, and a complete fox.
- [Character schema]({{origin}}/schema/avatar-character.json): JSON Schema (draft 2020-12), the one
  the packages check a file against.

A link `{{origin}}/#character={...}` opens a character as a new avatar, with its sheet from every
side and with every face.

## What plays where

Clips, states and characters made this way live in the Studio, in the browser of the person who
saves them, and every avatar there plays every clip and state. A character file works in every
app (export it from the Studio). The packages play the catalogue's clips and states only: an
engine of `@bible-strong/avatar-core` can be given clips and states of its own
(`createAvatarEngine({ clips, states })`), the renderers cannot yet.

## Words

A **character** is what an avatar is; a **state** is what it is in; a **clip** is a piece of
motion of a set length, made of tracks with keys; a **face** is the shape of the eyes; a
**gesture** is a short move laid over the clip. The glossary:
https://github.com/smontlouis/bible-strong-avatar-lab/blob/main/CONTEXT.md

## Optional

- [All the guides in one file]({{origin}}/llms-full.txt)
- [Source code](https://github.com/smontlouis/bible-strong-avatar-lab): the packages are MIT,
  the Studio AGPL-3.0.
