/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
    contextBridge: {
        exposeInMainWorld: vi.fn(),
    },
    ipcRenderer: {
        invoke: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
    },
}));

vi.mock("electron", () => electronMocks);

describe("preload bridge", () => {
    beforeEach(() => {
        vi.resetModules();
        electronMocks.contextBridge.exposeInMainWorld.mockReset();
        electronMocks.ipcRenderer.invoke.mockReset();
        electronMocks.ipcRenderer.on.mockReset();
        electronMocks.ipcRenderer.removeListener.mockReset();
    });

    it("exposes a narrow IPC transport and routes on/off listeners", async () => {
        await import("../src/preload.js");

        const [, bridge] =
            electronMocks.contextBridge.exposeInMainWorld.mock.calls[0] ?? [];

        expect(bridge).toEqual(
            expect.objectContaining({
                invoke: expect.any(Function),
                on: expect.any(Function),
                off: expect.any(Function),
            }),
        );

        const listener = vi.fn();
        bridge.on("projects.updated", listener);

        const wrappedListener =
            electronMocks.ipcRenderer.on.mock.calls[0]?.[1] ?? undefined;
        expect(electronMocks.ipcRenderer.on).toHaveBeenCalledWith(
            "projects.updated",
            expect.any(Function),
        );

        wrappedListener({}, "payload");
        expect(listener).toHaveBeenCalledWith("payload");

        bridge.off("projects.updated", listener);
        expect(electronMocks.ipcRenderer.removeListener).toHaveBeenCalledWith(
            "projects.updated",
            wrappedListener,
        );
    });
});
