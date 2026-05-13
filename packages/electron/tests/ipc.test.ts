/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { handle } = vi.hoisted(() => ({
    handle: vi.fn(),
}));

vi.mock("electron", () => ({
    ipcMain: {
        handle,
    },
}));

describe("registerIpcControllers", () => {
    beforeEach(() => {
        vi.resetModules();
        handle.mockReset();
    });

    it("wraps handler results in successful bridge responses", async () => {
        const { IpcHandle, registerIpcControllers } = await import(
            "../src/ipc.js"
        );
        const { BridgeController } = await import(
            "../src/decorators/ipc.decorator.js"
        );

        @BridgeController({ namespace: "test" })
        class TestController {
            async ping(): Promise<{ ok: true }> {
                return { ok: true };
            }
        }
        applyIpcHandle(
            TestController.prototype,
            "ping",
            "test:ping",
            IpcHandle,
        );

        registerIpcControllers([TestController], {
            get: () => new TestController(),
        } as never);

        const handler = handle.mock.calls[0]?.[1] as
            | ((event: unknown) => Promise<unknown>)
            | undefined;

        expect(handler).toBeDefined();
        expect(await handler?.({})).toEqual({
            success: true,
            data: { ok: true },
        });
    });

    it("serializes thrown errors as bridge error dto payloads", async () => {
        const { IpcHandle, registerIpcControllers } = await import(
            "../src/ipc.js"
        );
        const { IpcError } = await import("../src/ipc-error.js");
        const { BridgeController } = await import(
            "../src/decorators/ipc.decorator.js"
        );

        class TestIpcError extends IpcError {
            constructor() {
                super("projects.list_failed", "Translated failure");
            }

            override toJson() {
                return {
                    ...super.toJson(),
                    key: "projects:errors.launch",
                    params: {
                        workspaceId: "default",
                    },
                    details: {
                        projectId: "project-1",
                    },
                };
            }
        }

        @BridgeController({ namespace: "test" })
        class TestController {
            async fail(): Promise<void> {
                throw new TestIpcError();
            }
        }
        applyIpcHandle(
            TestController.prototype,
            "fail",
            "test:fail",
            IpcHandle,
        );

        registerIpcControllers([TestController], {
            get: () => new TestController(),
        } as never);

        const handler = handle.mock.calls[0]?.[1] as
            | ((event: unknown) => Promise<unknown>)
            | undefined;

        expect(handler).toBeDefined();
        expect(await handler?.({})).toEqual({
            success: false,
            error: {
                type: "projects.list_failed",
                message: "Translated failure",
                key: "projects:errors.launch",
                params: {
                    workspaceId: "default",
                },
                details: {
                    projectId: "project-1",
                },
            },
        });
    });

    it("serializes plain errors into the base ipc error shape", async () => {
        const { IpcHandle, registerIpcControllers } = await import(
            "../src/ipc.js"
        );
        const { BridgeController } = await import(
            "../src/decorators/ipc.decorator.js"
        );

        @BridgeController({ namespace: "test" })
        class TestController {
            async fail(): Promise<void> {
                throw new TypeError("Broken handler");
            }
        }

        applyIpcHandle(
            TestController.prototype,
            "fail",
            "test:fail",
            IpcHandle,
        );

        registerIpcControllers([TestController], {
            get: () => new TestController(),
        } as never);

        const handler = handle.mock.calls[0]?.[1] as
            | ((event: unknown) => Promise<unknown>)
            | undefined;

        expect(handler).toBeDefined();
        expect(await handler?.({})).toEqual({
            success: false,
            error: {
                type: "TypeError",
                message: "Broken handler",
            },
        });
    });

    it("ignores controller tokens without ipc handlers", async () => {
        const { registerIpcControllers } = await import("../src/ipc.js");
        const { BridgeController } = await import(
            "../src/decorators/ipc.decorator.js"
        );

        @BridgeController({ namespace: "test" })
        class NoHandlersController {
            ping(): string {
                return "pong";
            }
        }

        registerIpcControllers([NoHandlersController], {
            get: vi.fn(),
        } as never);

        expect(handle).not.toHaveBeenCalled();
    });

    it("prefixes namespaced typed handlers with the controller namespace", async () => {
        const { IpcHandleTyped, registerIpcControllers } = await import(
            "../src/ipc.js"
        );
        const { BridgeController } = await import(
            "../src/decorators/ipc.decorator.js"
        );

        type TestBridge = {
            ping(): Promise<string>;
        };

        @BridgeController({ namespace: "projects" })
        class TestController {
            async ping(): Promise<string> {
                return "pong";
            }
        }

        applyIpcHandle(
            TestController.prototype,
            "ping",
            "ping",
            IpcHandleTyped<TestBridge, "ping">,
        );

        registerIpcControllers([TestController], {
            get: () => new TestController(),
        } as never);

        expect(handle).toHaveBeenCalledWith(
            "projects.ping",
            expect.any(Function),
        );
    });
});

function applyIpcHandle(
    target: object,
    methodName: string,
    channel: string,
    decorator: (channel: never) => MethodDecorator,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    decorator(channel as never)(target, methodName, descriptor);
}
