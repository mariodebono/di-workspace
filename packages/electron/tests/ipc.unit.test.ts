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
const allowAllIpcEvents = vi.fn().mockResolvedValue(undefined);

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

        registerIpcControllers(
            [TestController],
            {
                get: () => new TestController(),
            } as never,
            allowAllIpcEvents,
        );

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

        registerIpcControllers(
            [TestController],
            {
                get: () => new TestController(),
            } as never,
            allowAllIpcEvents,
        );

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

        registerIpcControllers(
            [TestController],
            {
                get: () => new TestController(),
            } as never,
            allowAllIpcEvents,
        );

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

        registerIpcControllers(
            [NoHandlersController],
            {
                get: vi.fn(),
            } as never,
            allowAllIpcEvents,
        );

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

        registerIpcControllers(
            [TestController],
            {
                get: () => new TestController(),
            } as never,
            allowAllIpcEvents,
        );

        expect(handle).toHaveBeenCalledWith(
            "projects.ping",
            expect.any(Function),
        );
    });

    it("validates IPC events before invoking controller handlers", async () => {
        const {
            createIpcEventValidator,
            IpcHandleTyped,
            registerIpcControllers,
        } = await import("../src/ipc.js");
        const { BridgeController } = await import(
            "../src/decorators/ipc.decorator.js"
        );
        const ping = vi.fn().mockResolvedValue("pong");
        const isTrustedIpcSender = vi.fn().mockReturnValue(true);
        const additionalValidator = vi.fn().mockResolvedValue(undefined);
        const validateEvent = createIpcEventValidator(
            { isTrustedIpcSender } as never,
            additionalValidator,
        );

        type TestBridge = {
            ping(): Promise<string>;
        };

        @BridgeController({ namespace: "projects" })
        class TestController {
            async ping(): Promise<string> {
                return await ping();
            }
        }

        applyIpcHandle(
            TestController.prototype,
            "ping",
            "ping",
            IpcHandleTyped<TestBridge, "ping">,
        );

        registerIpcControllers(
            [TestController],
            {
                get: () => new TestController(),
            } as never,
            validateEvent,
        );

        const handler = handle.mock.calls[0]?.[1] as
            | ((event: unknown) => Promise<unknown>)
            | undefined;
        const senderFrame = { url: "file:///app/index.html" };
        const sender = { mainFrame: senderFrame };
        const event = { sender, senderFrame };

        await expect(handler?.(event)).resolves.toEqual({
            success: true,
            data: "pong",
        });
        expect(isTrustedIpcSender).toHaveBeenCalledWith(sender, senderFrame);
        expect(additionalValidator).toHaveBeenCalledWith(
            event,
            "projects.ping",
        );
        expect(ping).toHaveBeenCalledOnce();
    });

    it("serializes IPC validation failures without invoking the controller", async () => {
        const {
            createIpcEventValidator,
            IpcHandleTyped,
            registerIpcControllers,
        } = await import("../src/ipc.js");
        const { BridgeController } = await import(
            "../src/decorators/ipc.decorator.js"
        );
        const ping = vi.fn().mockResolvedValue("pong");

        type TestBridge = {
            ping(): Promise<string>;
        };

        @BridgeController({ namespace: "projects" })
        class TestController {
            async ping(): Promise<string> {
                return await ping();
            }
        }

        applyIpcHandle(
            TestController.prototype,
            "ping",
            "ping",
            IpcHandleTyped<TestBridge, "ping">,
        );
        const additionalValidator = vi.fn();

        registerIpcControllers(
            [TestController],
            {
                get: () => new TestController(),
            } as never,
            createIpcEventValidator(
                {
                    isTrustedIpcSender: vi.fn().mockReturnValue(false),
                } as never,
                additionalValidator,
            ),
        );

        const handler = handle.mock.calls[0]?.[1] as
            | ((event: unknown) => Promise<unknown>)
            | undefined;

        await expect(handler?.({})).resolves.toEqual({
            success: false,
            error: {
                type: "electron.invalid_ipc_sender",
                message: "Invalid IPC sender",
            },
        });
        expect(additionalValidator).not.toHaveBeenCalled();
        expect(ping).not.toHaveBeenCalled();
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
