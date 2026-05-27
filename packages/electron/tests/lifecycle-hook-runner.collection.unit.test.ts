/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import {
    AppReady,
    AppReadyOrder,
} from "../src/decorators/app-ready.decorator.js";
import {
    LifecycleHookOrder,
    OnAppQuit,
} from "../src/decorators/lifecycle-hooks.decorator.js";

describe("lifecycle-hook-runner collection", () => {
    it("collects app-ready and app-quit invocations by metadata", async () => {
        const { getAppQuitHooks } = await import(
            "../src/decorators/lifecycle-hooks.decorator.js"
        );
        const { createLifecycleHookRunner } = await import(
            "../src/lifecycle-hook-runner.js"
        );

        class ReadyHandler {
            run(): void {}
        }
        applyDecorator(ReadyHandler.prototype, "run", AppReady, {
            order: AppReadyOrder.BeforeWindow,
            priority: 2,
        });

        class QuitHandler {
            beforeQuit(): void {}
        }
        applyDecorator(QuitHandler.prototype, "beforeQuit", OnAppQuit, {
            order: LifecycleHookOrder.Before,
            priority: 1,
        });

        const readyInstance = new ReadyHandler();
        const quitInstance = new QuitHandler();
        const application = {
            findByTag: vi.fn((tag: symbol) => {
                if (tag.description === "platform:electron:app-ready") {
                    return [ReadyHandler, "skip"];
                }

                if (tag.description === "platform:electron:lifecycle-hook") {
                    return [QuitHandler, "skip"];
                }

                return [];
            }),
            get: vi.fn((token: unknown) => {
                if (token === ReadyHandler) {
                    return readyInstance;
                }

                if (token === QuitHandler) {
                    return quitInstance;
                }

                return undefined;
            }),
        };

        const runner = createLifecycleHookRunner({
            logger: () => undefined,
        });

        const appReadyInvocations = runner.collectAppReadyInvocations(
            application as never,
        );
        const lifecycleInvocations = runner.collectLifecycleInvocations(
            application as never,
            getAppQuitHooks,
        );

        expect(appReadyInvocations).toEqual([
            {
                className: "ReadyHandler",
                index: 0,
                instance: readyInstance,
                methodName: "run",
                order: AppReadyOrder.BeforeWindow,
                priority: 2,
            },
        ]);
        expect(lifecycleInvocations).toEqual([
            {
                className: "QuitHandler",
                index: 0,
                instance: quitInstance,
                methodName: "beforeQuit",
                order: LifecycleHookOrder.Before,
                priority: 1,
            },
        ]);
    });
});

function applyDecorator<T extends object, Options>(
    target: T,
    methodName: keyof T,
    decorator: (options?: Options) => MethodDecorator,
    options?: Options,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(
        target,
        methodName as string,
    );
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${String(methodName)}`);
    }

    decorator(options)(target, methodName as string, descriptor);
}
