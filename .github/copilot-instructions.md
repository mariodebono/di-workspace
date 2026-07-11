# Repository Instructions

## Commit messages

- Always generate commit messages that follow Conventional Commits 1.0.0.
- Use the format `<type>[optional scope][optional !]: <description>`.
- Choose the smallest accurate type from `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`.
- Use `feat` only for a new feature and `fix` only for a bug fix.
- Add a scope only when it provides useful context.
- Write the description in the imperative mood, keep it concise and specific, and do not end it with a period.
- Add a body only when it helps explain why the change was made or provides important context. Separate it from the header with one blank line.
- Add footers only when needed and format them as Git trailers.
- Mark breaking changes with `!` before the colon or a `BREAKING CHANGE: ` footer, and explain the breaking behavior.
- When a change spans multiple areas, select the type that represents its most significant user-facing effect.

See `CONTRIBUTING.md` for the contributor workflow and detailed examples.
