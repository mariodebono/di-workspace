/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import {
    type Application,
    type Constructor,
    type CreateApplicationOptions,
    createApplication,
    Logger,
    type LogLevel,
} from "@mariodebono/di";
import { app, Menu } from "electron/main";
import {
    collectAppLaunchInvocations,
    createAppLaunchCoordinator,
} from "./app-launch-runner.js";
import { CloseBehaviorService } from "./close-behavior.service.js";
import { AppReadyOrder } from "./decorators/app-ready.decorator.js";
import {
    getAppQuitHooks,
    getMainWindowBlurHooks,
    getMainWindowCloseHooks,
    getMainWindowFocusHooks,
    getMainWindowShowHooks,
    LifecycleHookOrder,
} from "./decorators/lifecycle-hooks.decorator.js";
import {
    createElectronLogger,
    type ElectronLoggerOptions,
} from "./electron-logger.js";
import { CONTROLLER_INJECTABLE_TAG, registerIpcControllers } from "./ipc.js";
import { createLifecycleHookRunner } from "./lifecycle-hook-runner.js";
import { ElectronModule } from "./module.js";
import {
    type CreateWindowOptions,
    WindowManagerService,
} from "./window-manager.js";

/** Options used to configure the Electron application bootstrap. */
export interface CreateElectronApplicationOptions
    extends CreateApplicationOptions {
    /** Whether multiple app instances are allowed (default "multi"). */
    instanceMode?: "multi" | "single";
    /**
        Whether closing the window should hide instead of quit (default false).
    */
    hideOnClose?: boolean;
    /** Options applied when creating the main BrowserWindow. */
    mainWindowOptions?: CreateWindowOptions;
    /** Configuration passed to the Electron logger adapter. */
    loggerOptions?: ElectronLoggerOptions;
}

/** Result returned by the Electron application bootstrap. */
export type CreateElectronApplicationResult =
    | {
          status: "started";
          application: Application;
      }
    | {
          status: "redirected";
      };

const DEFAULT_CREATE_APP_OPTIONS: CreateElectronApplicationOptions = {
    instanceMode: "multi",
    hideOnClose: false,
    mainWindowOptions: {
        url: "/",
        startMode: "normal",
    },
};

const DEFAULT_ELECTRON_LOG_LEVELS: LogLevel[] = [
    "log",
    "error",
    "warn",
    "debug",
    "verbose",
    "fatal",
];

function resolveElectronLoggerOption(
    options?: CreateElectronApplicationOptions,
): CreateApplicationOptions["logger"] {
    const loggerOption = options?.logger;

    if (loggerOption === undefined) {
        return createElectronLogger(options?.loggerOptions);
    }

    if (
        loggerOption === true ||
        loggerOption === false ||
        Array.isArray(loggerOption)
    ) {
        const logger = createElectronLogger(options?.loggerOptions);
        logger.setLogLevels(
            loggerOption === true
                ? DEFAULT_ELECTRON_LOG_LEVELS
                : loggerOption === false
                  ? []
                  : loggerOption,
        );
        return logger;
    }

    return loggerOption;
}

/**
 * Builds the default application menu for the given platform.
 *
 * @param {NodeJS.Platform} platform - Platform used to decide whether a macOS menu should be created.
 */
export function createDefaultApplicationMenu(
    platform: NodeJS.Platform = process.platform,
): Electron.Menu | null {
    if (platform !== "darwin") {
        return null;
    }

    return Menu.buildFromTemplate([
        {
            // Let macOS render the standard app-name menu.
            label: undefined,
            submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "quit" },
            ],
        },
    ]);
}

/**
 * Create and wire an Electron application on top of the core DI container.
 * Combines your entry module with the Electron platform module, registers bridge controllers
 * as IPC handlers, and attaches window management and lifecycle hooks (ready, close).
 *
 * @param {Constructor<T>} entryModule - Entry module used to build the Electron application.
 * @param {CreateElectronApplicationOptions} [options] - Optional Electron bootstrap configuration.
 */
export async function createElectronApplication<T>(
    entryModule: Constructor<T>,
    options?: CreateElectronApplicationOptions,
): Promise<CreateElectronApplicationResult> {
    const EntryWithElectron = {
        module: entryModule,
        imports: [ElectronModule],
    };

    // define a platform root module that imports the ElectronModule and the app's entry module
    const PlatformRoot = {
        module: class PlatformRootModule {},
        imports: [EntryWithElectron],
        exports: [WindowManagerService],
    };

    const configuredLogger = resolveElectronLoggerOption(options);
    const instanceMode: "multi" | "single" =
        options?.instanceMode ??
        DEFAULT_CREATE_APP_OPTIONS.instanceMode ??
        "multi";
    const launchCoordinator = createAppLaunchCoordinator({
        instanceMode,
        logger: () => logger,
    });
    const lifecycleRunner = createLifecycleHookRunner({
        logger: () => logger,
    });
    let logger!: Logger;

    if (instanceMode === "single" && !app.requestSingleInstanceLock()) {
        app.exit(0);
        return { status: "redirected" };
    }

    launchCoordinator.activate();

    try {
        const application = await createApplication(PlatformRoot, {
            logger: configuredLogger,
        });

        const windowManager = application.get(WindowManagerService);
        const closeBehaviorService = application.get(CloseBehaviorService);
        logger = application.get(Logger);
        const controllers = application.findByTag(CONTROLLER_INJECTABLE_TAG);

        registerIpcControllers(controllers, application);
        launchCoordinator.setInvocations(
            collectAppLaunchInvocations(application),
        );

        closeBehaviorService.setHideOnClose(
            options?.hideOnClose ??
                DEFAULT_CREATE_APP_OPTIONS.hideOnClose ??
                false,
        );

        const appReadyInvocations =
            lifecycleRunner.collectAppReadyInvocations(application);
        const appQuitInvocations = lifecycleRunner.collectLifecycleInvocations(
            application,
            getAppQuitHooks,
        );
        const mainWindowCloseInvocations =
            lifecycleRunner.collectLifecycleInvocations(
                application,
                getMainWindowCloseHooks,
            );
        const mainWindowFocusInvocations =
            lifecycleRunner.collectLifecycleInvocations(
                application,
                getMainWindowFocusHooks,
            );
        const mainWindowBlurInvocations =
            lifecycleRunner.collectLifecycleInvocations(
                application,
                getMainWindowBlurHooks,
            );
        const mainWindowShowInvocations =
            lifecycleRunner.collectLifecycleInvocations(
                application,
                getMainWindowShowHooks,
            );

        Menu.setApplicationMenu(createDefaultApplicationMenu());
        await app.whenReady();
        await lifecycleRunner.runAppReadyHandlers(
            appReadyInvocations,
            AppReadyOrder.BeforeWindow,
        );

        const createMainWindowOptions: CreateWindowOptions = {
            ...DEFAULT_CREATE_APP_OPTIONS.mainWindowOptions,
            ...(options?.mainWindowOptions || {}),
            url:
                options?.mainWindowOptions?.url ??
                DEFAULT_CREATE_APP_OPTIONS.mainWindowOptions?.url ??
                "/",
        };

        const mainWindow = await windowManager.createMainWindow(
            createMainWindowOptions,
        );
        await lifecycleRunner.runAppReadyHandlers(
            appReadyInvocations,
            AppReadyOrder.AfterWindow,
        );
        await launchCoordinator.dispatchInitialLaunch();

        let isQuitting = false;
        let hasRunAppQuitHooks = false;

        if (mainWindow) {
            app.on("before-quit", () => {
                isQuitting = true;
                if (hasRunAppQuitHooks) {
                    return;
                }
                hasRunAppQuitHooks = true;
                void (async () => {
                    await lifecycleRunner.runAppQuitHooks(
                        appQuitInvocations,
                        LifecycleHookOrder.Before,
                    );
                    await lifecycleRunner.runAppQuitHooks(
                        appQuitInvocations,
                        LifecycleHookOrder.After,
                    );
                })();
            });

            mainWindow.on("close", async (event) => {
                if (!isQuitting) {
                    event.preventDefault();
                }

                await lifecycleRunner.runMainWindowCloseHooks(
                    mainWindowCloseInvocations,
                    LifecycleHookOrder.Before,
                );

                if (isQuitting) {
                    await lifecycleRunner.runMainWindowCloseHooks(
                        mainWindowCloseInvocations,
                        LifecycleHookOrder.After,
                    );
                    return;
                }

                if (closeBehaviorService.getHideOnClose()) {
                    mainWindow.hide();
                    await lifecycleRunner.runMainWindowCloseHooks(
                        mainWindowCloseInvocations,
                        LifecycleHookOrder.After,
                    );
                    return;
                }

                isQuitting = true;
                app.quit();
                await lifecycleRunner.runMainWindowCloseHooks(
                    mainWindowCloseInvocations,
                    LifecycleHookOrder.After,
                );
            });

            mainWindow.on("show", async () => {
                await lifecycleRunner.runMainWindowShowHooks(
                    mainWindowShowInvocations,
                    LifecycleHookOrder.Before,
                );
                await lifecycleRunner.runMainWindowShowHooks(
                    mainWindowShowInvocations,
                    LifecycleHookOrder.After,
                );
            });

            mainWindow.on("focus", async () => {
                await lifecycleRunner.runMainWindowFocusHooks(
                    mainWindowFocusInvocations,
                    LifecycleHookOrder.Before,
                );
                await lifecycleRunner.runMainWindowFocusHooks(
                    mainWindowFocusInvocations,
                    LifecycleHookOrder.After,
                );
            });

            mainWindow.on("blur", async () => {
                await lifecycleRunner.runMainWindowBlurHooks(
                    mainWindowBlurInvocations,
                    LifecycleHookOrder.Before,
                );
                await lifecycleRunner.runMainWindowBlurHooks(
                    mainWindowBlurInvocations,
                    LifecycleHookOrder.After,
                );
            });
        }

        const originalDestroy = application.destroy.bind(application);
        const originalDestroyAsync = application.destroyAsync.bind(application);

        application.destroy = (): void => {
            launchCoordinator.cleanup();
            originalDestroy();
        };
        application.destroyAsync = async (): Promise<void> => {
            launchCoordinator.cleanup();
            await originalDestroyAsync();
        };

        return {
            status: "started",
            application,
        };
    } catch (error) {
        launchCoordinator.cleanup();
        throw error;
    }
}
