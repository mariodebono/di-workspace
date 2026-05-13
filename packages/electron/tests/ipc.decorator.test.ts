/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { metadataKeys } from "@mariodebono/di";
import { describe, expect, it } from "vitest";
import {
    BridgeController,
    CONTROLLER_INJECTABLE_TAG,
    CONTROLLER_METADATA_KEY,
    CONTROLLER_NAMESPACE_METADATA_KEY,
    createIpcHandleTyped,
    IPC_HANDLER_METADATA_KEY,
    IpcHandle,
    IpcHandleTyped,
} from "../src/decorators/ipc.decorator.js";

describe("IPC decorators", () => {
    it("tags bridge controllers for discovery and stores the namespace", () => {
        @BridgeController({ namespace: "test" })
        class TestController {}

        const options = Reflect.getMetadata(
            metadataKeys.injectableOptions,
            TestController,
        ) as { tags?: (string | symbol)[] } | undefined;

        expect(options?.tags).toContain(CONTROLLER_INJECTABLE_TAG);
        expect(
            Reflect.getMetadata(CONTROLLER_METADATA_KEY, TestController),
        ).toEqual({ namespace: "test" });
        expect(
            Reflect.getMetadata(
                CONTROLLER_NAMESPACE_METADATA_KEY,
                TestController,
            ),
        ).toBe("test");
    });

    it("stores handler metadata for direct and typed decorators", () => {
        type TestBridge = {
            ping(): Promise<string>;
            pong(value: string): Promise<void>;
        };
        const handleForBridge = createIpcHandleTyped<TestBridge>();

        class TestController {
            ping(): Promise<string> {
                return Promise.resolve("pong");
            }

            pong(_value: string): Promise<void> {
                return Promise.resolve();
            }

            status(): string {
                return "ok";
            }
        }

        applyDecorator(
            TestController.prototype,
            "ping",
            IpcHandleTyped<TestBridge, "ping">("ping"),
        );
        applyDecorator(
            TestController.prototype,
            "pong",
            handleForBridge("pong"),
        );
        applyDecorator(
            TestController.prototype,
            "status",
            IpcHandle("system:status"),
        );

        expect(
            Reflect.getMetadata(
                IPC_HANDLER_METADATA_KEY,
                TestController,
            ) as unknown[],
        ).toEqual([
            {
                channel: "ping",
                methodName: "ping",
                useControllerNamespace: true,
            },
            {
                channel: "pong",
                methodName: "pong",
                useControllerNamespace: true,
            },
            {
                channel: "system:status",
                methodName: "status",
                useControllerNamespace: false,
            },
        ]);
    });

    it("rejects non-method targets", () => {
        class InvalidController {
            value = 1;
        }

        expect(() =>
            IpcHandle("invalid")(
                InvalidController.prototype,
                "value",
                {} as PropertyDescriptor,
            ),
        ).toThrow("@IpcHandle can only be applied to methods");
    });

    it("rejects empty bridge namespaces", () => {
        expect(() =>
            BridgeController({ namespace: "" })(class TestController {}),
        ).toThrow("@BridgeController requires a non-empty namespace");
    });
});

function applyDecorator(
    target: object,
    methodName: string,
    decorator: MethodDecorator,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    decorator(target, methodName, descriptor);
}
