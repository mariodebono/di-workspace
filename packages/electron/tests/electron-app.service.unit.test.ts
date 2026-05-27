/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app as electronApp, Menu } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CloseBehaviorService } from "../src/close-behavior.service.js";
import { ElectronAppService } from "../src/electron-app.service.js";
import type { WindowManagerService } from "../src/window-manager.js";

const electronMocks = vi.hoisted(() => {
    const platform = vi.fn();
    const app = {
        dock: {
            hide: vi.fn(),
            setIcon: vi.fn(),
            show: vi.fn().mockResolvedValue(undefined),
        },
        exit: vi.fn(),
        getAppPath: vi.fn().mockReturnValue("/app"),
        getLocale: vi.fn().mockReturnValue("en-US"),
        getPath: vi.fn().mockReturnValue("/var/logs"),
        getPreferredSystemLanguages: vi.fn().mockReturnValue(["en-US"]),
        on: vi.fn(),
        quit: vi.fn(),
        removeListener: vi.fn(),
        setName: vi.fn(),
    };

    return {
        platform,
        app,
        dialog: {
            showMessageBox: vi.fn(),
            showOpenDialog: vi.fn(),
        },
        Menu: {
            setApplicationMenu: vi.fn(),
        },
        shell: {
            openExternal: vi.fn(),
            openPath: vi.fn(),
            showItemInFolder: vi.fn(),
        },
    };
});

vi.mock("node:os", () => ({
    platform: electronMocks.platform,
}));

vi.mock("electron", () => electronMocks);

beforeEach(() => {
    electronMocks.platform.mockReset().mockReturnValue("linux");
    electronMocks.app.dock = {
        hide: vi.fn(),
        setIcon: vi.fn(),
        show: vi.fn().mockResolvedValue(undefined),
    };
    electronMocks.app.exit.mockClear();
    electronMocks.app.getAppPath.mockClear();
    electronMocks.app.getLocale.mockReset().mockReturnValue("en-US");
    electronMocks.app.getPath.mockReset().mockReturnValue("/var/logs");
    electronMocks.app.getPreferredSystemLanguages
        .mockReset()
        .mockReturnValue(["en-US"]);
    electronMocks.app.on.mockClear();
    electronMocks.app.quit.mockClear();
    electronMocks.app.removeListener.mockClear();
    electronMocks.app.setName.mockClear();
    electronMocks.dialog.showMessageBox.mockReset();
    electronMocks.dialog.showOpenDialog.mockReset();
    electronMocks.Menu.setApplicationMenu.mockClear();
    electronMocks.shell.openExternal.mockReset();
    electronMocks.shell.openPath.mockReset();
    electronMocks.shell.showItemInFolder.mockClear();
});

describe("ElectronAppService", () => {
    it("returns preferred system languages from app", () => {
        const systemLanguages = ["en-US", "it-IT"];
        const systemLanguagesSpy = vi
            .spyOn(electronApp, "getPreferredSystemLanguages")
            .mockReturnValue(systemLanguages);
        const { appService } = createAppServiceContext();

        expect(appService.getPreferredSystemLanguages()).toEqual(
            systemLanguages,
        );
        expect(systemLanguagesSpy).toHaveBeenCalledOnce();
    });

    it("returns locale from app", () => {
        const localeSpy = vi
            .spyOn(electronApp, "getLocale")
            .mockReturnValue("en-US");
        const { appService } = createAppServiceContext();

        expect(appService.getLocale()).toBe("en-US");
        expect(localeSpy).toHaveBeenCalledOnce();
    });

    // it("resolves the logs path from config when provided", () => {
    //     const getPathSpy = vi.spyOn(electronApp, "getPath");
    //     const { appService, configService } = createAppServiceContext();
    //     configService.get.mockReturnValue("/var/logs/app");

    //     expect(appService.getPath("logs")).toBe("/var/logs/app");
    //     expect(configService.get).toHaveBeenCalledWith("logDir");
    //     expect(getPathSpy).not.toHaveBeenCalled();
    // });

    // it("falls back to the Electron logs path when config is missing", () => {
    //     const getPathSpy = vi
    //         .spyOn(electronApp, "getPath")
    //         .mockReturnValue("/tmp/electron-logs");
    //     const { appService, configService } = createAppServiceContext();

    //     expect(appService.getPath("logs")).toBe("/tmp/electron-logs");
    //     expect(configService.get).toHaveBeenCalledWith("logDir");
    //     expect(getPathSpy).toHaveBeenCalledWith("logs");
    // });

    it("calls app.quit from quit()", () => {
        const quitSpy = vi.spyOn(electronApp, "quit");
        const { appService } = createAppServiceContext();

        appService.quit();

        expect(quitSpy).toHaveBeenCalledOnce();
    });

    it("calls Menu.setApplicationMenu with the provided menu", () => {
        const setApplicationMenuSpy = vi.spyOn(Menu, "setApplicationMenu");
        const { appService } = createAppServiceContext();
        const menu = {} as unknown as Menu;

        appService.setApplicationMenu(menu);

        expect(setApplicationMenuSpy).toHaveBeenCalledWith(menu);
    });

    it("clears the application menu", () => {
        const setApplicationMenuSpy = vi.spyOn(Menu, "setApplicationMenu");
        const { appService } = createAppServiceContext();

        appService.clearApplicationMenu();

        expect(setApplicationMenuSpy).toHaveBeenCalledWith(null);
    });

    it("delegates setHideOnClose to close behavior service", () => {
        const { appService, closeBehaviorService } = createAppServiceContext();

        appService.setHideOnClose(true);

        expect(closeBehaviorService.setHideOnClose).toHaveBeenCalledWith(true);
    });

    it("delegates getHideOnClose to close behavior service", () => {
        const { appService, closeBehaviorService } = createAppServiceContext();
        closeBehaviorService.getHideOnClose.mockReturnValue(true);

        const result = appService.getHideOnClose();

        expect(result).toBe(true);
        expect(closeBehaviorService.getHideOnClose).toHaveBeenCalledOnce();
    });

    it("hides the dock when available", async () => {
        await withMockDock(async ({ hide }) => {
            const { appService } = createAppServiceContext();

            appService.hideDock();

            expect(hide).toHaveBeenCalledOnce();
        });
    });

    it("shows the dock when available", async () => {
        await withMockDock(async ({ show }) => {
            const { appService } = createAppServiceContext();

            await appService.showDock();

            expect(show).toHaveBeenCalledOnce();
        });
    });

    it("sets the dock icon when available", async () => {
        await withMockDock(async ({ setIcon }) => {
            const { appService } = createAppServiceContext();

            appService.setDockIcon("/app/icon.png");

            expect(setIcon).toHaveBeenCalledWith("/app/icon.png");
        });
    });

    it("registers activate listeners on the Electron app", () => {
        const onSpy = vi.spyOn(electronApp, "on");
        const { appService } = createAppServiceContext();
        const listener = vi.fn();

        appService.onActivate(listener);

        expect(onSpy).toHaveBeenCalledWith("activate", listener);
    });

    it("removes activate listeners from the Electron app", () => {
        const removeListener = vi.fn();
        const descriptor = Object.getOwnPropertyDescriptor(
            electronApp,
            "removeListener",
        );

        Object.defineProperty(electronApp, "removeListener", {
            configurable: true,
            value: removeListener,
        });

        try {
            const { appService } = createAppServiceContext();
            const listener = vi.fn();

            appService.offActivate(listener);

            expect(removeListener).toHaveBeenCalledWith("activate", listener);
        } finally {
            if (descriptor) {
                Object.defineProperty(
                    electronApp,
                    "removeListener",
                    descriptor,
                );
            } else {
                Reflect.deleteProperty(electronApp, "removeListener");
            }
        }
    });

    it("delegates app getters and main window access", () => {
        const mainWindow = { id: 1 };
        const { appService } = createAppServiceContext(mainWindow);
        const getAppPathSpy = vi.spyOn(electronApp, "getAppPath");
        const getPathSpy = vi.spyOn(electronApp, "getPath");

        expect(appService.MainWindow).toBe(mainWindow);
        expect(appService.getAppPath()).toBe("/app");
        expect(appService.getPath("logs")).toBe("/var/logs");
        expect(getAppPathSpy).toHaveBeenCalledOnce();
        expect(getPathSpy).toHaveBeenCalledWith("logs");
    });

    it("delegates path, shell, menu, and window controls", async () => {
        const mainWindow = {
            setTitleBarOverlay: vi.fn(),
        };
        const { appService } = createAppServiceContext(mainWindow);
        const exitSpy = vi.spyOn(electronApp, "exit");
        const openPathSpy = vi.spyOn(electronMocks.shell, "openPath");
        const openExternalSpy = vi.spyOn(electronMocks.shell, "openExternal");
        const showItemInFolderSpy = vi.spyOn(
            electronMocks.shell,
            "showItemInFolder",
        );
        const setApplicationMenuSpy = vi.spyOn(Menu, "setApplicationMenu");
        const setNameSpy = vi.spyOn(electronApp, "setName");

        appService.exit(3);
        appService.quit();
        await appService.openPath("/tmp/report.txt");
        appService.revealPath("/tmp/report.txt");
        await appService.openExternal("https://example.com");
        appService.setApplicationMenu(null);
        appService.clearApplicationMenu();
        appService.setName("New App Name");

        expect(exitSpy).toHaveBeenCalledWith(3);
        expect(electronApp.quit).toHaveBeenCalledOnce();
        expect(openPathSpy).toHaveBeenCalledWith("/tmp/report.txt");
        expect(showItemInFolderSpy).toHaveBeenCalledWith("/tmp/report.txt");
        expect(openExternalSpy).toHaveBeenCalledWith("https://example.com");
        expect(setApplicationMenuSpy).toHaveBeenNthCalledWith(1, null);
        expect(setApplicationMenuSpy).toHaveBeenNthCalledWith(2, null);
        expect(setNameSpy).toHaveBeenCalledWith("New App Name");
    });

    it("shows dialogs with the main window when available", async () => {
        const mainWindow = {};
        const { appService } = createAppServiceContext(mainWindow);
        const showMessageBox = vi.spyOn(electronMocks.dialog, "showMessageBox");
        const showOpenDialog = vi.spyOn(electronMocks.dialog, "showOpenDialog");

        showMessageBox.mockResolvedValueOnce({ response: 1 } as never);
        showOpenDialog.mockResolvedValueOnce({ canceled: false } as never);

        await expect(
            appService.showMessageBox({ message: "Hello" } as never),
        ).resolves.toEqual({ response: 1 });
        await expect(appService.showOpenDialog({} as never)).resolves.toEqual({
            canceled: false,
        });

        expect(showMessageBox).toHaveBeenCalledWith(mainWindow, {
            message: "Hello",
        });
        expect(showOpenDialog).toHaveBeenCalledWith(mainWindow, {});
    });

    it("shows dialogs without a main window when none is tracked", async () => {
        const { appService } = createAppServiceContext();
        const showMessageBox = vi.spyOn(electronMocks.dialog, "showMessageBox");
        const showOpenDialog = vi.spyOn(electronMocks.dialog, "showOpenDialog");

        showMessageBox.mockResolvedValueOnce({ response: 2 } as never);
        showOpenDialog.mockResolvedValueOnce({ canceled: true } as never);

        await expect(
            appService.showMessageBox({ title: "No window" } as never),
        ).resolves.toEqual({ response: 2 });
        await expect(
            appService.showOpenDialog({ properties: ["openFile"] } as never),
        ).resolves.toEqual({ canceled: true });

        expect(showMessageBox).toHaveBeenCalledWith({ title: "No window" });
        expect(showOpenDialog).toHaveBeenCalledWith({
            properties: ["openFile"],
        });
    });

    it("skips the title bar overlay on darwin", () => {
        electronMocks.platform.mockReturnValue("darwin");
        const mainWindow = {
            setTitleBarOverlay: vi.fn(),
        };
        const { appService } = createAppServiceContext(mainWindow);

        appService.setTheme("#111111ff", "#222222ff");

        expect(mainWindow.setTitleBarOverlay).not.toHaveBeenCalled();
    });

    it.each([
        "linux",
        "win32",
    ])("applies the title bar overlay on %s", (platform) => {
        electronMocks.platform.mockReturnValue(platform);
        const mainWindow = {
            setTitleBarOverlay: vi.fn(),
        };
        const { appService } = createAppServiceContext(mainWindow);

        appService.setTheme("#111111ff", "#222222ff");

        expect(mainWindow.setTitleBarOverlay).toHaveBeenCalledWith({
            color: "#222222ff",
            symbolColor: "#111111ff",
        });
    });
});

function createAppServiceContext(mainWindow?: object): {
    appService: ElectronAppService;
    closeBehaviorService: {
        setHideOnClose: ReturnType<typeof vi.fn>;
        getHideOnClose: ReturnType<typeof vi.fn>;
    };
} {
    const windowManager = {
        getMainWindow: vi.fn().mockReturnValue(mainWindow),
    } as unknown as WindowManagerService;
    const closeBehaviorService = {
        setHideOnClose: vi.fn(),
        getHideOnClose: vi.fn().mockReturnValue(false),
    };

    return {
        appService: new ElectronAppService(
            windowManager,
            closeBehaviorService as unknown as CloseBehaviorService,
        ),
        closeBehaviorService,
    };
}

async function withMockDock(
    run: (dock: {
        hide: ReturnType<typeof vi.fn>;
        setIcon: ReturnType<typeof vi.fn>;
        show: ReturnType<typeof vi.fn>;
    }) => void | Promise<void>,
): Promise<void> {
    const dock = {
        hide: vi.fn(),
        setIcon: vi.fn(),
        show: vi.fn().mockResolvedValue(undefined),
    };
    const dockDescriptor = Object.getOwnPropertyDescriptor(electronApp, "dock");

    Object.defineProperty(electronApp, "dock", {
        configurable: true,
        value: dock,
    });

    try {
        await run(dock);
    } finally {
        if (dockDescriptor) {
            Object.defineProperty(electronApp, "dock", dockDescriptor);
        } else {
            Reflect.deleteProperty(electronApp, "dock");
        }
    }
}
