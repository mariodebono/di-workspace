/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    type Constructor,
    Injectable,
    Logger,
    type LoggerService,
    Module,
} from "@mariodebono/di";
import { app as electronMainApp, Menu } from "electron/main";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMainMocks = vi.hoisted(() => ({
    app: {
        dock: {
            hide: vi.fn(),
            setIcon: vi.fn(),
            show: vi.fn().mockResolvedValue(undefined),
        },
        exit: vi.fn(),
        focus: vi.fn(),
        getAppPath: vi.fn().mockReturnValue("/app"),
        getLocale: vi.fn().mockReturnValue("en-US"),
        getPath: vi.fn().mockReturnValue("/tmp"),
        getPreferredSystemLanguages: vi.fn().mockReturnValue(["en-US"]),
        on: vi.fn(),
        quit: vi.fn(),
        releaseSingleInstanceLock: vi.fn(),
        removeListener: vi.fn(),
        requestSingleInstanceLock: vi.fn().mockReturnValue(true),
        setName: vi.fn(),
        show: vi.fn(),
        whenReady: vi.fn().mockResolvedValue(undefined),
    },
    BrowserWindow: class BrowserWindow {},
    Menu: {
        buildFromTemplate: vi.fn(),
        setApplicationMenu: vi.fn(),
    },
    dialog: {
        showMessageBox: vi.fn(),
        showOpenDialog: vi.fn(),
    },
    shell: {
        openExternal: vi.fn(),
        openPath: vi.fn(),
        showItemInFolder: vi.fn(),
    },
}));

vi.mock("electron/main", () => ({
    app: electronMainMocks.app,
    BrowserWindow: electronMainMocks.BrowserWindow,
    Menu: electronMainMocks.Menu,
}));

vi.mock("electron", () => ({
    app: electronMainMocks.app,
    BrowserWindow: electronMainMocks.BrowserWindow,
    dialog: electronMainMocks.dialog,
    Menu: electronMainMocks.Menu,
    shell: electronMainMocks.shell,
}));

vi.mock("electron-log", () => ({
    default: {
        create: vi.fn(() => ({
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            initialize: vi.fn(),
            transports: {
                console: {},
                file: {
                    setAppName: vi.fn(),
                },
            },
            warn: vi.fn(),
        })),
    },
}));

import {
    createDefaultApplicationMenu,
    createElectronApplication,
} from "../src/application.js";
import { CloseBehaviorService } from "../src/close-behavior.service.js";
import {
    type AppLaunchContext,
    type AppLaunchOptions,
    OnAppLaunch,
} from "../src/decorators/app-launch.decorator.js";
import {
    AppReady,
    type AppReadyOptions,
    AppReadyOrder,
} from "../src/decorators/app-ready.decorator.js";
import {
    LifecycleHookOrder,
    OnAppQuit,
    OnMainWindowBlur,
    OnMainWindowClose,
    OnMainWindowFocus,
    OnMainWindowShow,
} from "../src/decorators/lifecycle-hooks.decorator.js";
import { ElectronAppService } from "../src/electron-app.service.js";
import { WindowManagerService } from "../src/window-manager.js";

Reflect.defineMetadata("design:paramtypes", [Logger], WindowManagerService);
Reflect.defineMetadata(
    "design:paramtypes",
    [WindowManagerService, CloseBehaviorService],
    ElectronAppService,
);

type MainWindowCloseListener = (event: {
    preventDefault: () => void;
}) => void | Promise<void>;
type VoidListener = () => void | Promise<void>;

beforeEach(() => {
    vi.clearAllMocks();
    electronMainMocks.app.dock.hide.mockClear();
    electronMainMocks.app.dock.setIcon.mockClear();
    electronMainMocks.app.dock.show.mockReset().mockResolvedValue(undefined);
    electronMainMocks.app.exit.mockClear();
    electronMainMocks.app.focus.mockClear();
    electronMainMocks.app.getAppPath.mockReset().mockReturnValue("/app");
    electronMainMocks.app.getLocale.mockReset().mockReturnValue("en-US");
    electronMainMocks.app.getPath.mockReset().mockReturnValue("/tmp");
    electronMainMocks.app.getPreferredSystemLanguages
        .mockReset()
        .mockReturnValue(["en-US"]);
    electronMainMocks.app.on.mockClear();
    electronMainMocks.app.quit.mockClear();
    electronMainMocks.app.releaseSingleInstanceLock.mockClear();
    electronMainMocks.app.removeListener.mockClear();
    electronMainMocks.app.requestSingleInstanceLock
        .mockReset()
        .mockReturnValue(true);
    electronMainMocks.app.setName.mockClear();
    electronMainMocks.app.show.mockClear();
    electronMainMocks.app.whenReady.mockReset().mockResolvedValue(undefined);
    electronMainMocks.Menu.buildFromTemplate.mockReset();
    electronMainMocks.Menu.setApplicationMenu.mockClear();
});

describe("createElectronApplication", () => {
    it("creates a minimal default application menu for macOS only", () => {
        const fakeMenu = {
            items: [{ submenu: { items: [{ role: "quit" }] } }],
        };
        const buildFromTemplateSpy = vi
            .spyOn(Menu, "buildFromTemplate")
            .mockReturnValue(fakeMenu as unknown as Electron.Menu);

        const macMenu = createDefaultApplicationMenu("darwin");
        const otherMenu = createDefaultApplicationMenu("win32");

        expect(buildFromTemplateSpy).toHaveBeenCalledWith([
            {
                label: undefined,
                submenu: [
                    { role: "about" },
                    { type: "separator" },
                    { role: "quit" },
                ],
            },
        ]);
        expect(macMenu).toBe(fakeMenu);
        expect(otherMenu).toBeNull();
    });

    it("installs the reset application menu during bootstrap", async () => {
        const logger = createMockLogger();
        const setApplicationMenuSpy = vi
            .spyOn(Menu, "setApplicationMenu")
            .mockImplementation(() => undefined);

        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            on: vi.fn(),
            hide: vi.fn(),
        } as never);

        @Module({})
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            mainWindowOptions: {
                url: "/",
            },
        });

        expect(setApplicationMenuSpy).toHaveBeenCalledOnce();
        const [installedMenu] = setApplicationMenuSpy.mock.calls[0] ?? [];
        if (process.platform === "darwin") {
            expect(installedMenu).not.toBeNull();
        } else {
            expect(installedMenu).toBeNull();
        }

        await application.destroyAsync();
    });

    it("runs app-ready hooks by phase and priority and continues on failures", async () => {
        const executionOrder: string[] = [];
        const logger = createMockLogger();

        vi.spyOn(electronMainApp, "whenReady").mockImplementation(async () => {
            executionOrder.push("whenReady");
        });

        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockImplementation(async () => {
            executionOrder.push("createWindow");
            return {
                on: vi.fn(),
                hide: vi.fn(),
            } as never;
        });

        @Injectable()
        class BeforeOne {
            initialize(): void {
                executionOrder.push("before:one");
            }
        }
        applyAppReady(BeforeOne.prototype, "initialize", {
            order: AppReadyOrder.BeforeWindow,
            priority: 1,
        });

        @Injectable()
        class BeforeTwo {
            initialize(): void {
                executionOrder.push("before:two");
            }
        }
        applyAppReady(BeforeTwo.prototype, "initialize", {
            order: AppReadyOrder.BeforeWindow,
            priority: 1,
        });

        @Injectable()
        class BeforeThree {
            initialize(): void {
                executionOrder.push("before:three");
            }
        }
        applyAppReady(BeforeThree.prototype, "initialize", {
            order: AppReadyOrder.BeforeWindow,
            priority: 2,
        });

        @Injectable()
        class AfterFailure {
            initialize(): void {
                executionOrder.push("after:failure");
                throw new Error("boom");
            }
        }
        applyAppReady(AfterFailure.prototype, "initialize", {
            priority: 0,
        });

        @Injectable()
        class AfterDefault {
            initialize(): void {
                executionOrder.push("after:default");
            }
        }
        applyAppReady(AfterDefault.prototype, "initialize");

        @Injectable()
        class AfterLater {
            initialize(): void {
                executionOrder.push("after:later");
            }
        }
        applyAppReady(AfterLater.prototype, "initialize", {
            priority: 5,
        });

        @Module({
            providers: [
                BeforeOne,
                BeforeTwo,
                BeforeThree,
                AfterFailure,
                AfterDefault,
                AfterLater,
            ],
        })
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            mainWindowOptions: {
                url: "/",
            },
        });

        expect(executionOrder).toEqual([
            "whenReady",
            "before:one",
            "before:two",
            "before:three",
            "createWindow",
            "after:failure",
            "after:default",
            "after:later",
        ]);
        expect(logger.error).toHaveBeenCalledWith(
            "@AppReady handler failed: AfterFailure.initialize",
            expect.any(Error),
        );

        await application.destroyAsync();
    });

    it("executes app-ready handlers with their own class instance context", async () => {
        const logger = createMockLogger();

        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            on: vi.fn(),
            hide: vi.fn(),
        } as never);

        @Injectable()
        class HandlerWithState {
            initializedBySelf = false;
            private readonly marker = "handler-instance";

            initialize(): void {
                this.initializedBySelf = this.marker === "handler-instance";
            }
        }
        applyAppReady(HandlerWithState.prototype, "initialize");

        @Module({
            providers: [HandlerWithState],
        })
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            mainWindowOptions: {
                url: "/",
            },
        });

        const handler = application.get(HandlerWithState);
        expect(handler.initializedBySelf).toBe(true);

        await application.destroyAsync();
    });

    it("does not request the single instance lock in multi mode", async () => {
        const logger = createMockLogger();
        const lockSpy = mockElectronAppMethod(
            "requestSingleInstanceLock",
            vi.fn().mockReturnValue(true),
        );

        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            on: vi.fn(),
            hide: vi.fn(),
        } as never);

        @Module({})
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            mainWindowOptions: {
                url: "/",
            },
        });

        expect(lockSpy).not.toHaveBeenCalled();

        await application.destroyAsync();
    });

    it("returns redirected when single-instance mode cannot acquire the lock", async () => {
        const logger = createMockLogger();
        const lockSpy = mockElectronAppMethod(
            "requestSingleInstanceLock",
            vi.fn().mockReturnValue(false),
        );
        const exitSpy = vi
            .spyOn(electronMainApp, "exit")
            .mockImplementation(() => undefined as never);
        const whenReadySpy = vi.spyOn(electronMainApp, "whenReady");
        const createMainWindowSpy = vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        );

        @Module({})
        class EntryModule {}

        const result = await createElectronApplication(EntryModule, {
            instanceMode: "single",
            logger,
            mainWindowOptions: {
                url: "/",
            },
        });

        expect(result).toEqual({ status: "redirected" });
        expect(lockSpy).toHaveBeenCalledOnce();
        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(whenReadySpy).not.toHaveBeenCalled();
        expect(createMainWindowSpy).not.toHaveBeenCalled();
    });

    it("requests the single-instance lock before bootstrap and dispatches queued launches in order", async () => {
        const logger = createMockLogger();
        const executionOrder: string[] = [];
        let secondInstanceListener:
            | ((
                  event: Electron.Event,
                  argv: string[],
                  workingDirectory: string,
                  additionalData: unknown,
              ) => void)
            | undefined;

        const requestSingleInstanceLock = mockElectronAppMethod(
            "requestSingleInstanceLock",
            vi.fn().mockImplementation(() => {
                executionOrder.push("lock");
                return true;
            }),
        );
        mockElectronAppMethod(
            "releaseSingleInstanceLock",
            vi.fn().mockReturnValue(undefined),
        );
        mockElectronAppOn((event, listener) => {
            if (event === "second-instance") {
                secondInstanceListener =
                    listener as typeof secondInstanceListener;
            }
        });
        vi.spyOn(electronMainApp, "whenReady").mockImplementation(async () => {
            executionOrder.push("whenReady");
        });

        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockImplementation(async () => {
            executionOrder.push("createWindow");
            secondInstanceListener?.(
                {} as Electron.Event,
                ["electron", "app", "--open", "project"],
                "/tmp/second-instance",
                { source: "test" },
            );

            return {
                on: vi.fn(),
                hide: vi.fn(),
            } as never;
        });

        @Injectable()
        class LaunchFirst {
            contexts: AppLaunchContext[] = [];

            onLaunch(context: AppLaunchContext): void {
                this.contexts.push(context);
                executionOrder.push(`${context.kind}:first`);
            }
        }
        applyOnAppLaunch(LaunchFirst.prototype, "onLaunch", {
            priority: -1,
        });

        @Injectable()
        class LaunchFailure {
            onLaunch(context: AppLaunchContext): void {
                executionOrder.push(`${context.kind}:failure`);
                throw new Error(`boom:${context.kind}`);
            }
        }
        applyOnAppLaunch(LaunchFailure.prototype, "onLaunch");

        @Injectable()
        class LaunchLater {
            onLaunch(context: AppLaunchContext): void {
                executionOrder.push(`${context.kind}:later`);
            }
        }
        applyOnAppLaunch(LaunchLater.prototype, "onLaunch", {
            priority: 10,
        });

        @Module({
            providers: [LaunchFirst, LaunchFailure, LaunchLater],
        })
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            instanceMode: "single",
            logger,
            mainWindowOptions: {
                url: "/",
            },
        });

        expect(executionOrder).toEqual([
            "lock",
            "whenReady",
            "createWindow",
            "initial:first",
            "initial:failure",
            "initial:later",
            "second-instance:first",
            "second-instance:failure",
            "second-instance:later",
        ]);
        expect(requestSingleInstanceLock).toHaveBeenCalledOnce();
        expect(logger.error).toHaveBeenCalledWith(
            "@OnAppLaunch handler failed: LaunchFailure.onLaunch",
            expect.any(Error),
        );

        const launchFirst = application.get(LaunchFirst);
        expect(launchFirst.contexts).toEqual([
            {
                kind: "initial",
                argv: process.argv,
                workingDirectory: process.cwd(),
            },
            {
                kind: "second-instance",
                argv: ["electron", "app", "--open", "project"],
                workingDirectory: "/tmp/second-instance",
                additionalData: { source: "test" },
            },
        ]);

        await application.destroyAsync();
    });

    it("passes url to main window and quits on window close when hideOnClose is false", async () => {
        const logger = createMockLogger();
        const listeners: {
            close?: MainWindowCloseListener;
        } = {};
        const hide = vi.fn();

        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockImplementation(async (options) => {
            expect(options.url).toBe("#/");
            return {
                hide,
                on: vi.fn().mockImplementation((event, listener) => {
                    if (event === "close") {
                        listeners.close = listener as MainWindowCloseListener;
                    }
                }),
            } as never;
        });
        const quitSpy = vi
            .spyOn(electronMainApp, "quit")
            .mockImplementation(() => undefined);

        @Module({})
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            hideOnClose: false,
            mainWindowOptions: {
                url: "#/",
            },
        });

        const preventDefault = vi.fn();
        await requireValue(
            listeners.close,
            "Expected close listener to be registered",
        )({ preventDefault });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(hide).not.toHaveBeenCalled();
        expect(quitSpy).toHaveBeenCalledOnce();

        await application.destroyAsync();
    });

    it("hides the main window instead of quitting when hideOnClose is true", async () => {
        const logger = createMockLogger();
        const listeners: {
            close?: MainWindowCloseListener;
        } = {};
        const hide = vi.fn();

        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            hide,
            on: vi.fn().mockImplementation((event, listener) => {
                if (event === "close") {
                    listeners.close = listener as MainWindowCloseListener;
                }
            }),
        } as never);
        const quitSpy = vi
            .spyOn(electronMainApp, "quit")
            .mockImplementation(() => undefined);

        @Module({})
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            hideOnClose: true,
            mainWindowOptions: {
                url: "/",
            },
        });

        const preventDefault = vi.fn();
        await requireValue(
            listeners.close,
            "Expected close listener to be registered",
        )({ preventDefault });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(hide).toHaveBeenCalledOnce();
        expect(quitSpy).not.toHaveBeenCalled();

        await application.destroyAsync();
    });

    it("prevents the main window close synchronously before async before-close hooks resolve", async () => {
        const logger = createMockLogger();
        const listeners: {
            close?: MainWindowCloseListener;
        } = {};
        const hide = vi.fn();
        let resolveBeforeHook: (() => void) | undefined;

        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            hide,
            on: vi.fn().mockImplementation((event, listener) => {
                if (event === "close") {
                    listeners.close = listener as MainWindowCloseListener;
                }
            }),
        } as never);

        @Injectable()
        class LifecycleHooks {
            @OnMainWindowClose({
                order: LifecycleHookOrder.Before,
                priority: 0,
            })
            async onCloseBefore(): Promise<void> {
                await new Promise<void>((resolve) => {
                    resolveBeforeHook = resolve;
                });
            }
        }

        @Module({
            providers: [LifecycleHooks],
        })
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            hideOnClose: true,
            mainWindowOptions: {
                url: "/",
            },
        });

        const preventDefault = vi.fn();
        const closeResult = requireValue(
            listeners.close,
            "Expected close listener to be registered",
        )({ preventDefault });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(hide).not.toHaveBeenCalled();

        requireValue(
            resolveBeforeHook,
            "Expected before-close hook to be waiting",
        )();
        await closeResult;

        expect(hide).toHaveBeenCalledOnce();

        await application.destroyAsync();
    });

    it("allows runtime override from hide to quit", async () => {
        const logger = createMockLogger();
        const listeners: {
            close?: MainWindowCloseListener;
        } = {};
        const hide = vi.fn();

        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            hide,
            on: vi.fn().mockImplementation((event, listener) => {
                if (event === "close") {
                    listeners.close = listener as MainWindowCloseListener;
                }
            }),
        } as never);
        const quitSpy = vi
            .spyOn(electronMainApp, "quit")
            .mockImplementation(() => undefined);

        @Module({})
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            hideOnClose: true,
            mainWindowOptions: {
                url: "/",
            },
        });

        const appService = application.get(ElectronAppService);
        appService.setHideOnClose(false);

        const preventDefault = vi.fn();
        await requireValue(
            listeners.close,
            "Expected close listener to be registered",
        )({ preventDefault });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(hide).not.toHaveBeenCalled();
        expect(quitSpy).toHaveBeenCalledOnce();

        await application.destroyAsync();
    });

    it("allows runtime override from quit to hide", async () => {
        const logger = createMockLogger();
        const listeners: {
            close?: MainWindowCloseListener;
        } = {};
        const hide = vi.fn();

        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            hide,
            on: vi.fn().mockImplementation((event, listener) => {
                if (event === "close") {
                    listeners.close = listener as MainWindowCloseListener;
                }
            }),
        } as never);
        const quitSpy = vi
            .spyOn(electronMainApp, "quit")
            .mockImplementation(() => undefined);

        @Module({})
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            hideOnClose: false,
            mainWindowOptions: {
                url: "/",
            },
        });

        const appService = application.get(ElectronAppService);
        appService.setHideOnClose(true);

        const preventDefault = vi.fn();
        await requireValue(
            listeners.close,
            "Expected close listener to be registered",
        )({ preventDefault });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(hide).toHaveBeenCalledOnce();
        expect(quitSpy).not.toHaveBeenCalled();

        await application.destroyAsync();
    });

    it("does not convert app quit flow into hide behavior", async () => {
        const logger = createMockLogger();
        const listeners: {
            beforeQuit?: VoidListener;
            close?: MainWindowCloseListener;
        } = {};
        const hide = vi.fn();

        mockElectronAppOn((event, listener) => {
            if (event === "before-quit") {
                listeners.beforeQuit = listener as VoidListener;
            }
        });
        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            hide,
            on: vi.fn().mockImplementation((event, listener) => {
                if (event === "close") {
                    listeners.close = listener as MainWindowCloseListener;
                }
            }),
        } as never);
        const quitSpy = vi
            .spyOn(electronMainApp, "quit")
            .mockImplementation(() => undefined);

        @Module({})
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            hideOnClose: true,
            mainWindowOptions: {
                url: "/",
            },
        });

        await requireValue(
            listeners.beforeQuit,
            "Expected before-quit listener to be registered",
        )();
        const preventDefault = vi.fn();
        await requireValue(
            listeners.close,
            "Expected close listener to be registered",
        )({ preventDefault });

        expect(preventDefault).not.toHaveBeenCalled();
        expect(hide).not.toHaveBeenCalled();
        expect(quitSpy).not.toHaveBeenCalled();

        await application.destroyAsync();
    });

    it("runs lifecycle hooks by order and priority and continues on hook errors", async () => {
        const logger = createMockLogger();
        const executionOrder: string[] = [];
        const listeners: {
            beforeQuit?: VoidListener;
            blur?: VoidListener;
            close?: MainWindowCloseListener;
            focus?: VoidListener;
            show?: VoidListener;
        } = {};
        const hide = vi.fn(() => {
            executionOrder.push("hide");
        });

        mockElectronAppOn((event, listener) => {
            if (event === "before-quit") {
                listeners.beforeQuit = listener as VoidListener;
            }
        });
        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            hide,
            on: vi.fn().mockImplementation((event, listener) => {
                if (event === "blur") {
                    listeners.blur = listener as VoidListener;
                }
                if (event === "close") {
                    listeners.close = listener as MainWindowCloseListener;
                }
                if (event === "focus") {
                    listeners.focus = listener as VoidListener;
                }
                if (event === "show") {
                    listeners.show = listener as VoidListener;
                }
            }),
        } as never);

        @Injectable()
        class LifecycleHooks {
            @OnMainWindowBlur({
                order: LifecycleHookOrder.Before,
                priority: 1,
            })
            onBlurBefore(): void {
                executionOrder.push("blur:before");
            }

            @OnMainWindowBlur({
                order: LifecycleHookOrder.After,
                priority: 0,
            })
            onBlurAfter(): void {
                executionOrder.push("blur:after");
            }

            @OnMainWindowShow({
                order: LifecycleHookOrder.Before,
                priority: 1,
            })
            onShowBefore(): void {
                executionOrder.push("show:before");
            }

            @OnMainWindowFocus({
                order: LifecycleHookOrder.Before,
                priority: 0,
            })
            onFocusBefore(): void {
                executionOrder.push("focus:before");
            }

            @OnMainWindowFocus({
                order: LifecycleHookOrder.Before,
                priority: 2,
            })
            onFocusBeforeThrow(): void {
                executionOrder.push("focus:throw");
                throw new Error("focus-failure");
            }

            @OnMainWindowFocus({
                order: LifecycleHookOrder.After,
                priority: 0,
            })
            onFocusAfter(): void {
                executionOrder.push("focus:after");
            }

            @OnMainWindowShow({
                order: LifecycleHookOrder.After,
                priority: 0,
            })
            onShowAfter(): void {
                executionOrder.push("show:after");
            }

            @OnMainWindowClose({
                order: LifecycleHookOrder.Before,
                priority: 0,
            })
            onCloseBefore(): void {
                executionOrder.push("close:before");
            }

            @OnMainWindowClose({
                order: LifecycleHookOrder.Before,
                priority: 2,
            })
            onCloseBeforeThrow(): void {
                executionOrder.push("close:throw");
                throw new Error("close-failure");
            }

            @OnMainWindowClose({
                order: LifecycleHookOrder.After,
                priority: 0,
            })
            onCloseAfter(): void {
                executionOrder.push("close:after");
            }

            @OnAppQuit({
                order: LifecycleHookOrder.Before,
                priority: 1,
            })
            onBeforeQuitLate(): void {
                executionOrder.push("beforeQuit:late");
            }

            @OnAppQuit({
                order: LifecycleHookOrder.Before,
                priority: 0,
            })
            onBeforeQuitEarly(): void {
                executionOrder.push("beforeQuit:early");
            }

            @OnAppQuit({
                order: LifecycleHookOrder.After,
                priority: 0,
            })
            onBeforeQuitAfter(): void {
                executionOrder.push("beforeQuit:after");
            }
        }

        @Module({
            providers: [LifecycleHooks],
        })
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            hideOnClose: true,
            mainWindowOptions: {
                url: "/",
            },
        });

        await requireValue(
            listeners.focus,
            "Expected focus listener to be registered",
        )();
        await requireValue(
            listeners.blur,
            "Expected blur listener to be registered",
        )();
        await requireValue(
            listeners.show,
            "Expected show listener to be registered",
        )();
        const preventDefault = vi.fn();
        await requireValue(
            listeners.close,
            "Expected close listener to be registered",
        )({ preventDefault });
        await requireValue(
            listeners.beforeQuit,
            "Expected before-quit listener to be registered",
        )();
        await Promise.resolve();
        await Promise.resolve();

        expect(preventDefault).toHaveBeenCalledOnce();
        await vi.waitFor(() => {
            expect(executionOrder).toEqual([
                "focus:before",
                "focus:throw",
                "focus:after",
                "blur:before",
                "blur:after",
                "show:before",
                "show:after",
                "close:before",
                "close:throw",
                "hide",
                "close:after",
                "beforeQuit:early",
                "beforeQuit:late",
                "beforeQuit:after",
            ]);
        });
        expect(logger.error).toHaveBeenCalledWith(
            "@OnMainWindowFocus handler failed: LifecycleHooks.onFocusBeforeThrow",
            expect.any(Error),
        );
        expect(logger.error).toHaveBeenCalledWith(
            "@OnMainWindowClose handler failed: LifecycleHooks.onCloseBeforeThrow",
            expect.any(Error),
        );

        await application.destroyAsync();
    });

    it("runs app quit hooks only once when before-quit fires multiple times", async () => {
        const logger = createMockLogger();
        const executionOrder: string[] = [];
        const listeners: {
            beforeQuit?: VoidListener;
        } = {};

        mockElectronAppOn((event, listener) => {
            if (event === "before-quit") {
                listeners.beforeQuit = listener as VoidListener;
            }
        });
        vi.spyOn(electronMainApp, "whenReady").mockResolvedValue(undefined);
        vi.spyOn(
            WindowManagerService.prototype,
            "createMainWindow",
        ).mockResolvedValue({
            on: vi.fn(),
        } as never);

        @Injectable()
        class LifecycleHooks {
            @OnAppQuit({
                order: LifecycleHookOrder.Before,
                priority: 0,
            })
            onBeforeQuit(): void {
                executionOrder.push("beforeQuit");
            }

            @OnAppQuit({
                order: LifecycleHookOrder.After,
                priority: 0,
            })
            onAfterQuit(): void {
                executionOrder.push("afterQuit");
            }
        }

        @Module({
            providers: [LifecycleHooks],
        })
        class EntryModule {}

        const application = await startElectronApplication(EntryModule, {
            logger,
            mainWindowOptions: {
                url: "/",
            },
        });

        const beforeQuit = requireValue(
            listeners.beforeQuit,
            "Expected before-quit listener to be registered",
        );
        await beforeQuit();
        await beforeQuit();
        await Promise.resolve();
        await Promise.resolve();

        expect(executionOrder).toEqual(["beforeQuit", "afterQuit"]);

        await application.destroyAsync();
    });
});

function createMockLogger(): LoggerService & {
    debug: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    withContext: ReturnType<typeof vi.fn>;
} {
    const logger = {
        debug: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
        withContext: vi.fn(),
    };
    logger.withContext.mockImplementation(() => logger);
    return logger;
}

function applyAppReady(
    target: object,
    methodName: string,
    options?: AppReadyOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    AppReady(options)(target, methodName, descriptor);
}

function applyOnAppLaunch(
    target: object,
    methodName: string,
    options?: AppLaunchOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    OnAppLaunch(options)(target, methodName, descriptor);
}

async function startElectronApplication<T>(
    entryModule: Constructor<T>,
    options?: Parameters<typeof createElectronApplication>[1],
) {
    const result = await createElectronApplication(entryModule, options);
    if (result.status !== "started") {
        throw new Error("Expected started electron application result.");
    }

    return result.application;
}

function mockElectronAppMethod<TArgs extends unknown[], TReturn>(
    name: string,
    implementation: (...args: TArgs) => TReturn,
) {
    Object.defineProperty(electronMainApp, name, {
        configurable: true,
        value: implementation,
        writable: true,
    });

    return implementation;
}

function mockElectronAppOn(
    capture: (event: string, listener: (...args: unknown[]) => unknown) => void,
): void {
    vi.spyOn(electronMainApp, "on").mockImplementation(((
        event: string,
        listener: (...args: unknown[]) => unknown,
    ) => {
        capture(event, listener);
        return electronMainApp;
    }) as unknown as typeof electronMainApp.on);
}

function requireValue<T>(value: T, message: string): NonNullable<T> {
    if (value == null) {
        throw new Error(message);
    }

    return value as NonNullable<T>;
}
