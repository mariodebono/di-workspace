# @mariodebono/di-drizzle-sqlite

SQLite integration for DI-based applications using Drizzle ORM and LibSQL.

This package provides a DI-friendly client setup, exposes the resolved database client through a service, and can run Drizzle migrations during bootstrap when requested.

## Install

```bash
npm install @mariodebono/di-drizzle-sqlite @mariodebono/di @libsql/client drizzle-orm reflect-metadata
```

## Requirements

- Node.js 24 or newer
- `@mariodebono/di` as a peer dependency
- `@libsql/client`, `drizzle-orm`, and `reflect-metadata` as peer dependencies
- The same ESM and decorator setup required by `@mariodebono/di`

This package publishes ESM `.mjs` files and `.d.mts` declarations. CommonJS `require()` is not a supported entry point.

## What It Provides

- `DrizzleSqliteModule` for synchronous or async bootstrap
- `DrizzleSqliteClientService` for accessing the resolved Drizzle client from DI
- optional migration execution before the application finishes bootstrapping
- teardown that closes the underlying LibSQL client cleanly

## Synchronous Setup

Use `DrizzleSqliteModule.forRoot()` when the database options are known at module definition time.

```ts
import { Module } from "@mariodebono/di";
import { DrizzleSqliteModule } from "@mariodebono/di-drizzle-sqlite";

@Module({
    imports: [
        DrizzleSqliteModule.forRoot({
            url: "file:./app.db",
            autoMigrate: true,
            migrationDir: "./drizzle",
        }),
    ],
})
class AppModule {}
```

Options:

- `url: string` is passed to `@libsql/client`
- `autoMigrate?: boolean` runs migrations before the database provider resolves
- `migrationDir?: string` points to generated Drizzle migration files
- `migrationTableName?: string` defaults to `__database_migrations__`

## Async Setup

Use `DrizzleSqliteModule.forRootAsync()` when the options depend on injected providers.

```ts
import { Injectable, Module } from "@mariodebono/di";
import { DrizzleSqliteModule } from "@mariodebono/di-drizzle-sqlite";

@Injectable()
class SettingsService {
    getDatabaseUrl(): string {
        return "file:./app.db";
    }
}

@Module({
    providers: [SettingsService],
    exports: [SettingsService],
})
class SettingsModule {}

@Module({
    imports: [
        SettingsModule,
        DrizzleSqliteModule.forRootAsync({
            imports: [SettingsModule],
            inject: [SettingsService],
            useFactory: async (settings: SettingsService) => ({
                url: settings.getDatabaseUrl(),
                autoMigrate: true,
                migrationDir: "./drizzle",
            }),
        }),
    ],
})
class AppModule {}
```

## Accessing the Client

`DrizzleSqliteClientService` exposes the resolved Drizzle client and ensures the LibSQL client is closed during teardown.

```ts
import { Injectable } from "@mariodebono/di";
import { DrizzleSqliteClientService } from "@mariodebono/di-drizzle-sqlite";

@Injectable()
class UserRepository {
    constructor(private readonly databaseClient: DrizzleSqliteClientService) {}

    getClient() {
        return this.databaseClient.client;
    }
}
```

Use the returned client with your own Drizzle schema and query code.

## Migration Behavior

- `autoMigrate: true` runs migrations before the database provider resolves
- if `migrationDir` is missing, migrations are skipped and a warning is logged
- migration failures close the raw LibSQL client and abort bootstrap
- the default migration table name is `__database_migrations__`

## Notes

- This package does not generate Drizzle migrations.
- This package does not replace your application schema-design or migration strategy. It only wires Drizzle and LibSQL into the DI runtime.
- Import your schema and query helpers from your application code as usual.

## Public API

- `DrizzleSqliteModule`
- `DrizzleSqliteClientService`
- `DrizzleSqliteOptions`
- `DrizzleSqliteAsyncOptions`

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

This package is licensed under [MPL-2.0](LICENSE).
