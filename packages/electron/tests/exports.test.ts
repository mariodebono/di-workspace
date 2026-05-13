/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
    app: {
        dock: {
            hide: vi.fn(),
            setIcon: vi.fn(),
            show: vi.fn(),
        },
        exit: vi.fn(),
        focus: vi.fn(),
        getAppPath: vi.fn(),
        getLocale: vi.fn(),
        getPath: vi.fn(),
        getPreferredSystemLanguages: vi.fn(),
        on: vi.fn(),
        quit: vi.fn(),
        releaseSingleInstanceLock: vi.fn(),
        removeListener: vi.fn(),
        requestSingleInstanceLock: vi.fn(),
        setName: vi.fn(),
        show: vi.fn(),
        whenReady: vi.fn(),
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
    electronLog: {
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
    shell: {
        openExternal: vi.fn(),
        openPath: vi.fn(),
        showItemInFolder: vi.fn(),
    },
}));

vi.mock("electron/main", () => ({
    app: runtimeMocks.app,
    BrowserWindow: runtimeMocks.BrowserWindow,
    Menu: runtimeMocks.Menu,
}));

vi.mock("electron", () => ({
    app: runtimeMocks.app,
    BrowserWindow: runtimeMocks.BrowserWindow,
    dialog: runtimeMocks.dialog,
    Menu: runtimeMocks.Menu,
    shell: runtimeMocks.shell,
}));

vi.mock("electron-log", () => ({
    default: runtimeMocks.electronLog,
}));

describe("package exports", () => {
    it("re-exports the public decorators barrel", async () => {
        const decoratorsIndex = await import("../src/decorators/index.js");
        const ipcDecorators = await import(
            "../src/decorators/ipc.decorator.js"
        );
        const appLaunchDecorators = await import(
            "../src/decorators/app-launch.decorator.js"
        );

        expect(decoratorsIndex.IpcHandle).toBe(ipcDecorators.IpcHandle);
        expect(decoratorsIndex.BridgeController).toBe(
            ipcDecorators.BridgeController,
        );
        expect(decoratorsIndex.OnAppLaunch).toBe(
            appLaunchDecorators.OnAppLaunch,
        );
    });

    it("re-exports the public package entry points", async () => {
        const indexModule = await import("../src/index.js");
        const applicationModule = await import("../src/application.js");
        const loggerModule = await import("../src/electron-logger.js");
        const ipcErrorModule = await import("../src/ipc-error.js");
        const moduleModule = await import("../src/module.js");
        const rendererModule = await import("../src/renderer/index.js");

        expect(indexModule.createElectronApplication).toBe(
            applicationModule.createElectronApplication,
        );
        expect(indexModule.ElectronLogger).toBe(loggerModule.ElectronLogger);
        expect(indexModule.createElectronLogger).toBe(
            loggerModule.createElectronLogger,
        );
        expect(indexModule.IpcError).toBe(ipcErrorModule.IpcError);
        expect(moduleModule.ElectronModule).toBeDefined();
        expect(moduleModule.ELECTRON_MODULE_OPTIONS).toBeTypeOf("symbol");
        expect(indexModule).not.toHaveProperty("createRendererBridge");
        expect(rendererModule.createRendererBridge).toBeTypeOf("function");
        expect(rendererModule.createRendererEvents).toBeTypeOf("function");
    });
});
