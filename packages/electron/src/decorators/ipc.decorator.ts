/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Injectable } from "@mariodebono/di";

import "reflect-metadata";

/** Tag applied to bridge controllers so they can be discovered at runtime. */
export const CONTROLLER_INJECTABLE_TAG = Symbol(
    "platform:electron:bridge-controller",
);

/** Marker metadata for bridge controllers. */
export const CONTROLLER_METADATA_KEY = Symbol(
    "platform:electron:bridge-controller",
);
/** Metadata key used to store controller namespace definitions. */
export const CONTROLLER_NAMESPACE_METADATA_KEY = Symbol(
    "platform:electron:bridge-controller:namespace",
);

/** Metadata key used to store IPC handler definitions. */
export const IPC_HANDLER_METADATA_KEY = Symbol("platform:electron:ipc-handler");

/** Metadata stored for a registered IPC handler. */
type HandlerMetadata = {
    channel: string;
    methodName: string | symbol;
    useControllerNamespace: boolean;
};

export type BridgeControllerOptions = {
    namespace: string;
};

type TypedMethodDecorator<T> = (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
    // biome-ignore lint/suspicious/noConfusingVoidType: Intended for decorators
) => TypedPropertyDescriptor<T> | void;

/**
 * Marks a controller method as an IPC handler for the specified channel.
 */
/**
 * Marks a controller method as an IPC handler for the specified channel.
 *
 * @param {string} channel - IPC channel name.
 */
export function IpcHandle(channel: string): MethodDecorator {
    return defineIpcHandle(channel, false);
}

function defineIpcHandle(
    channel: string,
    useControllerNamespace: boolean,
): MethodDecorator {
    // todo get controller bridge type and validate method signature
    return (target, propertyKey, descriptor) => {
        if (typeof descriptor?.value !== "function") {
            throw new Error("@IpcHandle can only be applied to methods");
        }
        const existing =
            (Reflect.getMetadata(
                IPC_HANDLER_METADATA_KEY,
                target.constructor,
            ) as HandlerMetadata[] | undefined) ?? [];
        Reflect.defineMetadata(
            IPC_HANDLER_METADATA_KEY,
            [
                ...existing,
                { channel, methodName: propertyKey, useControllerNamespace },
            ],
            target.constructor,
        );
    };
}

/**
 * Typed variant of @IpcHandle that constrains channel and signature.
 * Uses the shared channel→handler mapping to catch mismatches at build time.
 *
 * @param {C} channel - IPC channel name.
 */
export function IpcHandleTyped<
    // biome-ignore lint/suspicious/noExplicitAny: Allow explicit any for generic bridge type
    T extends Record<string, (...args: any[]) => any>,
    C extends keyof T,
>(channel: C): TypedMethodDecorator<T[C]> {
    return (target, propertyKey, descriptor: TypedPropertyDescriptor<T[C]>) =>
        defineIpcHandle(String(channel), true)(target, propertyKey, descriptor);
}

/**
 * Factory for creating typed @IpcHandle decorators based on a specific bridge interface.
 * Example usage:
 *   const IpcHandleForMyBridge = createIpcHandleTyped<MyBridge>();
 *   class MyController {
 *     @IpcHandleForMyBridge("someChannel")
 *     async someMethod(arg: string): Promise<number> { ... }
 *   }
 *
 * @returns A typed IPC decorator factory for the given bridge interface.
 */
export function createIpcHandleTyped<
    // biome-ignore lint/suspicious/noExplicitAny: Allow explicit any for generic bridge type
    T extends Record<string, (...args: any[]) => any>,
>() {
    return <C extends keyof T>(channel: C): TypedMethodDecorator<T[C]> =>
        (target, propertyKey, descriptor) =>
            defineIpcHandle(String(channel), true)(
                target,
                propertyKey,
                descriptor,
            );
}

/**
 * Marks a class as an IPC bridge controller and tags it for discovery.
 */
export function BridgeController(
    options: BridgeControllerOptions,
): ClassDecorator {
    return (target) => {
        if (
            typeof options.namespace !== "string" ||
            options.namespace.length === 0
        ) {
            throw new Error("@BridgeController requires a non-empty namespace");
        }
        Injectable({ tags: [CONTROLLER_INJECTABLE_TAG] })(target);
        Reflect.defineMetadata(CONTROLLER_METADATA_KEY, options, target);
        Reflect.defineMetadata(
            CONTROLLER_NAMESPACE_METADATA_KEY,
            options.namespace,
            target,
        );
    };
}

/** Handler metadata used internally by IPC registration. */
export type { HandlerMetadata };
