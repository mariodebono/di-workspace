/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import { OnAppLaunch } from "../src/decorators/app-launch.decorator.js";

const electronMocks = vi.hoisted(() => {
    let secondInstanceListener:
        | ((
              event: Electron.Event,
              argv: string[],
              workingDirectory: string,
              additionalData: unknown,
          ) => void)
        | undefined;

    return {
        app: {
            on: vi.fn((event, listener) => {
                if (event === "second-instance") {
                    secondInstanceListener =
                        listener as typeof secondInstanceListener;
                }
            }),
            releaseSingleInstanceLock: vi.fn(),
            removeListener: vi.fn(),
        },
        getSecondInstanceListener: () => secondInstanceListener,
    };
});

vi.mock("electron/main", () => electronMocks);

describe("app-launch-runner", () => {
    it("covers collection, queueing, dispatch, and cleanup", async () => {
        const { createAppLaunchCoordinator, collectAppLaunchInvocations } =
            await import("../src/app-launch-runner.js");
        const error = vi.fn();
        const execution: string[] = [];

        class CollectedLaunchHandler {
            onLaunch(): void {
                execution.push("collected");
            }
        }
        applyOnAppLaunch(
            CollectedLaunchHandler.prototype,
            "onLaunch",
            OnAppLaunch,
            {
                priority: 3,
            },
        );

        const collectedApplication = {
            findByTag: vi
                .fn()
                .mockReturnValue([CollectedLaunchHandler, "skip"]),
            get: vi.fn(() => new CollectedLaunchHandler()),
        };
        const collectedInvocations = collectAppLaunchInvocations(
            collectedApplication as never,
        );

        expect(collectedInvocations).toEqual([
            {
                className: "CollectedLaunchHandler",
                index: 0,
                instance: expect.any(CollectedLaunchHandler),
                methodName: "onLaunch",
                priority: 3,
            },
        ]);

        class FirstLaunchHandler {
            onLaunch(context: { kind: string }): void {
                execution.push(`first:${context.kind}`);
            }
        }
        applyOnAppLaunch(
            FirstLaunchHandler.prototype,
            "onLaunch",
            OnAppLaunch,
            {
                priority: -1,
            },
        );

        class ThrowingLaunchHandler {
            onLaunch(context: { kind: string }): void {
                execution.push(`throw:${context.kind}`);
                throw new Error("boom");
            }
        }
        applyOnAppLaunch(
            ThrowingLaunchHandler.prototype,
            "onLaunch",
            OnAppLaunch,
            {
                priority: 0,
            },
        );

        class LastLaunchHandler {
            onLaunch(context: { kind: string }): void {
                execution.push(`last:${context.kind}`);
            }
        }
        applyOnAppLaunch(LastLaunchHandler.prototype, "onLaunch", OnAppLaunch, {
            priority: 10,
        });

        const first = new FirstLaunchHandler();
        const throwing = new ThrowingLaunchHandler();
        const last = new LastLaunchHandler();
        const coordinator = createAppLaunchCoordinator({
            instanceMode: "single",
            logger: () => ({ error }),
        });

        coordinator.activate();
        coordinator.setInvocations([
            {
                className: "BrokenLaunchHandler",
                index: 0,
                instance: {},
                methodName: "missing",
                priority: 0,
            },
            {
                className: "FirstLaunchHandler",
                index: 1,
                instance: first,
                methodName: "onLaunch",
                priority: -1,
            },
            {
                className: "ThrowingLaunchHandler",
                index: 2,
                instance: throwing,
                methodName: "onLaunch",
                priority: 0,
            },
            {
                className: "LastLaunchHandler",
                index: 3,
                instance: last,
                methodName: "onLaunch",
                priority: 10,
            },
        ]);

        electronMocks.getSecondInstanceListener()?.(
            {} as Electron.Event,
            ["electron", "app", "--open"],
            "/tmp/app",
            { source: "test" },
        );

        await coordinator.dispatchInitialLaunch();
        coordinator.cleanup();

        expect(execution).toEqual([
            "first:initial",
            "throw:initial",
            "last:initial",
            "first:second-instance",
            "throw:second-instance",
            "last:second-instance",
        ]);
        expect(error).toHaveBeenCalled();
        expect(electronMocks.app.on).toHaveBeenCalledWith(
            "second-instance",
            expect.any(Function),
        );
        expect(electronMocks.app.removeListener).toHaveBeenCalledWith(
            "second-instance",
            expect.any(Function),
        );
        expect(
            electronMocks.app.releaseSingleInstanceLock,
        ).toHaveBeenCalledOnce();
    });
});

function applyOnAppLaunch(
    target: object,
    methodName: string,
    decorator: (options?: { priority?: number }) => MethodDecorator,
    options?: { priority?: number },
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    decorator(options)(target, methodName, descriptor);
}
