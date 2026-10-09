/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import { getInjectableOptions } from "../../../tests/helpers/di.js";
import {
    BeforeAppQuit,
    BeforeMainWindowClose,
    getBeforeAppQuitGuards,
    getBeforeMainWindowCloseGuards,
    LIFECYCLE_HOOK_INJECTABLE_TAG,
    LifecycleHookOrder,
} from "../src/decorators/lifecycle-hooks.decorator.js";
import {
    createLifecycleHookRunner,
    type LifecycleInvocation,
} from "../src/lifecycle-hook-runner.js";

describe("lifecycle guards", () => {
    it("discovers both guards on the same injectable method, independently of notification hooks", () => {
        class Policy {
            @BeforeAppQuit({ priority: -5 })
            @BeforeMainWindowClose()
            allow(): boolean {
                return true;
            }
        }
        expect(getBeforeAppQuitGuards(Policy)).toEqual([
            {
                methodName: "allow",
                priority: -5,
                order: LifecycleHookOrder.Before,
            },
        ]);
        expect(getBeforeMainWindowCloseGuards(Policy)).toEqual([
            {
                methodName: "allow",
                priority: 0,
                order: LifecycleHookOrder.Before,
            },
        ]);
        expect(
            getInjectableOptions(Policy)?.tags?.filter(
                (tag) => tag === LIFECYCLE_HOOK_INJECTABLE_TAG,
            ),
        ).toHaveLength(1);
    });

    it.each([BeforeAppQuit, BeforeMainWindowClose])(
        "rejects static methods and properties",
        (decorator) => {
            class Invalid {
                static allow(): boolean {
                    return true;
                }
                value = true;
            }
            expect(() =>
                decorator()(
                    Invalid,
                    "allow",
                    Object.getOwnPropertyDescriptor(Invalid, "allow") ?? {},
                ),
            ).toThrow("cannot be applied to static methods");
            expect(() =>
                decorator()(Invalid.prototype, "value", { value: true }),
            ).toThrow("can only be applied to methods");
        },
    );

    it("awaits guards in priority and discovery order, stopping at the first veto", async () => {
        const order: string[] = [];
        const runner = createLifecycleHookRunner({ logger: () => undefined });
        const make = (
            name: string,
            priority: number,
            index: number,
            allowed: boolean,
        ): LifecycleInvocation => ({
            className: name,
            priority,
            index,
            order: LifecycleHookOrder.Before,
            methodName: "check",
            instance: {
                async check() {
                    await Promise.resolve();
                    order.push(name);
                    return allowed;
                },
            },
        });
        expect(
            await runner.runGuards(
                [
                    make("skipped", 2, 0, true),
                    make("veto", 1, 2, false),
                    make("first", -1, 3, true),
                    make("second", 1, 1, true),
                ],
                "@BeforeAppQuit",
            ),
        ).toBe(false);
        expect(order).toEqual(["first", "second", "veto"]);
        expect(await runner.runGuards([], "@BeforeMainWindowClose")).toBe(true);
    });

    it.each([
        { check: () => undefined },
        { check: () => "true" },
        {
            check: () => {
                throw new Error("failed");
            },
        },
        { check: () => Promise.reject(new Error("failed")) },
        {},
    ])(
        "logs failures and cancels instead of allowing an invalid guard",
        async (instance) => {
            const error = vi.fn();
            const next = vi.fn(() => true);
            const runner = createLifecycleHookRunner({
                logger: () => ({ error }),
            });
            const invocation: LifecycleInvocation = {
                instance,
                className: "Policy",
                methodName: "check",
                index: 0,
                priority: 0,
                order: LifecycleHookOrder.Before,
            };
            expect(
                await runner.runGuards(
                    [
                        invocation,
                        { ...invocation, instance: { check: next }, index: 1 },
                    ],
                    "@BeforeAppQuit",
                ),
            ).toBe(false);
            expect(error).toHaveBeenCalledWith(
                "@BeforeAppQuit handler failed: Policy.check",
                expect.any(Error),
            );
            expect(next).not.toHaveBeenCalled();
        },
    );
});
