/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import { AppReadyOrder } from "../src/decorators/app-ready.decorator.js";
import { LifecycleHookOrder } from "../src/decorators/lifecycle-hooks.decorator.js";

describe("lifecycle-hook-runner execution", () => {
    it("runs app-ready and lifecycle hooks in order and continues on failures", async () => {
        const { createLifecycleHookRunner } = await import(
            "../src/lifecycle-hook-runner.js"
        );
        const execution: string[] = [];
        const error = vi.fn();

        const runner = createLifecycleHookRunner({
            logger: () => ({ error }),
        });

        const appReadyInvocations = [
            {
                className: "BeforeOne",
                index: 0,
                instance: {
                    run(): void {
                        execution.push("before:one");
                    },
                },
                methodName: "run",
                order: AppReadyOrder.BeforeWindow,
                priority: 1,
            },
            {
                className: "BeforeTwo",
                index: 1,
                instance: {
                    run(): void {
                        execution.push("before:two");
                    },
                },
                methodName: "run",
                order: AppReadyOrder.BeforeWindow,
                priority: 1,
            },
            {
                className: "BeforeThree",
                index: 2,
                instance: {
                    run(): void {
                        execution.push("before:three");
                    },
                },
                methodName: "run",
                order: AppReadyOrder.BeforeWindow,
                priority: 2,
            },
            {
                className: "AfterFailure",
                index: 3,
                instance: {
                    run(): void {
                        execution.push("after:failure");
                        throw new Error("boom");
                    },
                },
                methodName: "run",
                order: AppReadyOrder.AfterWindow,
                priority: 0,
            },
            {
                className: "AfterDefault",
                index: 4,
                instance: {
                    run(): void {
                        execution.push("after:default");
                    },
                },
                methodName: "run",
                order: AppReadyOrder.AfterWindow,
                priority: 1,
            },
        ];

        await runner.runAppReadyHandlers(
            appReadyInvocations,
            AppReadyOrder.BeforeWindow,
        );
        await runner.runAppReadyHandlers(
            appReadyInvocations,
            AppReadyOrder.AfterWindow,
        );
        await runner.runAppQuitHooks(
            [
                {
                    className: "QuitInvalid",
                    index: 0,
                    instance: {},
                    methodName: "missing",
                    order: LifecycleHookOrder.Before,
                    priority: 0,
                },
                {
                    className: "QuitHandler",
                    index: 1,
                    instance: {
                        beforeQuit(): void {
                            execution.push("quit-before");
                        },
                    },
                    methodName: "beforeQuit",
                    order: LifecycleHookOrder.Before,
                    priority: 1,
                },
            ],
            LifecycleHookOrder.Before,
        );
        await runner.runMainWindowCloseHooks(
            [
                {
                    className: "CloseHandler",
                    index: 0,
                    instance: {
                        beforeClose(): void {
                            execution.push("close-before");
                        },
                    },
                    methodName: "beforeClose",
                    order: LifecycleHookOrder.Before,
                    priority: 0,
                },
            ],
            LifecycleHookOrder.Before,
        );
        await runner.runMainWindowFocusHooks(
            [
                {
                    className: "FocusHandler",
                    index: 0,
                    instance: {
                        afterFocus(): void {
                            execution.push("focus-after");
                        },
                    },
                    methodName: "afterFocus",
                    order: LifecycleHookOrder.After,
                    priority: 0,
                },
            ],
            LifecycleHookOrder.After,
        );
        await runner.runMainWindowBlurHooks(
            [
                {
                    className: "BlurHandler",
                    index: 0,
                    instance: {
                        afterBlur(): void {
                            execution.push("blur-after");
                        },
                    },
                    methodName: "afterBlur",
                    order: LifecycleHookOrder.After,
                    priority: 0,
                },
            ],
            LifecycleHookOrder.After,
        );
        await runner.runMainWindowShowHooks(
            [
                {
                    className: "ShowHandler",
                    index: 0,
                    instance: {
                        afterShow(): void {
                            execution.push("show-after");
                        },
                    },
                    methodName: "afterShow",
                    order: LifecycleHookOrder.After,
                    priority: 0,
                },
            ],
            LifecycleHookOrder.After,
        );

        expect(execution).toEqual([
            "before:one",
            "before:two",
            "before:three",
            "after:failure",
            "after:default",
            "quit-before",
            "close-before",
            "focus-after",
            "blur-after",
            "show-after",
        ]);
        expect(error).toHaveBeenCalled();
    });
});
