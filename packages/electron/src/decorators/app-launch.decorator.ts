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

/** Context passed to app-launch handlers when the application starts or receives a second instance. */
export interface AppLaunchContext {
    kind: "initial" | "second-instance";
    argv: string[];
    workingDirectory?: string;
    additionalData?: unknown;
}

/** Options used to configure app-launch decorators. */
export interface AppLaunchOptions {
    priority?: number;
}

/** Metadata stored for each app-launch handler. */
export interface AppLaunchHandlerMetadata {
    methodName: string | symbol;
    priority: number;
}

/** Injectable tag used to discover app-launch handlers. */
export const APP_LAUNCH_INJECTABLE_TAG = Symbol("platform:electron:app-launch");
/** Metadata key used to store app-launch handler definitions. */
export const APP_LAUNCH_METADATA_KEY = Symbol("platform:electron:app-launch");

/**
 * Reads the app-launch handler metadata for a provider token.
 *
 * @param {ProviderToken} token - Provider token to inspect.
 */
export function getAppLaunchHandlers(
    token: ProviderToken,
): AppLaunchHandlerMetadata[] {
    if (typeof token !== "function") {
        return [];
    }

    return (
        (Reflect.getMetadata(APP_LAUNCH_METADATA_KEY, token) as
            | AppLaunchHandlerMetadata[]
            | undefined) ?? []
    );
}

/**
 * Marks an instance method to run when the Electron app launches.
 *
 * @param {AppLaunchOptions} [options] - App-launch decorator options.
 */
export function OnAppLaunch(options: AppLaunchOptions = {}): MethodDecorator {
    const priority = options.priority ?? 0;

    return (target, propertyKey, descriptor) => {
        if (typeof target === "function") {
            throw new Error("@OnAppLaunch cannot be applied to static methods");
        }

        const resolvedDescriptor =
            descriptor ??
            (typeof propertyKey === "string" || typeof propertyKey === "symbol"
                ? Object.getOwnPropertyDescriptor(target, propertyKey)
                : undefined);

        if (typeof resolvedDescriptor?.value !== "function") {
            throw new Error("@OnAppLaunch can only be applied to methods");
        }

        const owner = target.constructor;
        const existing =
            (Reflect.getMetadata(APP_LAUNCH_METADATA_KEY, owner) as
                | AppLaunchHandlerMetadata[]
                | undefined) ?? [];

        Reflect.defineMetadata(
            APP_LAUNCH_METADATA_KEY,
            [...existing, { methodName: propertyKey, priority }],
            owner,
        );

        tagInjectableForAppLaunch(owner);
    };
}

function tagInjectableForAppLaunch(target: object): void {
    const existingOptions =
        (Reflect.getMetadata(metadataKeys.injectableOptions, target) as
            | InjectableOptions
            | undefined) ?? {};
    const existingTags = existingOptions.tags ?? [];

    if (existingTags.includes(APP_LAUNCH_INJECTABLE_TAG)) {
        return;
    }

    Injectable({
        ...existingOptions,
        tags: [...existingTags, APP_LAUNCH_INJECTABLE_TAG],
    })(target as never);
}
