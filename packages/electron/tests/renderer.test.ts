/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import { IpcError } from "../src/ipc-error.js";
import {
    createRendererBridge,
    createRendererEvents,
} from "../src/renderer/index.js";

describe("renderer bridge", () => {
    it("maps nested property access to invoke channels and unwraps data", async () => {
        const invoke = vi.fn().mockResolvedValue({
            success: true,
            data: ["project-a", "project-b"],
        });
        const api = createRendererBridge<{
            projects: {
                list(): Promise<string[]>;
            };
        }>({
            invoke,
            on: vi.fn(),
            off: vi.fn(),
        });

        await expect(api.projects.list()).resolves.toEqual([
            "project-a",
            "project-b",
        ]);
        expect(invoke).toHaveBeenCalledWith("projects.list");
    });

    it("throws client IPC errors when the bridge returns an error response", async () => {
        const api = createRendererBridge<{
            projects: {
                remove(id: string): Promise<void>;
            };
        }>({
            invoke: vi.fn().mockResolvedValue({
                success: false,
                error: {
                    type: "projects.not_found",
                    message: "Project not found",
                },
            }),
            on: vi.fn(),
            off: vi.fn(),
        });

        await expect(api.projects.remove("project-1")).rejects.toBeInstanceOf(
            IpcError,
        );
    });

    it("delegates event helpers to the provided transport", () => {
        const transport = {
            invoke: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        };
        const events = createRendererEvents(transport);
        const listener = vi.fn();

        events.on("projects.updated", listener);
        events.off("projects.updated", listener);

        expect(transport.on).toHaveBeenCalledWith("projects.updated", listener);
        expect(transport.off).toHaveBeenCalledWith(
            "projects.updated",
            listener,
        );
    });
});
