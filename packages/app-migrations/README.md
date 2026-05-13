# @mariodebono/di-app-migrations

Application bootstrap migrations for DI-based applications.

This package runs one-off migrations before `createApplication()` completes. Use it for application data, settings, cache files, or other persistent state that needs a controlled startup-time migration path. It is not a database schema migration tool.

## Install

```bash
npm install @mariodebono/di-app-migrations @mariodebono/di reflect-metadata
```

## Requirements

- Node.js 20 or newer
- `@mariodebono/di` as a peer dependency
- `reflect-metadata` loaded before decorated classes are imported or instantiated
- The same ESM and decorator setup required by `@mariodebono/di`

This package publishes ESM `.mjs` files and `.d.mts` declarations. CommonJS `require()` is not a supported entry point.

## What It Provides

- `AppMigrationsModule` for synchronous or async bootstrap integration
- `@AppMigration()` decorator-based migration discovery
- deterministic migration ordering by id
- migration error handling with fatal and non-fatal behavior
- store-driven completion tracking through `AppMigrationStore`

## How It Works

The package discovers migration classes, compares them with the ids recorded by your store, and executes any pending migrations before the application resolves.

Execution rules:

- completed migrations are skipped
- migrations run in ascending lexicographic id order
- successful migrations are marked complete with the current timestamp
- fatal failures stop bootstrap with `AppMigrationExecutionError`
- non-fatal migrations can be declared to log a warning and continue startup

## Store Contract

Applications provide persistence through `AppMigrationStore`.

```ts
import type { AppMigrationStore } from "@mariodebono/di-app-migrations";

class MyMigrationStore implements AppMigrationStore {
    async listCompletedMigrationIds(): Promise<string[]> {
        return [];
    }

    async markCompleted(id: string, executedAt: Date): Promise<void> {
        console.log(id, executedAt);
    }
}
```

The store remains application-owned. This package only requires a way to read completed ids and persist successful completion records.

## Declaring Migrations

Use `@AppMigration()` on classes that implement `execute()`. The decorator tags the class as injectable for migration discovery.

```ts
import { AppMigration } from "@mariodebono/di-app-migrations";

@AppMigration({
    id: "20260417120000-seed-default-profile",
})
class SeedDefaultProfileMigration {
    async execute(): Promise<void> {
        // migrate application state here
    }
}
```

Timestamp-style ids work well because the package sorts migration ids lexicographically.

The decorator accepts:

- `id: string` as the stable migration identifier
- `fatal?: boolean` to control whether failure aborts bootstrap
- `description?: string` for human-readable migration context

## Synchronous Root Setup

Use `AppMigrationsModule.forRoot()` when the store is available at module definition time.

```ts
import { Module } from "@mariodebono/di";
import { AppMigration, AppMigrationsModule } from "@mariodebono/di-app-migrations";

class MigrationStore {
    async listCompletedMigrationIds(): Promise<string[]> {
        return [];
    }

    async markCompleted(id: string, executedAt: Date): Promise<void> {
        console.log(id, executedAt);
    }
}

@AppMigration({ id: "20260417121500-seed-default-profile" })
class SeedDefaultProfileMigration {
    async execute(): Promise<void> {}
}

@Module({
    imports: [
        AppMigrationsModule.forRoot({
            store: MigrationStore,
        }),
    ],
    providers: [MigrationStore, SeedDefaultProfileMigration],
})
class AppModule {}
```

`store` can be the store class or any provider token that resolves to `AppMigrationStore`.

## Async Root Setup

Use `AppMigrationsModule.forRootAsync()` when the module options depend on injected providers.

```ts
import { Injectable, Module } from "@mariodebono/di";
import { AppMigrationsModule } from "@mariodebono/di-app-migrations";

@Injectable()
class SettingsProvider {
    migrationsEnabled(): boolean {
        return true;
    }
}

@Injectable()
class MigrationStore {
    async listCompletedMigrationIds(): Promise<string[]> {
        return [];
    }

    async markCompleted(id: string, executedAt: Date): Promise<void> {
        console.log(id, executedAt);
    }
}

@Module({
    providers: [SettingsProvider],
    exports: [SettingsProvider],
})
class SettingsModule {}

@Module({
    imports: [
        SettingsModule,
        AppMigrationsModule.forRootAsync({
            imports: [SettingsModule],
            inject: [SettingsProvider],
            store: MigrationStore,
            useFactory: async (settings: SettingsProvider) => ({
                enabled: settings.migrationsEnabled(),
            }),
        }),
    ],
    providers: [MigrationStore],
})
class AppModule {}
```

Async options:

- `imports?: ModuleImport[]` imports providers needed by the factory
- `store` identifies the provider that stores completed migration ids
- `inject?: ProviderToken[]` selects factory dependencies
- `useFactory` returns `{ enabled?: boolean }`

## Notes

- This package is intended for application bootstrap migrations, not schema migrations.
- Migration ids should encode ordering explicitly.
- Store persistence is fully application-specific.
- Keep migration side effects idempotent where practical. A failed migration is not marked complete.

## Public API

- `AppMigration`
- `AppMigrationsModule`
- `AppMigrationExecutionError`
- `AppMigrationStore`
- `AppMigrationOptions`
- `AppMigrationRunnable`
- `AppMigrationsOptions`
- `AppMigrationsAsyncOptions`

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

This package is licensed under [MPL-2.0](LICENSE).
