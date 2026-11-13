# Changesets

Every user-visible package change must include a changeset created with `pnpm changeset`.

The four runtime packages share one fixed version. Since `1.0.0`, select:

- `patch` for compatible fixes and documentation corrections;
- `minor` for compatible features;
- `major` for breaking changes.

Merging the generated release pull request publishes the versions recorded in that pull request.
