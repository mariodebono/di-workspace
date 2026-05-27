# @mariodebono/di-config

Typed configuration module for applications built on `@mariodebono/di`.

This package provides a DI-friendly configuration system with synchronous and async root setup, namespaced config slices, typed injection tokens, validation, and dot-path lookups through `ConfigService`.

## Install

```bash
npm install @mariodebono/di-config @mariodebono/di reflect-metadata
```

## Requirements

- Node.js 24 or newer
- `@mariodebono/di` as a peer dependency
- `reflect-metadata` loaded before decorated classes are imported or instantiated
- The same ESM and decorator setup required by `@mariodebono/di`

This package publishes ESM `.mjs` files and `.d.mts` declarations. CommonJS `require()` is not a supported entry point.

## What It Solves

- Bootstraps application config from defaults, `process.env`, factories, and injected providers
- Provides named config slices with `registerAs()`
- Makes config values injectable through DI tokens
- Supports typed dot-path reads through `ConfigService`
- Allows validation or transformation at module startup

## Root Configuration

Use `ConfigModule.forRoot()` to assemble application config.

```ts
import { Module } from "@mariodebono/di";
import { ConfigModule } from "@mariodebono/di-config";

@Module({
    imports: [
        ConfigModule.forRoot({
            defaults: {
                appName: "Desktop App",
            },
            load: [
                () => ({
                    appVersion: "1.0.0",
                }),
            ],
            isGlobal: true,
        }),
    ],
})
class AppModule {}
```

`ConfigModule.forRoot()` merges `defaults`, `process.env` by default, and each `load` factory before the module is initialized.

Root options:

- `loadProcessEnv?: boolean` controls whether `process.env` is merged, defaulting to `true`
- `ignoreEnvVars?: boolean` is an alias for disabling environment loading
- `defaults?: Record<string, unknown>` supplies baseline values
- `load?: ConfigFactory[]` adds factory-produced values
- `validate?: (config) => TConfig` transforms or validates the final object
- `validationSchema?: ValidationSchema<TConfig>` supports `parse()`, `safeParse()`, or Joi-style `validate()`
- `validationOptions?: Record<string, unknown>` passes options to Joi-style schemas
- `cache?: boolean` caches computed lookups, defaulting to `true`
- `isGlobal?: boolean` makes config providers globally visible

## Async Root Setup

Use `ConfigModule.forRootAsync()` when config depends on other providers.

```ts
import { Injectable, Module } from "@mariodebono/di";
import { ConfigModule } from "@mariodebono/di-config";

@Injectable()
class SettingsProvider {
    getAppVersion(): string {
        return "1.0.0";
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
        ConfigModule.forRootAsync({
            imports: [SettingsModule],
            inject: [SettingsProvider],
            useFactory: async (settings: SettingsProvider) => ({
                load: [
                    () => ({
                        appVersion: settings.getAppVersion(),
                    }),
                ],
            }),
        }),
    ],
})
class AppModule {}
```

## Namespaced Config

Use `registerAs()` to define a namespaced slice. The returned `KEY` supports path lookups, while the returned `TOKEN` supports DI injection.

```ts
import { Inject, Injectable, Module } from "@mariodebono/di";
import { ConfigModule, ConfigType, registerAs } from "@mariodebono/di-config";

const databaseConfig = registerAs("database", () => ({
    url: "file:./app.db",
    pool: {
        maxConnections: 10,
    },
}));

@Injectable()
class DatabaseClient {
    constructor(
        @Inject(databaseConfig.TOKEN)
        readonly database: ConfigType<typeof databaseConfig>,
    ) {}
}

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [databaseConfig],
        }),
        ConfigModule.forFeature([databaseConfig]),
    ],
    providers: [DatabaseClient],
})
class AppModule {}
```

`ConfigModule.forFeature()` should be used only after a root config module has been imported somewhere in the application graph.

## ConfigService

`ConfigService` supports top-level keys and nested dot-path access with typed return values.

```ts
import { ConfigService } from "@mariodebono/di-config";

type AppConfig = {
    database: {
        url: string;
        pool: {
            maxConnections: number;
        };
    };
};

declare const configService: ConfigService<AppConfig>;

const url = configService.getOrThrow("database.url");
const maxConnections = configService.get("database.pool.maxConnections");
```

With a typed `ConfigService<AppConfig>`, `url` resolves as `string` and `maxConnections` as `number | undefined`.

Common methods:

- `get(path, options?)` returns the value or `undefined`
- `getOrThrow(path, options?)` throws when the path is missing
- `getAll()` returns the assembled config object

## Validation

Root config can be transformed or validated with a custom `validate()` function or a schema object that exposes `parse()`, `safeParse()`, or Joi-style `validate()`.

```ts
ConfigModule.forRoot({
    load: [databaseConfig],
    validate: (config) => {
        if (typeof config.database !== "object" || config.database === null) {
            throw new Error("database config is required");
        }

        return config as {
            database: {
                url: string;
            };
        };
    },
});
```

## Notes

- The package does not load `.env` files for you. Use your preferred dotenv loader before bootstrapping the app if needed.
- Environment variables are merged as top-level keys from `process.env`.
- `ConfigService` is intended for application code that needs typed access to the assembled config graph.

## Public API

- `ConfigModule`
- `ConfigService`
- `registerAs()`
- `CONFIG_OPTIONS_TOKEN`
- `ConfigType`
- `ConfigFactory`
- `ConfigFactoryKeyHost`
- `ConfigModuleOptions`
- `ConfigModuleAsyncOptions`
- `ConfigServiceOptions`
- `ConfigGetOptions`
- `ValidationSchema`
- `ConfigPath` and `ConfigPathValue`

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

This package is licensed under [MPL-2.0](LICENSE).
