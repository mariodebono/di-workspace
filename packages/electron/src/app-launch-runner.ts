/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import type { Application, Logger } from "@mariodebono/di";
import { app } from "electron/main";
import {
    APP_LAUNCH_INJECTABLE_TAG,
    type AppLaunchContext,
    getAppLaunchHandlers,
} from "./decorators/app-launch.decorator.js";

/** Describes a single app-launch handler invocation discovered from metadata. */
export interface AppLaunchInvocation {
    className: string;
    index: number;
    instance: object;
    methodName: string | symbol;
    priority: number;
}

/**
 * Launch handler discovery and dispatch options.
 */
interface AppLaunchCoordinatorOptions {
    instanceMode: "multi" | "single";
    logger: () => Logger | undefined;
}

interface AppLaunchCoordinator {
    activate(): void;
    cleanup(): void;
    dispatchInitialLaunch(): Promise<void>;
    setInvocations(invocations: AppLaunchInvocation[]): void;
}

/**
 * Creates the runtime responsible for registering and dispatching app-launch handlers.
 * It buffers second-instance launches until the initial launch has completed.
 *
 * @param {AppLaunchCoordinatorOptions} options - Launch coordinator configuration.
 */
export function createAppLaunchCoordinator(
    options: AppLaunchCoordinatorOptions,
): AppLaunchCoordinator {
    let appLaunchInvocations: AppLaunchInvocation[] = [];
    let isLaunchDispatchReady = false;
    let isFlushingLaunchQueue = false;
    const pendingLaunches: AppLaunchContext[] = [];

    // Run the current launch context through the discovered handlers in priority order.
    const dispatchLaunch = async (context: AppLaunchContext): Promise<void> => {
        const handlers = [...appLaunchInvocations].sort(
            (left, right) =>
                left.priority - right.priority || left.index - right.index,
        );

        for (const handler of handlers) {
            const method = Reflect.get(handler.instance, handler.methodName);
            if (typeof method !== "function") {
                options
                    .logger()
                    ?.error?.(
                        `@OnAppLaunch handler is not callable: ${handler.className}.${String(handler.methodName)}`,
                    );
                continue;
            }

            try {
                await method.call(handler.instance, context);
            } catch (error) {
                options
                    .logger()
                    ?.error?.(
                        `@OnAppLaunch handler failed: ${handler.className}.${String(handler.methodName)}`,
                        error,
                    );
            }
        }
    };

    // Drain queued launch events once the initial startup path is ready.
    const flushPendingLaunches = async (): Promise<void> => {
        if (!isLaunchDispatchReady || isFlushingLaunchQueue) {
            return;
        }

        isFlushingLaunchQueue = true;

        try {
            while (pendingLaunches.length > 0) {
                const nextLaunch = pendingLaunches.shift();
                if (!nextLaunch) {
                    continue;
                }

                await dispatchLaunch(nextLaunch);
            }
        } finally {
            isFlushingLaunchQueue = false;
        }
    };

    // Keep launches ordered even if they arrive before startup has finished.
    const queueLaunch = (context: AppLaunchContext): void => {
        pendingLaunches.push(context);

        if (isLaunchDispatchReady) {
            void flushPendingLaunches();
        }
    };

    const secondInstanceListener = (
        _event: Electron.Event,
        argv: string[],
        workingDirectory: string,
        additionalData: unknown,
    ) => {
        queueLaunch({
            kind: "second-instance",
            argv,
            workingDirectory,
            additionalData,
        });
    };

    return {
        activate(): void {
            if (options.instanceMode === "single") {
                app.on("second-instance", secondInstanceListener);
            }
        },
        cleanup(): void {
            if (options.instanceMode === "single") {
                app.removeListener?.("second-instance", secondInstanceListener);
                app.releaseSingleInstanceLock?.();
            }
        },
        async dispatchInitialLaunch(): Promise<void> {
            await dispatchLaunch({
                kind: "initial",
                argv: [...process.argv],
                workingDirectory: process.cwd(),
            });
            isLaunchDispatchReady = true;
            await flushPendingLaunches();
        },
        setInvocations(invocations: AppLaunchInvocation[]): void {
            appLaunchInvocations = invocations;
        },
    };
}

/**
 * Collects all app-launch handler invocations from the application container.
 *
 * @param {Application} application - The DI application used to discover launch handlers.
 */
export function collectAppLaunchInvocations(
    application: Application,
): AppLaunchInvocation[] {
    const invocations: AppLaunchInvocation[] = [];
    const providers = application.findByTag(APP_LAUNCH_INJECTABLE_TAG);

    providers.forEach((token, index) => {
        if (typeof token !== "function") {
            return;
        }

        const instance = application.get(token) as object;
        const handlers = getAppLaunchHandlers(token);
        handlers.forEach((handler) => {
            invocations.push({
                className: token.name,
                index,
                instance,
                methodName: handler.methodName,
                priority: handler.priority,
            });
        });
    });

    return invocations;
}
