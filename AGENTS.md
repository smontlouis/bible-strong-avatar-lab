# AGENTS.md

## Project

Bible Strong Avatar Lab is a standalone React 19 + Vite 8 application for procedural SVG avatars.
Read `CONTEXT.md` before changing behavior or persistence semantics.

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

## Engineering rules

- Use TypeScript in strict mode.
- Keep geometry, playback and document operations framework-independent.
- Preserve the split between durable React state and high-frequency Motion values.
- Do not use `useMemo`, `useCallback` or `memo`; React Compiler handles memoization.
- Add or update focused tests for domain behavior.
- Run `pnpm typecheck` and the relevant test file while working, then `pnpm check` before committing.
- `src/features/export/standaloneEngine.generated.ts` is generated. Update it with `pnpm engine`, never by hand.
- Keep English, French and Simplified Chinese copy synchronized across `src/i18n/index.ts` and `src/i18n/zh.ts`.
- Preserve project JSON compatibility only with the current pre-release schema unless a migration is explicitly requested.

## Runtime packages

- `packages/*` are published to npm under the MIT license; the Studio stays under the AGPL. Do not
  copy Studio code into a package.
- The renderers (`avatar-react`, `avatar-web`, `avatar-react-native`) keep one public API. Change
  a prop, a controller method or an error code in all three, with their READMEs.
- A package README is the integration contract read by coding agents in `node_modules`. Every
  statement in it must be true of the code: update it in the same change.
- In `avatar-react-native`, every function that runs on the UI thread starts with the `worklet`
  directive and reaches `avatar-core` by import only. Keep playback logic in `src/engine.ts`, which
  is tested in Node; verify the component on an iOS simulator and an Android emulator.
- Add a changeset (`pnpm changeset`) to any change of a published package.

## UI conventions

- Reuse components under `src/components/ui/` rather than adding one-off controls.
- Keep selection, hover, focus and destructive actions visually consistent across avatars, expressions and animations.
- Prefer transform/opacity animation over layout animation for continuous interactions.
