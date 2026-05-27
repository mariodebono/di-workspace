/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => {
    class MockBrowserWindow {
        static instances: MockBrowserWindow[] = [];

        readonly loadURL = vi.fn().mockResolvedValue(undefined);
        readonly loadFile = vi.fn().mockResolvedValue(undefined);
        readonly once = vi.fn();
        readonly close = vi.fn();
        readonly focus = vi.fn();
        readonly hide = vi.fn();
        readonly minimize = vi.fn();
        readonly restore = vi.fn();
        readonly show = vi.fn();
        readonly isDestroyed = vi.fn().mockReturnValue(false);
        readonly isMinimized = vi.fn().mockReturnValue(true);
        readonly isVisible = vi.fn().mockReturnValue(false);

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
            on: vi.fn(),
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
    electronMocks.app.on.mockClear();
    electronMocks.app.show.mockClear();
    electronMocks.app.whenReady.mockClear();
});

describe("WindowManagerService", () => {
    it("covers window creation, reuse, reveal, and cleanup", async () => {
        const { WindowManagerService } = await import(
            "../src/window-manager.js"
        );
        const logger = {
            withContext: vi.fn().mockReturnValue({
                debug: vi.fn(),
            }),
        };
        const service = new WindowManagerService(logger as never);

        const firstWindow = await service.createWindow({
            url: "#/dashboard",
            basePath: "http://localhost:3000",
        });
        const secondWindow = await service.createWindow({
            url: "https://example.com",
        });
        const mainWindow = await service.createMainWindow({
            url: "/",
            startMode: "hidden",
        });

        expect(firstWindow.loadURL).toHaveBeenCalledWith(
            "http://localhost:3000/#/dashboard",
        );
        expect(firstWindow.options).toEqual(
            expect.objectContaining({
                webPreferences: expect.objectContaining({
                    preload: expect.any(String),
                }),
            }),
        );
        expect(secondWindow.loadURL).toHaveBeenCalledWith(
            "https://example.com",
        );
        expect(mainWindow).toBeDefined();
        expect(service.createMainWindow({ url: "/other" })).resolves.toBe(
            mainWindow,
        );

        const revealed = service.revealMainWindow();
        expect(revealed).toBe(mainWindow);
        expect(mainWindow?.restore).toHaveBeenCalledOnce();
        expect(mainWindow?.show).toHaveBeenCalledOnce();
        expect(electronMocks.app.focus).toHaveBeenCalledOnce();
        if (process.platform === "darwin") {
            expect(electronMocks.app.dock.show).toHaveBeenCalledOnce();
        } else {
            expect(electronMocks.app.dock.show).not.toHaveBeenCalled();
        }

        service.closeAll();
        expect(firstWindow.close).toHaveBeenCalledOnce();
        expect(secondWindow.close).toHaveBeenCalledOnce();
    });
});
