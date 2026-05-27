# @mariodebono/di-electron-i18n

Electron i18n support for DI-based applications.

This package provides a typed main-process translation service, a bridge controller for renderer access, and a locale-change hook system. The consuming application owns persistence and locale policy while the package handles the translation runtime and IPC surface.

## Install

```bash
npm install @mariodebono/di-electron-i18n @mariodebono/di @mariodebono/di-electron electron electron-log i18next reflect-metadata
```

## Requirements

- Node.js 24 or newer
- An ESM-capable Electron main-process build
- TypeScript legacy decorators enabled when using decorator APIs
- `@mariodebono/di`, `@mariodebono/di-electron`, `electron`, `electron-log`, and `i18next` as peer dependencies
- `reflect-metadata` loaded before decorated classes are instantiated

This package publishes ESM `.mjs` files and `.d.mts` declarations for the root entry and renderer subpath. CommonJS `require()` is not a supported entry point.

## TypeScript Setup

Use the same decorator setup required by `@mariodebono/di` and `@mariodebono/di-electron`:

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

Load `reflect-metadata` once in the Electron main-process entry before importing decorated application modules.

## What It Provides

- `I18nModule` for DI setup in the main process
- `I18nService` for locale resolution, translation, and resource loading
- `I18nBridgeController` for renderer access over IPC
- `OnLocaleChanged()` and `createI18nLocaleChangedHookRunner()` for application-owned locale side effects
- `createI18nRendererBridge()` and `createI18nRendererEvents()` from the renderer subpath

## Locale File Layout

Locale resources are loaded from `<localesRoot>/<locale>/<namespace>.json`.

```text
locales/
  en/
    common.json
    settings.json
  fr/
    common.json
    settings.json
```

Each namespace file must contain a JSON object.

```json
{
  "appTitle": "My App",
  "greeting": "Hello"
}
```

Locale identifiers are normalized to lowercase, and underscores are treated as hyphens. For example, `en_US` resolves as `en-us`.

## Main Process Setup

Use `I18nModule.forRoot()` when the configuration is available synchronously.

```ts
import { Module } from "@mariodebono/di";
import { I18nModule } from "@mariodebono/di-electron-i18n";

@Module({
    imports: [
        I18nModule.forRoot({
            localesRoot: "./locales",
            supportedLocales: ["en", "fr"],
            namespaces: ["common", "settings"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        }),
    ],
})
class AppModule {}
```

Use `I18nModule.forRootAsync()` when the options depend on injected providers.

```ts
import { Injectable, Module } from "@mariodebono/di";
import { I18nModule } from "@mariodebono/di-electron-i18n";

@Injectable()
class SettingsService {
    getLocale(): string {
        return "fr";
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
        I18nModule.forRootAsync({
            imports: [SettingsModule],
            inject: [SettingsService],
            useFactory: async (settings: SettingsService) => ({
                localesRoot: "./locales",
                supportedLocales: ["en", "fr"],
                namespaces: ["common", "settings"],
                fallbackLocale: "en",
                initialLocale: settings.getLocale(),
                systemLocale: "en",
            }),
        }),
    ],
})
class AppModule {}
```

`I18nModule` exports both `I18nService` and `I18nBridgeController`, so the bridge controller participates in the normal DI and controller discovery flow.

### `I18nModuleOptions`

- `localesRoot`: root directory containing locale folders
- `supportedLocales`: allowed locale codes
- `namespaces`: namespaces loaded for every locale
- `fallbackLocale`: locale used when a request cannot be resolved
- `initialLocale`: locale selected on startup
- `systemLocale`: concrete locale used for the app's system/default preference

## Working With Translations

`I18nService` wraps a dedicated `i18next` instance and exposes the locale state used by the package bridge.

```ts
import { Injectable } from "@mariodebono/di";
import { I18nService } from "@mariodebono/di-electron-i18n";

@Injectable()
class GreetingService {
	constructor(private readonly i18n: I18nService) {}

	getGreeting(): string {
		return this.i18n.t("greeting", { ns: "common" });
	}

	getCommonTranslations() {
		return this.i18n.useTranslations("common");
	}
}
```

Useful `I18nService` methods:

- `getLocale()`
- `getFallbackLocale()`
- `getSystemLocale()`
- `getSupportedLocales()`
- `getNamespaces()`
- `canResolveLocale(locale)`
- `resolveLocale(locale)`
- `getState(locale?)`
- `setLocale(locale)`
- `getResources(locale?)`
- `t(key, options?)`
- `useTranslations(namespace)`

Locale resolution follows this order:

- exact locale match first
- base-language match second
- fallback locale last

## Locale-Change Hooks

Use `@OnLocaleChanged()` on injectable instance methods that should run after your app changes locale.

```ts
import { Injectable } from "@mariodebono/di";
import { OnLocaleChanged, type I18nLocaleChangedEvent } from "@mariodebono/di-electron-i18n";

@Injectable()
class LocaleSettingsStore {
	@OnLocaleChanged()
	async persistLocaleChange(event: I18nLocaleChangedEvent): Promise<void> {
		console.log(
			event.previousLocale,
			event.requestedLocale,
			event.resolvedLocale,
		);
	}
}
```

Hook options:

- `priority`: lower numbers run first; ties preserve declaration order

The hook runner discovers injectable classes tagged by `@OnLocaleChanged()`, sorts handlers by priority, and logs failures without stopping the remaining queue.

```ts
import { createI18nLocaleChangedHookRunner } from "@mariodebono/di-electron-i18n";

const runner = createI18nLocaleChangedHookRunner({
	logger: () => logger,
});

const invocations = runner.collectLocaleChangedInvocations(application);

await runner.runLocaleChangedHandlers(invocations, {
	previousLocale: "en",
	requestedLocale: "fr",
	resolvedLocale: "fr",
});
```

This package does not persist locale preference for you. Keep that in your application and invoke the hook runner from your own locale-switch flow.

## Renderer Bridge

Use `@mariodebono/di-electron-i18n/renderer` in renderer code.

```ts
import {
    createI18nRendererBridge,
    createI18nRendererEvents,
} from "@mariodebono/di-electron-i18n/renderer";

const i18n = createI18nRendererBridge();
const events = createI18nRendererEvents();

const state = await i18n.getState();
await i18n.setLocale("fr");

function handleLocaleChanged(event) {
	console.log(event.previousLocale, event.resolvedLocale);
}

events.onLocaleChanged(handleLocaleChanged);
// later...
events.offLocaleChanged(handleLocaleChanged);
```

Bridge methods:

- `getState()`
- `setLocale(locale)`
- `getResources(locale?)`

Event helpers:

- `onLocaleChanged(listener)`
- `offLocaleChanged(listener)`

By default the renderer bridge uses the DI Electron preload transport exposed on `window.__di_electron__`. Pass a custom transport in tests or specialized setups.

The package defines the locale-change event contract, but it does not broadcast that event for you. If you need live push updates in the renderer, emit the event from your own main-process integration after the locale changes.

## Public Exports

Root entry `@mariodebono/di-electron-i18n` exports:

- `I18N_BRIDGE_NAMESPACE`
- `I18N_LOCALE_CHANGED_EVENT`
- `I18nModule`
- `I18nService`
- `I18nBridgeController`
- `OnLocaleChanged`
- `createI18nLocaleChangedHookRunner`
- `getLocaleChangedHandlers`
- `I18nModuleOptions`
- `I18nModuleAsyncOptions`
- `I18nBridgeApi`
- `I18nBridgeState`
- `I18nLocaleChangedEvent`
- `I18nLocaleChangedHandlerMetadata`
- `I18nLocaleChangedHookOptions`
- `I18nLocaleChangedHookRunner`
- `I18nLocaleChangedInvocation`
- `I18nLocalePreference`
- `I18nResourcesByNamespace`
- `I18nRendererEvents`
- `I18nTranslateOptions`
- `I18nTranslations`

## Renderer Exports

The `@mariodebono/di-electron-i18n/renderer` subpath exports:

- `createI18nRendererBridge()`
- `createI18nRendererEvents()`
- `I18nBridgeApi`
- `I18nBridgeState`
- `I18nLocaleChangedEvent`
- `I18nRendererEvents`
- `I18nResourcesByNamespace`

## Notes

- Locale storage stays outside this package.
- The package owns translation loading, locale resolution, IPC contracts, and locale-change hook metadata.
- The package ships ESM entry points for the root module and renderer helper.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

This package is licensed under [MPL-2.0](LICENSE).
