# Avatar Lab Context

## Purpose

Bible Strong Avatar Lab is a browser-based authoring tool for procedural 2D avatars. It combines
3D-inspired geometry with SVG rendering so creators can build a body from primitives, define a
neutral face, author expressions and compose reusable animations. Generated packages do not depend
on the Studio UI.

## Ubiquitous language

### Avatar

A reusable character whose body, colors and neutral eyes define its persistent visual identity.

### Neutral appearance

The persistent visual base of an Avatar before an Expression is applied. Avoid “default pose”.

### Pose

The Avatar's current temporary visual configuration. A Pose is not persisted directly.

### Base behavior library

The immutable bundled collection of Expressions and Animations inherited by an Avatar that has not
customized its behavior.

### Avatar behavior library

The Avatar-owned collection of Expressions and Animations created atomically from the Base behavior
library on that Avatar's first behavior mutation.

### Expression

A saved visual preset within the Base behavior library or one Avatar behavior library. Eye values
are relative to the owning Avatar's Neutral appearance. Optional color overrides are temporary.

### Animation

A saved sequence of Expressions from the same behavior library, including transitions and blink
behavior. Avoid “state” in user-facing copy.

### Playback

The active execution of one Animation. It exclusively controls the animated Pose until direct user
manipulation pauses it.

## Invariants

- An Avatar inherits the Base behavior library until its first Expression or Animation mutation.
- The first behavior mutation copies Expressions and Animations together so references stay valid.
- Subsequent behavior mutations affect only the owning Avatar.
- Duplicating an Avatar duplicates its Avatar behavior library when one exists.
- Transferring an Animation must also transfer every Expression it references.
- The primary body shape carries the facial coordinate system and eyes.
- Secondary primitives have independent local dimensions, position, rotation and color.
- Expressions remain compatible across body surfaces because they operate in the common facial frame.
- `features/avatar/geometry.ts` and the exported procedural engine stay independent from React.
- `features/studio/defaultStudioDocument.json` is the current schema baseline; pre-release legacy migrations are not required.
- Live editing may update the preview, but unsaved avatar/expression edits must remain reversible.

## Architecture boundaries

- Pure geometry and document logic live in framework-independent TypeScript modules.
- `features/studio/useStudioController.ts` coordinates durable UI state and application operations.
- `features/studio/components/StudioView.tsx` composes the stage, inspector and dialogs.
- Keep domain calculations out of React components and controller hooks.
- Motion values own frame-by-frame visual updates; React state owns durable editor state.
- Exports receive explicit avatar, expression and animation data rather than reading browser storage.
- The generated standalone engine is committed and checked for freshness in local validation.

## Current persistence

The complete Studio document is persisted in browser local storage. JSON project export/import is the
portable backup mechanism. There is no remote backend in this repository.

Accepted architecture decisions live under `docs/adr/`.
