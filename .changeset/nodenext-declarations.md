---
'@bible-strong/avatar-core': patch
'@bible-strong/avatar-react': patch
'@bible-strong/avatar-web': patch
'@bible-strong/avatar-react-native': patch
---

The published declarations type under `moduleResolution: nodenext` and `node16` (#20). Relative imports in the sources carry their `.js` extension, so `export * from './faces.js'` resolves in an ECMAScript package; before, `@bible-strong/avatar-core` exposed no exports there and the React, web and React Native packages' exports were `any`. avatar-core, avatar-react and avatar-web now emit their declarations under `NodeNext`, which refuses an import without its extension; `pnpm packages:types` types every package from a `nodenext` consumer in `pnpm check`.
