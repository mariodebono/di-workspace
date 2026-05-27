/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app as electronApp } from "electron/main";
import { describe, expect, it, vi } from "vitest";

const diCoreMocks = vi.hoisted(() => ({
    createApplication: vi.fn(),
}));

const electronLogMocks = vi.hoisted(() => ({
    create: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        initialize: vi.fn(),
        setLogLevels: vi.fn(),
        transports: {
            console: {},
            file: {
                setAppName: vi.fn(),
            },
        },
        warn: vi.fn(),
    })),
}));

vi.mock("electron/main", () => ({
    app: {
        exit: vi.fn(),
        on: vi.fn(),
        requestSingleInstanceLock: vi.fn().mockReturnValue(false),
        whenReady: vi.fn(),
    },
    Menu: {
        buildFromTemplate: vi.fn().mockReturnValue({ items: [] }),
        setApplicationMenu: vi.fn(),
    },
}));

vi.mock("electron", () => ({
    app: {
        dock: {
            hide: vi.fn(),
            show: vi.fn().mockResolvedValue(undefined),
        },
        focus: vi.fn(),
        whenReady: vi.fn().mockResolvedValue(undefined),
    },
    BrowserWindow: class BrowserWindow {},
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
}));

vi.mock("@mariodebono/di", async () => {
    const actual =
        await vi.importActual<typeof import("@mariodebono/di")>(
            "@mariodebono/di",
        );

    return {
        ...actual,
        createApplication: diCoreMocks.createApplication,
    };
});
vi.mock("electron-log", () => ({
    default: {
        create: electronLogMocks.create,
    },
}));

describe("application bootstrap", () => {
    it("covers the default menu and single-instance redirect branch", async () => {
        const { createDefaultApplicationMenu, createElectronApplication } =
            await import("../src/application.js");

        const defaultMenu = createDefaultApplicationMenu("darwin");
        const otherMenu = createDefaultApplicationMenu("win32");

        expect(defaultMenu).toBeDefined();
        expect(otherMenu).toBeNull();

        class EntryModule {}

        const result = await createElectronApplication(EntryModule, {
            instanceMode: "single",
        });

        expect(result).toEqual({ status: "redirected" });
    });

    it("covers the bootstrap happy path with an empty application", async () => {
        electronApp.requestSingleInstanceLock.mockReturnValue(true);
        electronApp.whenReady.mockResolvedValue(undefined);

        const windowManager = {
            createMainWindow: vi.fn().mockResolvedValue({
                hide: vi.fn(),
                on: vi.fn(),
            }),
        };
        const closeBehaviorService = {
            getHideOnClose: vi.fn().mockReturnValue(false),
            setHideOnClose: vi.fn(),
        };
        const logger = {
            withContext: vi.fn().mockReturnThis(),
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        };
        const application = {
            destroy: vi.fn(),
            destroyAsync: vi.fn().mockResolvedValue(undefined),
            findByTag: vi.fn().mockReturnValue([]),
            get: vi.fn((token: unknown) => {
                const tokenName =
                    typeof token === "function" ? token.name : String(token);
                if (tokenName === "Logger") {
                    return logger;
                }
                if (tokenName === "WindowManagerService") {
                    return windowManager;
                }
                if (tokenName === "CloseBehaviorService") {
                    return closeBehaviorService;
                }

                return undefined;
            }),
        };

        diCoreMocks.createApplication.mockResolvedValueOnce(application);
        const { createElectronApplication } = await import(
            "../src/application.js"
        );

        const result = await createElectronApplication(class EntryModule {}, {
            logger: logger as never,
        });

        expect(result.status).toBe("started");
        const passedOptions = diCoreMocks.createApplication.mock
            .calls[0]?.[1] as { logger?: unknown } | undefined;
        expect(passedOptions?.logger).toEqual(
            expect.objectContaining({
                debug: expect.any(Function),
                error: expect.any(Function),
                warn: expect.any(Function),
            }),
        );
        await result.application.destroyAsync();
    });
});
