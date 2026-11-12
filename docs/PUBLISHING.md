# Publishing the runtime packages

The runtime is published as four public npm packages, all under the MIT license:

- `@bible-strong/avatar-core` contains the validation, playback and renderer-neutral scene APIs;
- `@bible-strong/avatar-react` depends on core and provides the React 19 integration;
- `@bible-strong/avatar-web` depends on core and provides the direct DOM/ESM integration;
- `@bible-strong/avatar-react-native` depends on core and provides the React Native integration.

All four packages keep the same version during the `0.x` stabilization period. Semantic Versioning
is applied as follows:

- a compatible fix increments the patch version (`0.1.0` to `0.1.1`);
- a compatible feature increments the minor version (`0.1.0` to `0.2.0`);
- a breaking change also increments the minor version while below `1.0.0`;
- after `1.0.0`, a breaking change increments the major version.

## Normal release flow

1. Add a changeset to every pull request that changes a published API with `pnpm changeset`.
2. Merge changes into `main`.
3. The release workflow updates or creates a release pull request containing version and changelog
   changes.
4. Review and merge that release pull request.
5. The workflow validates, builds and publishes every unpublished version to npm.

Publication uses npm trusted publishing through GitHub Actions OIDC. It does not require a stored
`NPM_TOKEN`. Each npm package must trust the `release.yml` workflow in the
`smontlouis/bible-strong-avatar-lab` repository.

## Local verification

Run the complete project checks and verify real consumer projects against packed tarballs:

```sh
pnpm check
pnpm packages:smoke
```

Do not run `npm publish` from an individual package for routine releases. The first publication of
a package is the only manual release: npm can trust a workflow only for a package that already
exists.

## Adding a package

`@bible-strong/avatar-react-native` is new in `0.2.0`. Before merging the release pull request that
carries its first version:

1. Publish it once by hand, at that version, from a clean checkout of the release commit:
   `pnpm packages:build && pnpm --dir packages/avatar-react-native publish --access public`.
2. On npmjs.com, open the package settings and add the trusted publisher: repository
   `smontlouis/bible-strong-avatar-lab`, workflow `release.yml`.

The workflow then skips the version already published and releases the other packages.

`avatar-react-native` is compiled with `tsc`, not bundled: the worklets Babel plugin of the
consuming app recognises Reanimated hooks by their imported names and reads the `worklet`
directives, both of which a minifying bundler would rewrite.
