# Contributing

## Development Setup

This repository uses Node.js 20+ and pnpm.

```sh
pnpm install
pnpm run check
pnpm run lint:report
pnpm run test:unit
pnpm run build:all
```

## Pull Requests

- Keep changes focused.
- Add or update tests for behavior changes.
- Update package README or changelog content when public APIs change.
- Run the relevant checks before opening a pull request.
- Do not commit generated dependency folders or local package-manager cache files.

## Licensing

By contributing, you agree that your contribution is licensed under the Mozilla Public License 2.0.

All hand-authored source files should start with:

```ts
/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
```

Do not copy third-party code into this repository unless its license is compatible and the license notice is preserved. Prefer adding dependencies through `package.json` instead of vendoring code.

## Package Changes

This is a pnpm workspace. Package versions and release notes are managed with Changesets.

For user-facing package changes, add a changeset:

```sh
pnpm changeset
```

## Code Style

Biome is used for formatting and linting. Follow existing patterns in the package you are changing, and keep public exports intentional.
