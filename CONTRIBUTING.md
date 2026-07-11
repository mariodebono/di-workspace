# Contributing

Thank you for contributing to the DI workspace.

## Development Setup

This repository requires Node.js 24 or newer and pnpm.

```sh
pnpm install
```

The workspace packages are located under `packages/`.

## Validation

Run relevant package tests while developing. Before submitting a change, run the complete validation suite:

```sh
pnpm run check
pnpm run lint:report
pnpm run build:all
pnpm run test:unit
```

All checks should pass before the change is submitted.

## Pull Requests

- Keep changes focused.
- Add or update tests for behavior changes.
- Update package documentation when public APIs change.
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

Package versions and release notes are managed with Changesets. Add a changeset for changes that affect a published package:

```sh
pnpm changeset
```

Describe the user-facing effect and select the matching SemVer level:

- `patch` for backward-compatible fixes.
- `minor` for backward-compatible features.
- `major` for breaking changes.

Documentation, tests, and internal maintenance changes do not need a changeset unless they affect published behavior or release notes.

## Code Style

Biome is used for formatting and linting. Follow existing patterns in the package you are changing, and keep public exports intentional.

## Commit Messages

Use the Conventional Commits 1.0.0 specification for every commit message:

```text
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

### Types

Use the smallest type that accurately represents the change:

- `feat` for a new feature.
- `fix` for a bug fix.
- `docs` for documentation-only changes.
- `style` for formatting changes that do not affect behavior.
- `refactor` for code restructuring that does not add a feature or fix a bug.
- `perf` for a performance improvement.
- `test` for test-only changes.
- `build` for build-system or dependency changes.
- `ci` for continuous-integration changes.
- `chore` for maintenance that does not fit another type.
- `revert` for reverting an earlier commit.

When a change touches multiple areas, use the type that represents its most significant user-facing effect.

### Header

- Use lower-case commit types.
- Add a scope only when it provides useful context.
- Write the description in the imperative mood.
- Keep the description concise and specific.
- Do not end the header with a period.

### Body and Footers

Use a body when it helps explain why the change was made or provides important context. Leave one blank line between the header and body.

Use footers only when needed. Format them as Git trailers and separate them from the body with one blank line.

Mark a breaking change by adding `!` before the colon or a footer beginning with `BREAKING CHANGE: `. Explain the breaking behavior in the header or body.

### SemVer Mapping

- A `fix` normally maps to a patch release.
- A `feat` normally maps to a minor release.
- A breaking change maps to a major release.

### Examples

```text
feat(electron): add IPC sender validation
```

```text
fix(config): preserve cached values during reload
```

```text
feat!: remove the legacy module format

BREAKING CHANGE: packages must now use the current module format.
```
