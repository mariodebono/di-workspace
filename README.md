# DI Workspace

Packages for dependency injection, configuration, Electron bootstrap, application migrations, and SQLite integration in TypeScript applications.

This repository publishes ESM packages under the `@mariodebono` scope. The foundation package provides the DI container, decorators, lifecycle helpers, logging, and testing utilities. The integration packages build on that runtime for configuration, Electron, Electron i18n, app-level bootstrap migrations, and Drizzle + LibSQL for SQLite.

## Packages

| Package | Documentation | Purpose |
| --- | --- | --- |
| `@mariodebono/di` | [packages/di](packages/di/README.md) | Core DI container, application bootstrap, decorators, lifecycle hooks, logging, and testing helpers. |
| `@mariodebono/di-config` | [packages/config](packages/config/README.md) | Typed configuration module with namespaces, dot-path access, validation, and async root setup. |
| `@mariodebono/di-app-migrations` | [packages/app-migrations](packages/app-migrations/README.md) | Application bootstrap migrations for user data, settings, and local app state. |
| `@mariodebono/di-drizzle-sqlite` | [packages/drizzle-sqlite](packages/drizzle-sqlite/README.md) | Drizzle ORM and LibSQL integration for SQLite-backed applications. |
| `@mariodebono/di-electron` | [packages/electron](packages/electron/README.md) | Electron main-process bootstrap, window management, lifecycle hooks, IPC, and renderer bridge. |
| `@mariodebono/di-electron-i18n` | [packages/electron-i18n](packages/electron-i18n/README.md) | Electron i18n module with typed main-process and renderer APIs built on `i18next`. |

## Requirements

- Node.js 24 or newer
- TypeScript with legacy decorators enabled when using decorator APIs
- `reflect-metadata` loaded before decorated classes are imported or instantiated
- pnpm 11 for repository development

The published packages provide ESM `.mjs` entry points and `.d.mts` type declarations. CommonJS `require()` entry points are not published.

## TypeScript Setup

Applications that use decorators should enable decorator metadata. Exact module settings can vary by build tool, but Node-style ESM projects commonly use:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Load `reflect-metadata` once at the application entry point before importing modules that declare decorated classes:

```ts
import "reflect-metadata";
```

## Installation

Install only the packages your application needs. The examples below use npm because these are public npm packages; equivalent pnpm, yarn, and bun commands work too.

```bash
npm install @mariodebono/di reflect-metadata
npm install @mariodebono/di-config @mariodebono/di reflect-metadata
npm install @mariodebono/di-app-migrations @mariodebono/di reflect-metadata
npm install @mariodebono/di-drizzle-sqlite @mariodebono/di @libsql/client drizzle-orm reflect-metadata
npm install @mariodebono/di-electron @mariodebono/di electron reflect-metadata
npm install @mariodebono/di-electron-i18n @mariodebono/di @mariodebono/di-electron electron electron-log i18next reflect-metadata
```

Package-specific READMEs document the peer dependencies, runtime assumptions, subpath exports, and public API for each package.

## Quick Start

```ts
import "reflect-metadata";
import {
    createApplication,
    Inject,
    Injectable,
    Module,
} from "@mariodebono/di";

@Injectable()
class UserService {
    getName() {
        return "Ada";
    }
}

@Injectable()
class Greeter {
    constructor(@Inject(UserService) private readonly users: UserService) {}

    sayHello() {
        return `Hello, ${this.users.getName()}`;
    }
}

@Module({
    providers: [UserService, Greeter],
    exports: [Greeter],
})
class AppModule {}

const app = await createApplication(AppModule);
const greeter = app.get(Greeter);

console.log(greeter.sayHello());
await app.destroyAsync();
```

## Repository Layout

- `packages/di` is the foundation and is required by every integration package.
- `packages/config` adds typed configuration loading and namespaced access.
- `packages/app-migrations` runs bootstrap migrations for application data, not database schema.
- `packages/drizzle-sqlite` provides a DI-friendly Drizzle + LibSQL setup for SQLite.
- `packages/electron` composes the core DI runtime with Electron bootstrap and IPC patterns.
- `packages/electron-i18n` adds locale loading, translation state, and renderer bridges on top of Electron.

## Development

Install dependencies from the repository root:

```bash
pnpm install
```

Useful checks:

```bash
pnpm run check
pnpm run lint:report
pnpm run build:all
pnpm run test:unit
pnpm run test:integration
pnpm -r exec publint
```

Run the full pre-release validation locally:

```bash
pnpm run prechangeset
```

## Release Process

This workspace uses Changesets and publishes the packages as a coordinated release group.

1. Create a changeset with `pnpm changeset`.
2. Update package versions with `pnpm changeset version`.
3. Run `pnpm run prechangeset`.
4. Publish with `pnpm changeset publish` after authenticating to npm.

The workspace root is private and is not published. Individual package manifests are configured for public npm release.

## Contributing

Keep changes scoped to the package they affect, add or update tests when behavior changes, and update the relevant package README whenever the public API or setup flow changes. Prefer small, typed, documented APIs that are easy to consume from application code.

## Changelogs

Each package has its own changelog:

- [@mariodebono/di](packages/di/CHANGELOG.md)
- [@mariodebono/di-config](packages/config/CHANGELOG.md)
- [@mariodebono/di-app-migrations](packages/app-migrations/CHANGELOG.md)
- [@mariodebono/di-drizzle-sqlite](packages/drizzle-sqlite/CHANGELOG.md)
- [@mariodebono/di-electron](packages/electron/CHANGELOG.md)
- [@mariodebono/di-electron-i18n](packages/electron-i18n/CHANGELOG.md)

## License

This repository is licensed under [MPL-2.0](LICENSE).
