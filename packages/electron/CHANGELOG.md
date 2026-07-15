# @mariodebono/di-electron

## 3.0.0

### Patch Changes

- @mariodebono/di@3.0.0

## 2.0.0

### Minor Changes

- b198226: Add automatic IPC sender validation, optional application-specific validation, and native renderer file path resolution, and update Electron compatibility to 42.6.1.

### Patch Changes

- bdbf21b: Avoid operating on destroyed main windows during close hooks and clean up trusted renderer state safely after windows close.
- bdbf21b: Trust managed renderer locations before initial navigation completes so startup IPC requests are validated correctly.
- bdbf21b: Refresh workspace development tooling and make the i18n loader unit tests platform-independent.
- Updated dependencies [bdbf21b]
  - @mariodebono/di@2.0.0

## 1.0.2

### Patch Changes

- fix(electron): update dependency versions in pnpm-workspace.yaml
- Updated dependencies
  - @mariodebono/di@1.0.2

## 1.0.1

### Patch Changes

- 8dca4c7: Update the dependency catalog for current Electron, tsdown, Vitest, Biome, i18next, electron-log, and publint releases while keeping Node types on version 24.

  Published peer ranges continue to allow the previously supported Electron 41, i18next 26, and electron-log 5 ranges to avoid forcing consumers onto the new test/runtime versions.

- Updated dependencies [8dca4c7]
  - @mariodebono/di@1.0.1

## 1.0.0

### Major Changes

- Initial Release

### Patch Changes

- Updated dependencies
  - @mariodebono/di@1.0.0
