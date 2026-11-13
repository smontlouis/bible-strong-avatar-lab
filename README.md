# Bible Strong Avatar Lab

Bible Strong Avatar Lab is a browser-based studio for procedural 2D avatars, and the engine that
animates them. It combines 3D-inspired geometry with SVG rendering: you build a character, watch it
play a shared catalogue of states, clips, faces and gestures, and export it for your own product.

Website: [avatars.bible-strong.app](https://avatars.bible-strong.app) · Source: [GitHub](https://github.com/smontlouis/bible-strong-avatar-lab)

The application runs entirely in the browser. The library of avatars is stored locally; no account
or backend is required.

## What you can do

- Create, rename, duplicate and delete avatars, and import one from a file.
- Build a body from a primary surface and additional 3D-inspired parts, each with its own colour,
  and parts that follow the head's turn or stay still.
- Set the colours, the outline, the nose, the mouth, the size, gap and height of the eyes, and the
  perspective of the face.
- Pose the avatar by hand, by dragging it on the stage or in the Pose tab.
- Play any state of the catalogue (`idle`, `thinking`, `searching`, `happy`…), see how it draws
  its clips and hand over to the next state, or keep it.
- Explore every clip on a timeline: its tracks, its keys, its easings and its curves.
- Hold a face and lay gestures (`nod`, `bounce`, `spin`) over whatever plays.
- Take SVG or PNG pictures with transparent, solid, linear-gradient or radial-gradient
  backgrounds.
- Export the character as an `.avatar.json` file, with the instructions to put it in a React,
  React Native or JavaScript project.
- Use the interface in English, French or Simplified Chinese.

## How the Studio works

The stage is on the left and the inspector on the right, with a player at the bottom that says what
plays and holds the face and the gestures laid over it. The inspector has five tabs:

1. **Avatars** — the library: pick, create, duplicate, import or delete an avatar, and build its
   body, colours and face.
2. **Pose** — place the avatar by hand. Letting it go joins back to the clip where it waited.
3. **States** — play a state of the catalogue, see the clips it draws and by which rule, and
   choose whether it hands over to the next state.
4. **Clips** — play one clip alone and read it on its timeline.
5. **Export** — download the character, copy the instructions for an integration, or open Photo
   Mode.

The library is saved automatically in browser local storage. An avatar of the first version keeps
only its character: its expressions and animations are not read.

## The character and the catalogue

A character is what an avatar is, apart from what it does: its body, colours, outline, nose,
mouth, the build of its eyes and its perspective. Every character plays the same catalogue: about
fifty states, the clips they draw, nine faces, three gestures and thirteen spinner patterns. The
words are defined in [CONTEXT.md](./CONTEXT.md).

## Export

### The character file

**Export** downloads the character as `<name>.avatar.json`. The three renderers read it, and also
read an `.avatar.json` of the first version, of which they keep only the character.

### Runtime packages

Four MIT-licensed npm packages render a character. Choose by target:

| Target                       | Package                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| React DOM, React Native Web  | [`@bible-strong/avatar-react`](./packages/avatar-react/README.md)               |
| React Native (iOS, Android)  | [`@bible-strong/avatar-react-native`](./packages/avatar-react-native/README.md) |
| Browser without React        | [`@bible-strong/avatar-web`](./packages/avatar-web/README.md)                   |
| Your own renderer, or a test | [`@bible-strong/avatar-core`](./packages/avatar-core/README.md)                 |

The three renderers depend on `avatar-core` for reading files, the engine and geometry, and share
one vocabulary: `createAvatar` for a file known at build time, then `state`, `lookAt`, `muted`,
`settleAfterMs`, gestures and the rest over the shared catalogue.

Each package README is written to be followed step by step, by a person or by a coding agent:
setup, a minimal example, every prop, every error with its fix, and a checklist to verify the
integration. It ships in the npm tarball, so it is readable in `node_modules`. The Studio's
**Export** tab shows the install and a minimal example for each integration, and **Copy
instructions for AI** copies that package's README, with the avatar's file and names in its
examples.

### Photo Mode

Photo Mode exports the avatar on the stage as SVG or PNG. You can choose the resolution and use a
transparent, solid, linear-gradient or radial-gradient background.

## Getting started

### Requirements

- Node.js 22.12 or newer
- pnpm 10.34 (declared by the repository's `packageManager` field)

### Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

## Available commands

| Command           | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| `pnpm dev`        | Start Vite in development mode.                                 |
| `pnpm typecheck`  | Run TypeScript in strict, no-emit mode.                         |
| `pnpm test`       | Run the Vitest suite once.                                      |
| `pnpm test:watch` | Run Vitest in watch mode.                                       |
| `pnpm build`      | Create a production build in `dist/`.                           |
| `pnpm preview`    | Serve the production build locally.                             |
| `pnpm format`     | Format the repository with Prettier.                            |
| `pnpm check`      | Run formatting, type checking, tests, and the production build. |

## Validation

Before opening a pull request, run the complete local check:

```bash
pnpm check
```

The GitHub Actions workflow runs the same command on every push and pull request.

## Production build and deployment

Create the static production bundle:

```bash
pnpm build
```

The deployable site is written to `dist/`. Serve it locally before publishing:

```bash
pnpm preview
```

The application is a client-only Vite site with no server runtime or environment variables. The build uses relative asset paths, so the contents of `dist/` can be hosted at a domain root or a subpath, including a GitHub Pages project URL. Any static host that serves `index.html` can deploy it.

Vercel Web Analytics and Speed Insights are integrated in the React entry point. Enable both products in the Vercel project dashboard, then redeploy so their collection routes become available.

## Technical overview

- **React 19** coordinates the editor UI and durable application state.
- **TypeScript** is configured in strict mode.
- **Vite 8** provides the development server and production build.
- **SVG** renders the procedural avatar geometry; the engine's frames are written to it directly,
  without React renders. **Motion** drives the Studio's own gizmos and transitions.
- **Tailwind CSS 4** and reusable components under `src/components/ui/` provide the interface layer.
- **Vitest** covers geometry, the engine, the renderers, editing, persistence and export.

Geometry, the catalogue and the engine live in `packages/avatar-core` and remain
framework-independent. React state stores durable editor data; what changes at every frame is
drawn without going through React state.

## Repository map

| Path                   | Responsibility                                                               |
| ---------------------- | ---------------------------------------------------------------------------- |
| `packages/`            | The runtime packages: core engine and its React, web and native renderers.   |
| `src/app/`             | Application shell and global styles.                                         |
| `src/components/ui/`   | Reusable interface primitives.                                               |
| `src/features/editor/` | The Studio: avatar library, body construction, stage, photo mode, and tests. |
| `src/i18n/`            | Localized interface copy and translation tests.                              |
| `src/lib/`             | Small shared utilities without product-domain ownership.                     |
| `docs/adr/`            | Accepted architecture decisions.                                             |
| `legacy/`              | Self-contained HTML prototypes that preceded the React application.          |

## Persistence and privacy

There is no remote backend in this repository. The avatar library and interface language preference are stored in the browser's local storage. Exported files are generated locally in the browser. Clearing site data removes the local library, so saving each character as JSON is the recommended backup mechanism.

The library keeps the storage key and the shape of the first version, whose expressions and
animations are no longer read.

## Contributing

Keep domain calculations outside React components, keep what changes at every frame out of React
state, and add focused tests for domain changes.

English, French, and Simplified Chinese interface copy must stay synchronized across `src/i18n/index.ts` and `src/i18n/zh.ts`.

For the domain vocabulary, invariants, and architecture boundaries, read [CONTEXT.md](./CONTEXT.md).

## License

The repository holds two things under two licenses.

| What                                                              | License                               |
| ----------------------------------------------------------------- | ------------------------------------- |
| The runtime packages under `packages/` (`@bible-strong/avatar-*`) | [MIT](./packages/avatar-core/LICENSE) |
| The Studio: everything else in this repository                    | [GNU AGPL v3.0](./LICENSE)            |

The packages are what you install to show an avatar in your own product. Use them in any project,
open or closed, commercial or not; keep the copyright notice.

The Studio is the editor served at avatars.bible-strong.app. You may use, study, modify and
redistribute it. If you distribute it or offer a modified version to users over a network, you must
make the corresponding source available under the same license and keep the notices.

What you create with the Studio is yours: an exported `.avatar.json` and the pictures carry no
license obligation from this project.

See each `LICENSE` file for the complete and legally authoritative terms.
