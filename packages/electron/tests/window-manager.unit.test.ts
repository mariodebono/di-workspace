/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app as electronApp } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../di/src/logger.service.js";
import { WindowManagerService } from "../src/window-manager.js";

const electronMocks = vi.hoisted(() => {
    class MockBrowserWindow {
        static instances: MockBrowserWindow[] = [];

        readonly close = vi.fn();
        readonly focus = vi.fn();
        readonly isDestroyed = vi.fn().mockReturnValue(false);
        readonly isMinimized = vi.fn().mockReturnValue(false);
        readonly loadFile = vi.fn().mockResolvedValue(undefined);
        readonly loadURL = vi.fn().mockResolvedValue(undefined);
        readonly minimize = vi.fn();
        readonly once = vi.fn();
        readonly restore = vi.fn();
        readonly show = vi.fn();

        constructor(readonly options: object) {
            MockBrowserWindow.instances.push(this);
        }
    }

    return {
        app: {
            dock: {
                hide: vi.fn(),
                show: vi.fn(),
            },
            focus: vi.fn(),
            show: vi.fn(),
            whenReady: vi.fn().mockResolvedValue(undefined),
        },
        BrowserWindow: MockBrowserWindow,
    };
});

vi.mock("electron", () => electronMocks);

beforeEach(() => {
    electronMocks.BrowserWindow.instances.length = 0;
    electronMocks.app.dock.hide.mockClear();
    electronMocks.app.dock.show.mockClear();
    electronMocks.app.focus.mockClear();
    electronMocks.app.show.mockClear();
    electronMocks.app.whenReady.mockReset().mockResolvedValue(undefined);
});

describe("WindowManagerService", () => {
    it("loads absolute urls directly and ignores basePath", async () => {
        const basePath = vi.fn(() => "http://localhost:5123");
        const service = createWindowManager();

        const window = await service.createWindow({
            url: "https://example.com/dashboard",
            basePath,
        });

        expect(basePath).not.toHaveBeenCalled();
        expect(window.loadURL).toHaveBeenCalledWith(
            "https://example.com/dashboard",
        );
        expect(window.loadFile).not.toHaveBeenCalled();
    });

    it("injects the package preload while preserving other webPreferences", async () => {
        const service = createWindowManager();

        await service.createWindow({
            url: "https://example.com/dashboard",
            webPreferences: {
                contextIsolation: true,
                sandbox: true,
            },
        });

        const [window] = electronMocks.BrowserWindow.instances;
        expect(window?.options).toEqual(
            expect.objectContaining({
                webPreferences: expect.objectContaining({
                    contextIsolation: true,
                    sandbox: true,
                    preload: expect.any(String),
                }),
            }),
        );
    });

    it("resolves hash urls against an http basePath", async () => {
        const service = createWindowManager();

        const window = await service.createWindow({
            url: "#/",
            basePath: "http://localhost:5123",
        });

        expect(window.loadURL).toHaveBeenCalledWith("http://localhost:5123/#/");
        expect(window.loadFile).not.toHaveBeenCalled();
    });

    it("resolves hash urls against a file index basePath", async () => {
        const service = createWindowManager();

        const window = await service.createWindow({
            url: "#/",
            basePath: "file:///tmp/app/dist/renderer/index.html",
        });

        expect(window.loadURL).toHaveBeenCalledWith(
            "file:///tmp/app/dist/renderer/index.html#/",
        );
        expect(window.loadFile).not.toHaveBeenCalled();
    });

    it("loads local files when no basePath is provided", async () => {
        const service = createWindowManager();

        const window = await service.createWindow({
            url: "dist/renderer/index.html",
        });

        expect(window.loadURL).not.toHaveBeenCalled();
        expect(window.loadFile).toHaveBeenCalledWith(
            "dist/renderer/index.html",
        );
    });

    it("reveals the main window by restoring, showing, and focusing it", async () => {
        const service = createWindowManager();
        const window = await service.createMainWindow({
            url: "/",
            startMode: "hidden",
        });
        const mockedWindow = electronMocks.BrowserWindow.instances[0];
        if (!mockedWindow) {
            throw new Error("Expected mocked BrowserWindow instance");
        }

        mockedWindow.isMinimized.mockReturnValue(true);
        const revealedWindow = service.revealMainWindow();

        expect(revealedWindow).toBe(window);
        expect(mockedWindow.restore).toHaveBeenCalledOnce();
        expect(mockedWindow.show).toHaveBeenCalledOnce();
        expect(electronApp.focus).toHaveBeenCalledOnce();
        if (process.platform === "darwin") {
            expect(electronApp.show).toHaveBeenCalledOnce();
            expect(electronApp.dock?.show).toHaveBeenCalledOnce();
        }
        expect(mockedWindow.focus).toHaveBeenCalledOnce();
    });

    it("returns undefined when revealMainWindow is requested without a main window", () => {
        const service = createWindowManager();

        expect(service.revealMainWindow()).toBeUndefined();
    });

    it("reuses the existing main window instead of creating another one", async () => {
        const service = createWindowManager();

        const firstWindow = await service.createMainWindow({ url: "/" });
        const secondWindow = await service.createMainWindow({ url: "/other" });

        expect(secondWindow).toBe(firstWindow);
        expect(electronMocks.BrowserWindow.instances).toHaveLength(1);
        expect(firstWindow.loadURL).not.toHaveBeenCalled();
        expect(firstWindow.loadFile).toHaveBeenCalledTimes(1);
    });

    it("closes all tracked windows", async () => {
        const service = createWindowManager();

        const firstWindow = await service.createWindow({ url: "/" });
        const secondWindow = await service.createWindow({ url: "/settings" });

        service.closeAll();

        expect(firstWindow.close).toHaveBeenCalledOnce();
        expect(secondWindow.close).toHaveBeenCalledOnce();
    });
});

function createWindowManager(): WindowManagerService {
    const logger = {
        withContext: vi.fn().mockReturnValue({
            debug: vi.fn(),
        }),
    } as unknown as Logger;

    return new WindowManagerService(logger);
}
