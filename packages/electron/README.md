# @mariodebono/di-electron

Electron runtime support for applications built on `@mariodebono/di`.

This package bootstraps an Electron main process, manages the main window, registers controller-based IPC handlers, injects the preload bridge, and coordinates lifecycle hooks for startup and shutdown.

Use `@mariodebono/di-electron` for main-process code and `@mariodebono/di-electron/renderer` for the typed renderer bridge.

## Install

```bash
npm install @mariodebono/di-electron @mariodebono/di electron reflect-metadata
```

## Requirements

- Node.js 20 or newer
- An ESM-capable Electron main-process build
- TypeScript legacy decorators enabled when using decorator APIs
- `reflect-metadata` loaded before decorated classes are instantiated
- `@mariodebono/di` and `electron` as peer dependencies

This package publishes ESM `.mjs` files, `.d.mts` declarations, and a CommonJS preload bundle used internally by the window manager. CommonJS `require()` is not a supported public entry point.

## TypeScript Setup

Use the same decorator setup required by `@mariodebono/di`:

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

- `createElectronApplication()` for DI-backed Electron bootstrap
- `ElectronModule` with Electron-specific services
- `WindowManagerService` for main-window tracking and additional windows
- `ElectronAppService` as a thin injectable facade over Electron app APIs
- decorator-driven app-ready, app-launch, and window lifecycle hooks
- controller-based IPC registration through `BridgeController()` and typed handle decorators
- `IpcError` helpers for renderer-safe error payloads
- `ElectronLogger` integration through the built-in logger adapter

## Quick Start

Main-process entry:

```ts
import "reflect-metadata";
import { Injectable, Module } from "@mariodebono/di";
import {
    AppReady,
    AppReadyOrder,
    BridgeController,
    createElectronApplication,
    createIpcHandleTyped,
    ElectronAppService,
} from "@mariodebono/di-electron";

type AppBridge = {
    getLocale(): Promise<string>;
};

const AppBridgeHandle = createIpcHandleTyped<AppBridge>();

@BridgeController({ namespace: "app" })
class AppBridgeController {
    constructor(private readonly electronApp: ElectronAppService) {}

    @AppBridgeHandle("getLocale")
    getLocale(): string {
        return this.electronApp.getLocale();
    }
}

@Injectable()
class StartupTasks {
    constructor(private readonly electronApp: ElectronAppService) {}

    @AppReady({ order: AppReadyOrder.AfterWindow })
    async afterWindowReady(): Promise<void> {
        this.electronApp.setName("My App");
    }
}

@Module({
    providers: [AppBridgeController, StartupTasks],
})
class AppModule {}

const result = await createElectronApplication(AppModule, {
    mainWindowOptions: {
        url: "http://localhost:5173",
        width: 1280,
        height: 800,
    },
});

if (result.status === "started") {
    console.log("Electron app started");
}
```

Renderer code:

```ts
import { createRendererBridge } from "@mariodebono/di-electron/renderer";

type AppBridge = {
    getLocale(): Promise<string>;
};

const api = createRendererBridge<{ app: AppBridge }>();
const locale = await api.app.getLocale();
```

The renderer bridge uses the preload transport that `@mariodebono/di-electron` injects into windows created by `WindowManagerService`.

## Bootstrap Model

`createElectronApplication()` wraps your entry module in `ElectronModule`, creates the DI application, and wires the result to Electron.

At runtime it:

- creates the DI application
- registers all `BridgeController()` handlers with `ipcMain.handle()`
- collects app-ready, app-launch, and window lifecycle handlers
- installs a minimal default macOS app menu
- waits for `app.whenReady()`
- runs `@AppReady({ order: AppReadyOrder.BeforeWindow })`
- creates the main window through `WindowManagerService`
- runs `@AppReady({ order: AppReadyOrder.AfterWindow })`
- dispatches the initial `@OnAppLaunch()` callbacks
- attaches main-window close, focus, blur, show, and app-quit listeners

If `instanceMode: "single"` is enabled and Electron cannot acquire the single-instance lock, bootstrap exits early and returns `{ status: "redirected" }`. Otherwise it returns `{ status: "started", application }`.

## Application Options

`createElectronApplication()` accepts the normal `@mariodebono/di` application options plus Electron-specific settings.

- `instanceMode?: "multi" | "single"` controls whether a second app instance is allowed
- `hideOnClose?: boolean` hides the main window instead of quitting when it is closed
- `mainWindowOptions?: CreateWindowOptions` configures the main `BrowserWindow`
- `loggerOptions?: ElectronLoggerOptions` configures the built-in `electron-log` adapter

Defaults:

- `instanceMode` defaults to `"multi"`
- `hideOnClose` defaults to `false`
- the main window defaults to `url: "/"` and `startMode: "normal"`

## Window Management

`WindowManagerService` is the main window abstraction exposed by the package.

It supports:

- `createWindow(options)` for additional windows
- `createMainWindow(options)` for the singleton main window
- `getMainWindow()` to read the tracked main window
- `revealMainWindow()` to restore, show, and focus the main window
- `closeAll()` to close all tracked windows

`CreateWindowOptions` extends Electron's `BrowserWindowConstructorOptions` with:

- `url?: string`
- `basePath?: string | (() => string | Promise<string>)`
- `startMode?: "normal" | "minimized" | "hidden"`

The package owns `webPreferences.preload` and injects its preload bridge automatically for every window.

URL resolution rules:

- absolute `http:`, `https:`, and `file:` URLs are loaded with `loadURL()`
- relative URLs are resolved against `basePath` when provided
- otherwise the value is passed to `loadFile()`

That makes the package suitable for both development servers and packaged files.

## Lifecycle Decorators

Lifecycle decorators also mark the class as injectable when needed.

### `@AppReady()`

Runs after `app.whenReady()`.

- `order: AppReadyOrder.BeforeWindow` runs before the main window is created
- `order: AppReadyOrder.AfterWindow` runs after the main window is created
- `priority` sorts handlers in ascending order

Handlers are awaited sequentially. Errors are logged and do not stop the remaining handlers from running.

### `@OnAppLaunch()`

Runs when the application launches.

The handler receives:

```ts
type AppLaunchContext = {
    kind: "initial" | "second-instance";
    argv: string[];
    workingDirectory?: string;
    additionalData?: unknown;
};
```

In `instanceMode: "single"`, second-instance events are queued until initial startup has finished, then replayed in order.

### Window and App Hooks

Available decorators:

- `@OnAppQuit()`
- `@OnMainWindowClose()`
- `@OnMainWindowFocus()`
- `@OnMainWindowBlur()`
- `@OnMainWindowShow()`

Each accepts:

```ts
{
    priority?: number;
    order?: LifecycleHookOrder; // "before" | "after"
}
```

These hooks are also awaited sequentially and sorted by ascending priority.

## IPC Controllers

IPC is controller-based. Classes marked with `@BridgeController({ namespace })` are discovered from the DI container, then methods marked with `@IpcHandleTyped()` or a decorator created by `createIpcHandleTyped()` are registered through `ipcMain.handle()`.

```ts
import { BridgeController, createIpcHandleTyped } from "@mariodebono/di-electron";

type ProjectsBridge = {
    list(): Promise<string[]>;
};

const ProjectsHandle = createIpcHandleTyped<ProjectsBridge>();

@BridgeController({ namespace: "projects" })
class ProjectsBridgeController {
    @ProjectsHandle("list")
    async listProjects(): Promise<string[]> {
        return ["project-a", "project-b"];
    }
}
```

Handler results are wrapped in a stable response shape and then unwrapped by the renderer bridge.

## IPC Errors

Use `IpcError` when you want predictable, client-safe error payloads.

```ts
import { IpcError } from "@mariodebono/di-electron";

class ProjectNotFoundError extends IpcError {
    constructor(projectId: string) {
        super("projects.not_found", `Project ${projectId} was not found`);
    }
}
```

Helpers exported by the package:

- `serializeIpcError(error)`
- `toClientIpcError(error)`
- `isIpcError(value)`
- `isSerializedIpcError(value)`

Plain thrown errors are normalized into a fallback `{ type, message }` shape.

## Renderer Bridge

Use `@mariodebono/di-electron/renderer` in renderer code.

```ts
import { createRendererBridge } from "@mariodebono/di-electron/renderer";

const api = createRendererBridge<{ app: { getLocale(): Promise<string> } }>();
const locale = await api.app.getLocale();
```

The renderer bridge maps nested property access to dotted IPC channels and automatically unwraps successful responses.

The subpath also exports `createRendererEvents()` and `getDefaultRendererTransport()` for tests or specialized transports.

## Electron Services

### `ElectronModule`

`ElectronModule` provides and exports:

- `WindowManagerService`
- `ElectronAppService`
- `CloseBehaviorService`

You usually do not import `ElectronModule` manually when you use `createElectronApplication()`, because it is already composed into the platform root module.

### `ElectronAppService`

`ElectronAppService` is a thin facade over frequently used Electron APIs. It keeps Electron-specific code injectable and easy to mock in tests.

Examples include:

- `getAppPath()`
- `getPreferredSystemLanguages()`
- `getLocale()`
- `getPath(name)`
- `quit()` and `exit(code?)`
- `setHideOnClose(value)` and `getHideOnClose()`
- `setApplicationMenu(menu)` and `clearApplicationMenu()`
- `openPath(path)`, `revealPath(path)`, `openExternal(url)`
- `showMessageBox(options)` and `showOpenDialog(options)`
- `hideDock()`, `showDock()`, `setDockIcon(icon)`
- `onActivate(listener)` and `offActivate(listener)`
- `showMenu(window, menu, x, y)`
- `setName(name)`
- `setTheme(symbolColor, color)`

## Logging

Pass `loggerOptions` to `createElectronApplication()` to use the built-in `electron-log` adapter.

```ts
await createElectronApplication(AppModule, {
    loggerOptions: {
        appName: "my-app",
        logFilePath: "/tmp/my-app.log",
        fileLevel: "info",
        consoleLevel: "debug",
    },
});
```

`ElectronLoggerOptions` supports:

- `appName`
- `fileLevel`
- `consoleLevel`
- `logFilePath`
- `maxSize`
- `configure(logger)`
- `loggerInstance`

If you already have a logger implementation for `@mariodebono/di`, you can still pass `logger` directly through the base application options.

## Public API

The package exports:

- `createElectronApplication()` and the related bootstrap types
- lifecycle decorators and enums
- IPC decorators, controller helpers, and error helpers
- `ElectronModule`
- `ElectronAppService`
- `WindowManagerService`
- `CloseBehaviorService`
- `ElectronLogger` and `createElectronLogger()`
- `IpcError`, `serializeIpcError()`, `toClientIpcError()`, `isIpcError()`, and `isSerializedIpcError()`

## Renderer Subpath

`@mariodebono/di-electron/renderer` exports:

- `createRendererBridge()`
- `createRendererEvents()`
- `getDefaultRendererTransport()`
- `RendererIpcListener`
- `RendererIpcTransport`
- `RendererEventBridge`

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

This package is licensed under [MPL-2.0](LICENSE).
