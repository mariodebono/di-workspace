/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Application, Constructor, Logger } from "@mariodebono/di";
import {
    APP_READY_INJECTABLE_TAG,
    type AppReadyOrder,
    getAppReadyHandlers,
} from "./decorators/app-ready.decorator.js";
import {
    LIFECYCLE_HOOK_INJECTABLE_TAG,
    type LifecycleHookMetadata,
    type LifecycleHookOrder,
} from "./decorators/lifecycle-hooks.decorator.js";

/** Describes a single app-ready handler invocation discovered from metadata. */
export interface AppReadyInvocation {
    className: string;
    index: number;
    instance: object;
    methodName: string | symbol;
    order: AppReadyOrder;
    priority: number;
}

/** Describes a single lifecycle hook invocation discovered from metadata. */
export interface LifecycleInvocation {
    className: string;
    index: number;
    instance: object;
    methodName: string | symbol;
    order: LifecycleHookOrder;
    priority: number;
}

interface LifecycleHookRunnerOptions {
    logger: () => Logger | undefined;
}

interface LifecycleHookRunner {
    collectAppReadyInvocations(application: Application): AppReadyInvocation[];
    collectLifecycleInvocations(
        application: Application,
        getHandlers: (token: Constructor<unknown>) => LifecycleHookMetadata[],
    ): LifecycleInvocation[];
    runAppReadyHandlers(
        invocations: AppReadyInvocation[],
        phase: AppReadyOrder,
    ): Promise<void>;
    runAppQuitHooks(
        invocations: LifecycleInvocation[],
        order: LifecycleHookOrder,
    ): Promise<void>;
    runMainWindowCloseHooks(
        invocations: LifecycleInvocation[],
        order: LifecycleHookOrder,
    ): Promise<void>;
    runMainWindowFocusHooks(
        invocations: LifecycleInvocation[],
        order: LifecycleHookOrder,
    ): Promise<void>;
    runMainWindowBlurHooks(
        invocations: LifecycleInvocation[],
        order: LifecycleHookOrder,
    ): Promise<void>;
    runMainWindowShowHooks(
        invocations: LifecycleInvocation[],
        order: LifecycleHookOrder,
    ): Promise<void>;
}

/**
 * Creates the runtime responsible for discovering and running lifecycle handlers.
 *
 * @param {LifecycleHookRunnerOptions} options - Lifecycle runner configuration.
 */
export function createLifecycleHookRunner(
    options: LifecycleHookRunnerOptions,
): LifecycleHookRunner {
    const runHandlers = async <
        T extends {
            className: string;
            index: number;
            instance: object;
            methodName: string | symbol;
            priority: number;
        },
    >(
        invocations: T[],
        hookName: string,
    ): Promise<void> => {
        const handlers = [...invocations].sort(
            (left, right) =>
                left.priority - right.priority || left.index - right.index,
        );

        for (const handler of handlers) {
            const method = Reflect.get(handler.instance, handler.methodName);
            if (typeof method !== "function") {
                options
                    .logger()
                    ?.error?.(
                        `${hookName} handler is not callable: ${handler.className}.${String(handler.methodName)}`,
                    );
                continue;
            }

            try {
                await method.call(handler.instance);
            } catch (error) {
                options
                    .logger()
                    ?.error?.(
                        `${hookName} handler failed: ${handler.className}.${String(handler.methodName)}`,
                        error,
                    );
            }
        }
    };

    return {
        /**
         * Collects app-ready handler invocations from the application container.
         *
         * @param {Application} application - The DI application used to discover handlers.
         */
        collectAppReadyInvocations(
            application: Application,
        ): AppReadyInvocation[] {
            const invocations: AppReadyInvocation[] = [];
            const providers = application.findByTag(APP_READY_INJECTABLE_TAG);
            let index = 0;

            for (const provider of providers) {
                const handlers = getAppReadyHandlers(provider);
                if (!handlers.length) {
                    continue;
                }

                const instance = application.get(provider);
                if (typeof instance !== "object" || instance === null) {
                    continue;
                }

                const className =
                    typeof provider === "function"
                        ? provider.name
                        : String(provider);

                for (const handler of handlers) {
                    invocations.push({
                        className,
                        index,
                        instance,
                        methodName: handler.methodName,
                        order: handler.order,
                        priority: handler.priority,
                    });
                    index += 1;
                }
            }

            return invocations;
        },
        /**
         * Collects lifecycle hook invocations for a specific discovery callback.
         *
         * @param {Application} application - The DI application used to discover handlers.
         * @param {(token: Constructor<unknown>) => LifecycleHookMetadata[]} getHandlers - Callback that reads metadata for a provider token.
         */
        collectLifecycleInvocations(
            application: Application,
            getHandlers: (
                token: Constructor<unknown>,
            ) => LifecycleHookMetadata[],
        ): LifecycleInvocation[] {
            const invocations: LifecycleInvocation[] = [];
            const providers = application.findByTag(
                LIFECYCLE_HOOK_INJECTABLE_TAG,
            );
            let index = 0;

            for (const provider of providers) {
                if (typeof provider !== "function") {
                    continue;
                }

                const handlers = getHandlers(provider as Constructor<unknown>);
                if (!handlers.length) {
                    continue;
                }

                const instance = application.get(provider);
                if (typeof instance !== "object" || instance === null) {
                    continue;
                }

                const className = provider.name;

                for (const handler of handlers) {
                    invocations.push({
                        className,
                        index,
                        instance,
                        methodName: handler.methodName,
                        order: handler.order,
                        priority: handler.priority,
                    });
                    index += 1;
                }
            }

            return invocations;
        },
        /**
         * Runs app-ready handlers for a specific phase.
         *
         * @param {AppReadyInvocation[]} invocations - Pre-collected app-ready handler invocations.
         * @param {AppReadyOrder} phase - The app-ready phase to execute.
         */
        async runAppReadyHandlers(
            invocations: AppReadyInvocation[],
            phase: AppReadyOrder,
        ): Promise<void> {
            await runHandlers(
                invocations.filter((handler) => handler.order === phase),
                "@AppReady",
            );
        },
        /**
         * Runs app-quit hooks for a specific lifecycle order.
         *
         * @param {LifecycleInvocation[]} invocations - Pre-collected lifecycle hook invocations.
         * @param {LifecycleHookOrder} order - The lifecycle order to execute.
         */
        async runAppQuitHooks(
            invocations: LifecycleInvocation[],
            order: LifecycleHookOrder,
        ): Promise<void> {
            await runHandlers(
                invocations.filter((handler) => handler.order === order),
                "@OnAppQuit",
            );
        },
        /**
         * Runs main-window close hooks for a specific lifecycle order.
         *
         * @param {LifecycleInvocation[]} invocations - Pre-collected lifecycle hook invocations.
         * @param {LifecycleHookOrder} order - The lifecycle order to execute.
         */
        async runMainWindowCloseHooks(
            invocations: LifecycleInvocation[],
            order: LifecycleHookOrder,
        ): Promise<void> {
            await runHandlers(
                invocations.filter((handler) => handler.order === order),
                "@OnMainWindowClose",
            );
        },
        /**
         * Runs main-window focus hooks for a specific lifecycle order.
         *
         * @param {LifecycleInvocation[]} invocations - Pre-collected lifecycle hook invocations.
         * @param {LifecycleHookOrder} order - The lifecycle order to execute.
         */
        async runMainWindowFocusHooks(
            invocations: LifecycleInvocation[],
            order: LifecycleHookOrder,
        ): Promise<void> {
            await runHandlers(
                invocations.filter((handler) => handler.order === order),
                "@OnMainWindowFocus",
            );
        },
        /**
         * Runs main-window blur hooks for a specific lifecycle order.
         *
         * @param {LifecycleInvocation[]} invocations - Pre-collected lifecycle hook invocations.
         * @param {LifecycleHookOrder} order - The lifecycle order to execute.
         */
        async runMainWindowBlurHooks(
            invocations: LifecycleInvocation[],
            order: LifecycleHookOrder,
        ): Promise<void> {
            await runHandlers(
                invocations.filter((handler) => handler.order === order),
                "@OnMainWindowBlur",
            );
        },
        /**
         * Runs main-window show hooks for a specific lifecycle order.
         *
         * @param {LifecycleInvocation[]} invocations - Pre-collected lifecycle hook invocations.
         * @param {LifecycleHookOrder} order - The lifecycle order to execute.
         */
        async runMainWindowShowHooks(
            invocations: LifecycleInvocation[],
            order: LifecycleHookOrder,
        ): Promise<void> {
            await runHandlers(
                invocations.filter((handler) => handler.order === order),
                "@OnMainWindowShow",
            );
        },
    };
}
