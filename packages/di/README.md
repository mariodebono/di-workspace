# @mariodebono/di

Core dependency injection runtime for TypeScript applications.

Use this package when you need a lightweight container with module composition, constructor injection, lifecycle hooks, provider discovery, logging, and a small testing harness. Every integration package in this workspace builds on top of this package.

## Install

```bash
npm install @mariodebono/di reflect-metadata
```

## Requirements

- Node.js 24 or newer
- An ESM-capable runtime or build pipeline
- TypeScript legacy decorators enabled when using decorator APIs
- `reflect-metadata` loaded before decorated classes are imported or instantiated

This package publishes ESM `.mjs` files and `.d.mts` declarations. CommonJS `require()` is not a supported entry point.

## TypeScript Setup

If you rely on constructor metadata, enable decorator metadata in your application:

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

Load `reflect-metadata` once in your application entry point:

```ts
import "reflect-metadata";
```

## Overview

The package exports the core building blocks for a DI-driven application:

- application bootstrap through `createApplication()`
- module composition with `@Module()` and dynamic modules
- class, value, and factory providers
- constructor injection with `@Inject()`
- optional dependencies with `@Optional()`
- late references with `forwardRef()`
- lifecycle hooks for async setup and teardown
- tagged discovery for locating providers by metadata
- a built-in logger
- a dedicated `createTestingApp()` helper for tests

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

## Modules And Providers

Use `@Module()` to group related providers and make the dependency graph explicit.

```ts
import { Module } from "@mariodebono/di";

const API_URL = Symbol("API_URL");

@Module({
    providers: [
        UserService,
        { provide: API_URL, useValue: "https://api.example.com" },
        { provide: Greeter, useClass: Greeter },
        {
            provide: "request-id",
            useFactory: () => crypto.randomUUID(),
            scope: "transient",
        },
    ],
    exports: [Greeter, API_URL],
})
class UserModule {}
```

Provider forms:

- class provider: `UserService`
- explicit class provider: `{ provide, useClass, scope?, tags? }`
- value provider: `{ provide, useValue, scope?, tags? }`
- factory provider: `{ provide, useFactory, inject?, scope?, tags? }`

The default provider scope is singleton. Use `scope: "transient"` when each resolution should create a new instance.

## Dynamic And Global Modules

Dynamic modules let package authors expose `forRoot()` style setup without hiding the underlying graph.

```ts
import type { DynamicModule } from "@mariodebono/di";
import { Module } from "@mariodebono/di";

@Module({})
class FeatureModule {
    static forRoot(options: { enabled: boolean }): DynamicModule {
        return {
            module: FeatureModule,
            providers: [{ provide: "feature.options", useValue: options }],
            exports: ["feature.options"],
            global: options.enabled,
        };
    }
}
```

Use `@Global()` or `global: true` only for providers that should be visible across the application graph without repeated imports.

## Injection Decorators

- `@Injectable(options?)` marks a class as available to the container and can set `scope` or discovery `tags`
- `@Inject(token)` selects the value to inject into a constructor parameter
- `@Optional()` allows a missing dependency to resolve to `undefined`
- `@Global()` marks a module as globally available
- `forwardRef(() => Token)` supports circular references and declaration-order problems

Use explicit `@Inject(token)` for string and symbol tokens. Constructor type metadata can resolve class dependencies when `emitDecoratorMetadata` is enabled.

## Application API

`createApplication(entryModule, options?)` bootstraps the graph and returns an application facade:

- `app.get(token)` resolves a provider synchronously
- `app.resolve(token)` resolves a provider asynchronously
- `app.findByTag(tag)` returns provider tokens registered with a discovery tag
- `app.getContainer()` returns the underlying container for advanced integrations
- `app.destroy()` runs synchronous teardown
- `app.destroyAsync()` awaits async teardown

`ModuleRef` exposes the same `get()`, `resolve()`, and `findByTag()` methods inside providers.

## Lifecycle Hooks

Providers can implement `OnModuleInit` and `OnModuleDestroy`.

```ts
import type { OnModuleDestroy, OnModuleInit } from "@mariodebono/di";
import { Injectable } from "@mariodebono/di";

@Injectable()
class CacheService implements OnModuleInit, OnModuleDestroy {
    async onModuleInit(): Promise<void> {
        await this.connect();
    }

    async onModuleDestroy(): Promise<void> {
        await this.close();
    }
}
```

Async factories and `onModuleInit()` hooks are awaited during `createApplication()`. Async destroy hooks are awaited by `app.destroyAsync()`.

## Provider Discovery

Providers can be tagged and queried later through the application or `ModuleRef`.

```ts
const HANDLER_TAG = Symbol("handler");

@Injectable({ tags: [HANDLER_TAG] })
class UserCreatedHandler {}

const handlers = app.findByTag(HANDLER_TAG);
```

This is useful for plugin-style features, event handlers, controllers, or grouped cleanup tasks.

## Logging

`createApplication()` accepts a `logger` option:

- `true` or omission uses the built-in logger
- `false` disables logging
- an array of log levels limits output to those levels
- a custom logger class or object can be supplied for application-specific logging

```ts
await createApplication(AppModule, {
    logger: ["log", "warn", "error"],
});
```

## Testing

Use `createTestingApp()` for isolated unit tests.

```ts
import { createTestingApp } from "@mariodebono/di";

const app = createTestingApp([
    { provide: "VALUE", useValue: 123 },
]);

expect(app.get("VALUE")).toBe(123);
app.teardown();
```

## Public API

This package exports:

- `createApplication()` and related application types
- `@Module()`, `@Injectable()`, `@Inject()`, `@Optional()`, `@Global()`, and `forwardRef()`
- `ModuleRef` and container-facing types
- `Logger`
- `createTestingApp()` and testing types
- provider, lifecycle, logger, module, and token types
- `REQUEST_CONTEXT`

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

This package is licensed under [MPL-2.0](LICENSE).
