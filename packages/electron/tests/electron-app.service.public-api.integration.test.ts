/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.resetModules();
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
    it("covers the public service methods", async () => {
        electronMocks.platform.mockReturnValue("linux");
        const { ElectronAppService } = await import(
            "../src/electron-app.service.js"
        );
        const mainWindow = {
            setTitleBarOverlay: vi.fn(),
        };
        const windowManager = {
            getMainWindow: vi.fn().mockReturnValue(mainWindow),
        };
        const closeBehaviorService = {
            getHideOnClose: vi.fn().mockReturnValue(false),
            setHideOnClose: vi.fn(),
        };
        const service = new ElectronAppService(
            windowManager as never,
            closeBehaviorService as never,
        );

        expect(service.MainWindow).toBe(mainWindow);
        expect(service.getAppPath()).toBe("/app");
        expect(service.getPreferredSystemLanguages()).toEqual(["en-US"]);
        expect(service.getLocale()).toBe("en-US");
        expect(service.getPath("logs")).toBe("/var/logs");
        service.exit(7);
        service.quit();
        service.setHideOnClose(true);
        expect(service.getHideOnClose()).toBe(false);
        service.setApplicationMenu(null);
        service.clearApplicationMenu();
        await service.openPath("/tmp/report.txt");
        service.revealPath("/tmp/report.txt");
        await service.openExternal("https://example.com");
        await service.showMessageBox({ message: "hello" } as never);
        await service.showOpenDialog({ properties: ["openFile"] } as never);
        service.hideDock();
        await service.showDock();
        service.setDockIcon("/app/icon.png");
        service.onActivate(() => undefined);
        service.offActivate(() => undefined);
        service.showMenu(
            { id: 1 } as never,
            { popup: vi.fn() } as never,
            10,
            20,
        );
        service.setName("Electron App");
        service.setTheme("#111111ff", "#222222ff");

        expect(electronMocks.app.exit).toHaveBeenCalledWith(7);
        expect(electronMocks.app.quit).toHaveBeenCalledOnce();
        expect(electronMocks.shell.openPath).toHaveBeenCalledWith(
            "/tmp/report.txt",
        );
        expect(electronMocks.shell.showItemInFolder).toHaveBeenCalledWith(
            "/tmp/report.txt",
        );
        expect(electronMocks.shell.openExternal).toHaveBeenCalledWith(
            "https://example.com",
        );
        expect(electronMocks.dialog.showMessageBox).toHaveBeenCalledWith(
            mainWindow,
            { message: "hello" },
        );
        expect(electronMocks.dialog.showOpenDialog).toHaveBeenCalledWith(
            mainWindow,
            { properties: ["openFile"] },
        );
        expect(mainWindow.setTitleBarOverlay).toHaveBeenCalledWith({
            color: "#222222ff",
            symbolColor: "#111111ff",
        });
    });

    it("skips the title bar overlay on darwin", async () => {
        electronMocks.platform.mockReturnValue("darwin");
        const { ElectronAppService } = await import(
            "../src/electron-app.service.js"
        );
        const mainWindow = {
            setTitleBarOverlay: vi.fn(),
        };
        const windowManager = {
            getMainWindow: vi.fn().mockReturnValue(mainWindow),
        };
        const closeBehaviorService = {
            getHideOnClose: vi.fn().mockReturnValue(false),
            setHideOnClose: vi.fn(),
        };
        const service = new ElectronAppService(
            windowManager as never,
            closeBehaviorService as never,
        );

        service.setTheme("#111111ff", "#222222ff");

        expect(mainWindow.setTitleBarOverlay).not.toHaveBeenCalled();
    });

    it.each([
        "linux",
        "win32",
    ])("applies the title bar overlay on %s", async (platform) => {
        electronMocks.platform.mockReturnValue(platform);
        const { ElectronAppService } = await import(
            "../src/electron-app.service.js"
        );
        const mainWindow = {
            setTitleBarOverlay: vi.fn(),
        };
        const windowManager = {
            getMainWindow: vi.fn().mockReturnValue(mainWindow),
        };
        const closeBehaviorService = {
            getHideOnClose: vi.fn().mockReturnValue(false),
            setHideOnClose: vi.fn(),
        };
        const service = new ElectronAppService(
            windowManager as never,
            closeBehaviorService as never,
        );

        service.setTheme("#111111ff", "#222222ff");

        expect(mainWindow.setTitleBarOverlay).toHaveBeenCalledWith({
            color: "#222222ff",
            symbolColor: "#111111ff",
        });
    });
});
