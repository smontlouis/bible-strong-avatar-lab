# Bible Strong Avatar Lab

Bible Strong Avatar Lab is a browser-based authoring studio for procedural 2D avatars. It combines 3D-inspired geometry with SVG rendering so you can construct a character, define its neutral appearance, create expressions, compose reusable animations, and export the result without depending on the Studio UI.

Website: [avatars.bible-strong.app](https://avatars.bible-strong.app) · Source: [GitHub](https://github.com/smontlouis/bible-strong-avatar-lab)

The application runs entirely in the browser. Projects are stored locally and can be moved between browsers with JSON export/import; no account or backend is required.

## What you can do

- Create, rename, duplicate, reorder, and delete avatars.
- Build a body from a primary facial surface and additional 3D-inspired primitives.
- Adjust dimensions, roundness, position, local rotation, perspective, colors, and wireframe guides.
- Edit each eye independently or link their size, proportions, and position.
- Manipulate the avatar directly on the canvas with translation and rotation controls.
- Save, duplicate, reorder, and delete reusable expressions.
- Add temporary body and eye color overrides to an expression.
- Add subtle ambient movement to the body and eyes.
- Build animations from expression steps with custom hold times and transitions.
- Choose loop, play-once, or ping-pong playback and configure automatic blinking.
- Preview, play, pause, and stop animations inside the Studio.
- Take SVG or PNG snapshots with transparent, solid, linear-gradient, or radial-gradient backgrounds.
- Export one portable `.avatar.json` definition for React or framework-free JavaScript/ESM.
- Export and import the complete Studio project as JSON.
- Use the interface in English, French, or Simplified Chinese.

## How the Studio works

The workspace has a live canvas on the left and an inspector on the right. Start by selecting an avatar, then move through the four main areas:

1. **Pose** — inspect a temporary pose or open the avatar editor to change the character's durable body, colors, and neutral eyes.
2. **Expressions** — create named visual presets. Expression eye values are relative to the avatar's neutral appearance, so the same behavior remains compatible with different body surfaces.
3. **Animations** — arrange expressions on a timeline, tune step duration and transition style, choose a playback mode, and configure blinking.
4. **Export** — choose animations to include, download an integration package, configure Photo Mode, or back up the full Studio project.

Changes to the Studio document are saved automatically in browser local storage. Unsaved edits inside an avatar, expression, or animation editor can still be cancelled. Use **Export → Studio project** to create a portable JSON backup before clearing browser data or moving to another device.

## Avatars and behavior libraries

An avatar owns its body geometry, colors, and neutral eye appearance. Expressions and animations initially come from the bundled base behavior library.

When an avatar's expressions or animations are edited for the first time, the Studio copies both collections into an avatar-specific behavior library. From that point on, behavior changes affect only that avatar. Duplicating an avatar also duplicates its custom behavior, and transferring an animation includes every expression it references.

This copy-on-write model lets multiple avatars share the defaults without accidental cross-avatar edits while keeping customized characters fully independent.

## Export formats

### Avatar definition

The selected avatar and animations are stored in one portable `.avatar.json` definition. React and
JavaScript use this exact same file, so visual behavior does not diverge between renderers.

### Runtime packages

Four MIT-licensed npm packages render the definition. Choose by target:

| Target                       | Package                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| React DOM, React Native Web  | [`@bible-strong/avatar-react`](./packages/avatar-react/README.md)               |
| React Native (iOS, Android)  | [`@bible-strong/avatar-react-native`](./packages/avatar-react-native/README.md) |
| Browser without React        | [`@bible-strong/avatar-web`](./packages/avatar-web/README.md)                   |
| Your own renderer, or a test | [`@bible-strong/avatar-core`](./packages/avatar-core/README.md)                 |

The three renderers depend on `avatar-core` for validation, playback and geometry, and share one
API: `createAvatar` for a definition known at build time, the same props or options, the same
controller (`play`, `pause`, `stop`, `setExpression`, `getState`) and the same typed errors.

Each package README is written to be followed step by step, by a person or by a coding agent:
setup, a minimal example, every prop, every error with its fix, and a checklist to verify the
integration. It ships in the npm tarball, so it is readable in `node_modules`. The Studio's
**Export** tab copies the same instructions for React and JavaScript.

The integration ZIP of the JavaScript export contains the `.avatar.json`, a lightweight ESM wrapper
and usage instructions; it does not copy the rendering engine into every avatar export.

### Photo Mode

Photo Mode exports the currently rendered avatar as SVG or PNG. You can choose the resolution and use a transparent, solid, linear-gradient, or radial-gradient background.

### Studio project

The JSON project file contains the complete current document: avatars, base and avatar-specific behavior libraries, expressions, animations, and playback selection. Importing a project replaces the current local document after confirmation.

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

| Command             | Purpose                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`          | Regenerate the standalone engine and start Vite in development mode.              |
| `pnpm typecheck`    | Run TypeScript in strict, no-emit mode.                                           |
| `pnpm test`         | Run the Vitest suite once.                                                        |
| `pnpm test:watch`   | Run Vitest in watch mode.                                                         |
| `pnpm engine`       | Regenerate the standalone engine used by exported packages.                       |
| `pnpm engine:check` | Verify that the committed generated engine is current.                            |
| `pnpm build`        | Regenerate the engine and create a production build in `dist/`.                   |
| `pnpm preview`      | Serve the production build locally.                                               |
| `pnpm format`       | Format the repository with Prettier.                                              |
| `pnpm check`        | Run engine freshness, formatting, type checking, tests, and the production build. |

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
- **Motion** owns high-frequency rendering and playback values.
- **SVG** renders the procedural avatar geometry.
- **Tailwind CSS 4** and reusable components under `src/components/ui/` provide the interface layer.
- **Vitest** covers geometry, playback, editing, persistence, rendering, and export behavior.

Geometry, playback, document operations, and the standalone runtime remain framework-independent. React state stores durable editor data; Motion values handle frame-by-frame visual updates without forcing React renders.

## Repository map

| Path                                     | Responsibility                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `src/app/`                               | Application shell, shared controls, utilities, and global styles.        |
| `src/components/ui/`                     | Reusable interface primitives.                                           |
| `src/features/avatar/`                   | Avatar identity, body, geometry, expressions, manipulation, and tests.   |
| `src/features/animation/`                | Animation sequences, framework-independent playback, and tests.          |
| `src/features/rendering/`                | Stable SVG scene, canvas preview, rotation gizmo, and rendering tests.   |
| `src/features/export/`                   | Packages, snapshots, ZIPs, standalone runtime, and export tests.         |
| `src/features/studio/`                   | Studio controller, composed views, persistence, bundled data, and tests. |
| `src/i18n/`                              | Localized interface copy and translation tests.                          |
| `src/lib/`                               | Small shared utilities without product-domain ownership.                 |
| `scripts/generate-standalone-engine.mjs` | Standalone-engine generator.                                             |
| `docs/adr/`                              | Accepted architecture decisions.                                         |
| `legacy/`                                | Self-contained HTML prototypes that preceded the React application.      |

## Persistence and privacy

There is no remote backend in this repository. The complete Studio document and interface language preference are stored in the browser's local storage. Exported files are generated locally in the browser. Clearing site data removes the local project, so JSON export is the recommended backup mechanism.

The current project format is a pre-release schema. Compatibility is maintained with the current schema only unless an explicit migration is introduced.

## Contributing

Keep domain calculations outside React components, preserve the separation between durable React state and high-frequency Motion values, and add focused tests for domain changes. Do not edit `src/features/export/standaloneEngine.generated.ts` directly; run `pnpm engine` after changing its source modules.

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

What you create with the Studio is yours: an exported `.avatar.json`, the snapshots and the files
of an integration ZIP carry no license obligation from this project.

See each `LICENSE` file for the complete and legally authoritative terms.
