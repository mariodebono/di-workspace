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

/** Execution order used by app-ready handlers. */
export enum AppReadyOrder {
    BeforeWindow = "beforeWindow",
    AfterWindow = "afterWindow",
}

/** Options used to configure app-ready decorators. */
export interface AppReadyOptions {
    priority?: number;
    order?: AppReadyOrder;
}

/** Metadata stored for each app-ready handler. */
export interface AppReadyHandlerMetadata {
    methodName: string | symbol;
    priority: number;
    order: AppReadyOrder;
}

/** Injectable tag used to discover app-ready handlers. */
export const APP_READY_INJECTABLE_TAG = Symbol("platform:electron:app-ready");
/** Metadata key used to store app-ready handler definitions. */
export const APP_READY_METADATA_KEY = Symbol("platform:electron:app-ready");

/**
 * Read @AppReady metadata for a provider token.
 *
 * @param {ProviderToken} token - Provider token to inspect.
 */
export function getAppReadyHandlers(
    token: ProviderToken,
): AppReadyHandlerMetadata[] {
    if (typeof token !== "function") {
        return [];
    }

    return (
        (Reflect.getMetadata(APP_READY_METADATA_KEY, token) as
            | AppReadyHandlerMetadata[]
            | undefined) ?? []
    );
}

/**
 * Marks an instance method to run after Electron app readiness.
 * Handlers support optional phase ordering and priority.
 *
 * @param {AppReadyOptions} [options] - App-ready decorator options.
 */
export function AppReady(options: AppReadyOptions = {}): MethodDecorator {
    const priority = options.priority ?? 0;
    const order = options.order ?? AppReadyOrder.AfterWindow;

    return (target, propertyKey, descriptor) => {
        if (typeof target === "function") {
            throw new Error("@AppReady cannot be applied to static methods");
        }

        const resolvedDescriptor =
            descriptor ??
            (typeof propertyKey === "string" || typeof propertyKey === "symbol"
                ? Object.getOwnPropertyDescriptor(target, propertyKey)
                : undefined);

        if (typeof resolvedDescriptor?.value !== "function") {
            throw new Error("@AppReady can only be applied to methods");
        }

        const owner = target.constructor;
        const existing =
            (Reflect.getMetadata(APP_READY_METADATA_KEY, owner) as
                | AppReadyHandlerMetadata[]
                | undefined) ?? [];

        Reflect.defineMetadata(
            APP_READY_METADATA_KEY,
            [...existing, { methodName: propertyKey, priority, order }],
            owner,
        );

        tagInjectableForAppReady(owner);
    };
}

function tagInjectableForAppReady(target: object): void {
    const existingOptions =
        (Reflect.getMetadata(metadataKeys.injectableOptions, target) as
            | InjectableOptions
            | undefined) ?? {};
    const existingTags = existingOptions.tags ?? [];

    if (existingTags.includes(APP_READY_INJECTABLE_TAG)) {
        return;
    }

    Injectable({
        ...existingOptions,
        tags: [...existingTags, APP_READY_INJECTABLE_TAG],
    })(target as never);
}
