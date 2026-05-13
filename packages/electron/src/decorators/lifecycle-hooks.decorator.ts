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
import {
    Injectable,
    type InjectableOptions,
    metadataKeys,
    type ProviderToken,
} from "@mariodebono/di";
import "reflect-metadata";

/** Execution order used by lifecycle hooks. */
export enum LifecycleHookOrder {
    Before = "before",
    After = "after",
}

/** Options used to configure lifecycle hook decorators. */
export interface LifecycleHookOptions {
    priority?: number;
    order?: LifecycleHookOrder;
}

/** Metadata stored for each lifecycle hook handler. */
export interface LifecycleHookMetadata {
    methodName: string | symbol;
    priority: number;
    order: LifecycleHookOrder;
}

/** Injectable tag used to discover lifecycle hook handlers. */
export const LIFECYCLE_HOOK_INJECTABLE_TAG = Symbol(
    "platform:electron:lifecycle-hook",
);
/** Metadata key used to store app-quit hook definitions. */
export const APP_QUIT_METADATA_KEY = Symbol("platform:electron:app-quit");
/** Metadata key used to store main-window-close hook definitions. */
export const MAIN_WINDOW_CLOSE_METADATA_KEY = Symbol(
    "platform:electron:main-window-close",
);
/** Metadata key used to store main-window-focus hook definitions. */
export const MAIN_WINDOW_FOCUS_METADATA_KEY = Symbol(
    "platform:electron:main-window-focus",
);
/** Metadata key used to store main-window-blur hook definitions. */
export const MAIN_WINDOW_BLUR_METADATA_KEY = Symbol(
    "platform:electron:main-window-blur",
);
/** Metadata key used to store main-window-show hook definitions. */
export const MAIN_WINDOW_SHOW_METADATA_KEY = Symbol(
    "platform:electron:main-window-show",
);

/**
 * Reads app-quit hook metadata for a provider token.
 *
 * @param {ProviderToken} token - Provider token to inspect.
 */
export function getAppQuitHooks(token: ProviderToken): LifecycleHookMetadata[] {
    return getLifecycleHookHandlers(token, APP_QUIT_METADATA_KEY);
}

/**
 * Reads main-window-close hook metadata for a provider token.
 *
 * @param {ProviderToken} token - Provider token to inspect.
 */
export function getMainWindowCloseHooks(
    token: ProviderToken,
): LifecycleHookMetadata[] {
    return getLifecycleHookHandlers(token, MAIN_WINDOW_CLOSE_METADATA_KEY);
}

/**
 * Reads main-window-focus hook metadata for a provider token.
 *
 * @param {ProviderToken} token - Provider token to inspect.
 */
export function getMainWindowFocusHooks(
    token: ProviderToken,
): LifecycleHookMetadata[] {
    return getLifecycleHookHandlers(token, MAIN_WINDOW_FOCUS_METADATA_KEY);
}

/**
 * Reads main-window-blur hook metadata for a provider token.
 *
 * @param {ProviderToken} token - Provider token to inspect.
 */
export function getMainWindowBlurHooks(
    token: ProviderToken,
): LifecycleHookMetadata[] {
    return getLifecycleHookHandlers(token, MAIN_WINDOW_BLUR_METADATA_KEY);
}

/**
 * Reads main-window-show hook metadata for a provider token.
 *
 * @param {ProviderToken} token - Provider token to inspect.
 */
export function getMainWindowShowHooks(
    token: ProviderToken,
): LifecycleHookMetadata[] {
    return getLifecycleHookHandlers(token, MAIN_WINDOW_SHOW_METADATA_KEY);
}

/**
 * Marks an instance method to run during the app-quit lifecycle.
 *
 * @param {LifecycleHookOptions} [options] - Lifecycle hook decorator options.
 */
export function OnAppQuit(options: LifecycleHookOptions = {}): MethodDecorator {
    return createLifecycleHookDecorator(
        APP_QUIT_METADATA_KEY,
        "@OnAppQuit",
        options,
    );
}

/**
 * Marks an instance method to run during the main-window-close lifecycle.
 *
 * @param {LifecycleHookOptions} [options] - Lifecycle hook decorator options.
 */
export function OnMainWindowClose(
    options: LifecycleHookOptions = {},
): MethodDecorator {
    return createLifecycleHookDecorator(
        MAIN_WINDOW_CLOSE_METADATA_KEY,
        "@OnMainWindowClose",
        options,
    );
}

/**
 * Marks an instance method to run during the main-window-focus lifecycle.
 *
 * @param {LifecycleHookOptions} [options] - Lifecycle hook decorator options.
 */
export function OnMainWindowFocus(
    options: LifecycleHookOptions = {},
): MethodDecorator {
    return createLifecycleHookDecorator(
        MAIN_WINDOW_FOCUS_METADATA_KEY,
        "@OnMainWindowFocus",
        options,
    );
}

/**
 * Marks an instance method to run during the main-window-blur lifecycle.
 *
 * @param {LifecycleHookOptions} [options] - Lifecycle hook decorator options.
 */
export function OnMainWindowBlur(
    options: LifecycleHookOptions = {},
): MethodDecorator {
    return createLifecycleHookDecorator(
        MAIN_WINDOW_BLUR_METADATA_KEY,
        "@OnMainWindowBlur",
        options,
    );
}

/**
 * Marks an instance method to run during the main-window-show lifecycle.
 *
 * @param {LifecycleHookOptions} [options] - Lifecycle hook decorator options.
 */
export function OnMainWindowShow(
    options: LifecycleHookOptions = {},
): MethodDecorator {
    return createLifecycleHookDecorator(
        MAIN_WINDOW_SHOW_METADATA_KEY,
        "@OnMainWindowShow",
        options,
    );
}

function getLifecycleHookHandlers(
    token: ProviderToken,
    metadataKey: symbol,
): LifecycleHookMetadata[] {
    if (typeof token !== "function") {
        return [];
    }

    return (
        (Reflect.getMetadata(metadataKey, token) as
            | LifecycleHookMetadata[]
            | undefined) ?? []
    );
}

function createLifecycleHookDecorator(
    metadataKey: symbol,
    decoratorName: string,
    options: LifecycleHookOptions,
): MethodDecorator {
    const priority = options.priority ?? 0;
    const order = options.order ?? LifecycleHookOrder.After;

    return (target, propertyKey, descriptor) => {
        if (typeof target === "function") {
            throw new Error(
                `${decoratorName} cannot be applied to static methods`,
            );
        }

        const resolvedDescriptor =
            descriptor ??
            (typeof propertyKey === "string" || typeof propertyKey === "symbol"
                ? Object.getOwnPropertyDescriptor(target, propertyKey)
                : undefined);

        if (typeof resolvedDescriptor?.value !== "function") {
            throw new Error(`${decoratorName} can only be applied to methods`);
        }

        const owner = target.constructor;
        const existing =
            (Reflect.getMetadata(metadataKey, owner) as
                | LifecycleHookMetadata[]
                | undefined) ?? [];

        Reflect.defineMetadata(
            metadataKey,
            [...existing, { methodName: propertyKey, priority, order }],
            owner,
        );

        tagInjectableForLifecycleHooks(owner);
    };
}

function tagInjectableForLifecycleHooks(target: object): void {
    const existingOptions =
        (Reflect.getMetadata(metadataKeys.injectableOptions, target) as
            | InjectableOptions
            | undefined) ?? {};
    const existingTags = existingOptions.tags ?? [];

    if (existingTags.includes(LIFECYCLE_HOOK_INJECTABLE_TAG)) {
        return;
    }

    Injectable({
        ...existingOptions,
        tags: [...existingTags, LIFECYCLE_HOOK_INJECTABLE_TAG],
    })(target as never);
}
