/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    type Application,
    Injectable,
    type InjectableOptions,
    type Logger,
    metadataKeys,
    type ProviderToken,
} from "@mariodebono/di";
import "reflect-metadata";

import type { I18nLocaleChangedEvent } from "./i18n.types.js";

/** Injectable tag used to discover locale-changed hook handlers. */
const I18N_LOCALE_CHANGED_INJECTABLE_TAG = Symbol(
    "platform:i18n:locale-changed-hook",
);
/** Metadata key used to store locale-changed hook definitions. */
const I18N_LOCALE_CHANGED_METADATA_KEY = Symbol(
    "platform:i18n:locale-changed-hook:metadata",
);

/** Options used to configure locale-changed hook decorators. */
export interface I18nLocaleChangedHookOptions {
    priority?: number;
}

/** Metadata stored for each locale-changed hook handler. */
export interface I18nLocaleChangedHandlerMetadata {
    methodName: string | symbol;
    priority: number;
}

/** Describes a single locale-changed handler invocation discovered from metadata. */
export interface I18nLocaleChangedInvocation {
    className: string;
    index: number;
    instance: object;
    methodName: string | symbol;
    priority: number;
}

interface I18nLocaleChangedHookRunnerOptions {
    logger: () => Logger | undefined;
}

export interface I18nLocaleChangedHookRunner {
    collectLocaleChangedInvocations(
        application: Application,
    ): I18nLocaleChangedInvocation[];
    runLocaleChangedHandlers(
        invocations: I18nLocaleChangedInvocation[],
        event: I18nLocaleChangedEvent,
    ): Promise<void>;
}

/**
 * Marks an instance method to run after the locale changes.
 *
 * @param options Locale-changed hook options.
 */
export function OnLocaleChanged(
    options: I18nLocaleChangedHookOptions = {},
): MethodDecorator {
    return createLocaleChangedHookDecorator(options);
}

/**
 * Reads locale-changed hook metadata for a provider token.
 *
 * @param token Provider token to inspect.
 * @returns Registered locale-changed handlers, if any.
 */
export function getLocaleChangedHandlers(
    token: ProviderToken,
): I18nLocaleChangedHandlerMetadata[] {
    if (typeof token !== "function") {
        return [];
    }

    return (
        (Reflect.getMetadata(I18N_LOCALE_CHANGED_METADATA_KEY, token) as
            | I18nLocaleChangedHandlerMetadata[]
            | undefined) ?? []
    );
}

/**
 * Creates the runtime responsible for discovering and running locale-changed handlers.
 *
 * @param options Locale-changed runner configuration.
 * @returns Hook runner capable of collecting and executing handlers.
 */
export function createI18nLocaleChangedHookRunner(
    options: I18nLocaleChangedHookRunnerOptions,
): I18nLocaleChangedHookRunner {
    const runHandlers = async (
        invocations: I18nLocaleChangedInvocation[],
        hookName: string,
        event: I18nLocaleChangedEvent,
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
                await method.call(handler.instance, event);
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
        collectLocaleChangedInvocations(
            application: Application,
        ): I18nLocaleChangedInvocation[] {
            const invocations: I18nLocaleChangedInvocation[] = [];
            const providers = application.findByTag(
                I18N_LOCALE_CHANGED_INJECTABLE_TAG,
            );
            let index = 0;

            for (const provider of providers) {
                if (typeof provider !== "function") {
                    continue;
                }

                const handlers = getLocaleChangedHandlers(provider);
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
                        priority: handler.priority,
                    });
                    index += 1;
                }
            }

            return invocations;
        },
        async runLocaleChangedHandlers(
            invocations: I18nLocaleChangedInvocation[],
            event: I18nLocaleChangedEvent,
        ): Promise<void> {
            await runHandlers(invocations, "@OnLocaleChanged", event);
        },
    };
}

function createLocaleChangedHookDecorator(
    options: I18nLocaleChangedHookOptions,
): MethodDecorator {
    const priority = options.priority ?? 0;

    return (target, propertyKey, descriptor) => {
        if (typeof target === "function") {
            throw new Error(
                "@OnLocaleChanged cannot be applied to static methods",
            );
        }

        const resolvedDescriptor =
            descriptor ??
            (typeof propertyKey === "string" || typeof propertyKey === "symbol"
                ? Object.getOwnPropertyDescriptor(target, propertyKey)
                : undefined);

        if (typeof resolvedDescriptor?.value !== "function") {
            throw new Error("@OnLocaleChanged can only be applied to methods");
        }

        const owner = target.constructor;
        const existing =
            (Reflect.getMetadata(I18N_LOCALE_CHANGED_METADATA_KEY, owner) as
                | I18nLocaleChangedHandlerMetadata[]
                | undefined) ?? [];

        Reflect.defineMetadata(
            I18N_LOCALE_CHANGED_METADATA_KEY,
            [...existing, { methodName: propertyKey, priority }],
            owner,
        );

        tagInjectableForLocaleChangedHooks(owner);
    };
}

function tagInjectableForLocaleChangedHooks(target: object): void {
    const existingOptions =
        (Reflect.getMetadata(metadataKeys.injectableOptions, target) as
            | InjectableOptions
            | undefined) ?? {};
    const existingTags = existingOptions.tags ?? [];

    if (existingTags.includes(I18N_LOCALE_CHANGED_INJECTABLE_TAG)) {
        return;
    }

    Injectable({
        ...existingOptions,
        tags: [...existingTags, I18N_LOCALE_CHANGED_INJECTABLE_TAG],
    })(target as never);
}
