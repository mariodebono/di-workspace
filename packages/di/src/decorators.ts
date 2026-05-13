/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import "reflect-metadata";
import type {
    Constructor,
    ModuleImport,
    Provider,
    ProviderScope,
    ProviderToken,
} from "./types.js";

const MODULE_METADATA_KEY = Symbol("module:metadata");
const MODULE_PARAMTYPES_KEY = Symbol("module:paramtypes");
const INJECTABLE_METADATA_KEY = Symbol("injectable:flag");
const INJECTABLE_OPTIONS_KEY = Symbol("injectable:options");
const INJECT_TOKENS_METADATA_KEY = Symbol("inject:tokens");
const OPTIONAL_PARAMS_METADATA_KEY = Symbol("inject:optional-params");

export interface ModuleMetadata {
    imports?: ModuleImport[];
    providers?: Provider[];
    exports?: (Constructor | string | symbol)[];
    global?: boolean;
}

/**
 * Declares a DI module with its imports, providers, exports, and scope.
 * @param {ModuleMetadata | undefined} metadata Module definition metadata.
 * @returns {ClassDecorator} Class decorator that stores module metadata.
 */
export function Module(metadata?: ModuleMetadata): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(MODULE_METADATA_KEY, metadata, target);

        const paramTypes =
            (Reflect.getMetadata(
                "design:paramtypes",
                target,
            ) as Constructor[]) ?? [];
        Reflect.defineMetadata(MODULE_PARAMTYPES_KEY, paramTypes, target);
    };
}

/**
 * Marks a module as globally visible to the application graph.
 * @returns {ClassDecorator} Class decorator that toggles the module `global` flag.
 */
export function Global(): ClassDecorator {
    return (target) => {
        const existing =
            (Reflect.getMetadata(MODULE_METADATA_KEY, target) as
                | ModuleMetadata
                | undefined) ?? {};
        Reflect.defineMetadata(
            MODULE_METADATA_KEY,
            { ...existing, global: true },
            target,
        );
    };
}

export interface InjectableOptions {
    scope?: ProviderScope;
    tags?: (string | symbol)[];
}

export interface ForwardReference<T = unknown> {
    forwardRef: () => T;
}

export type InjectToken = ProviderToken | ForwardReference<ProviderToken>;

/**
 * Creates a deferred token reference for circular or declaration-order dependencies.
 * @param {() => T} forwardRefFn Callback that returns the real token when resolved.
 * @returns {ForwardReference<T>} Deferred reference wrapper.
 */
export function forwardRef<T>(forwardRefFn: () => T): ForwardReference<T> {
    return { forwardRef: forwardRefFn };
}

/**
 * Checks whether a value is a forward reference wrapper.
 * @param {unknown} value Value to test.
 * @returns {value is ForwardReference<unknown>} True when the value contains a `forwardRef` callback.
 */
export function isForwardReference(
    value: unknown,
): value is ForwardReference<unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        "forwardRef" in value &&
        typeof (value as ForwardReference<unknown>).forwardRef === "function"
    );
}

/**
 * Marks a class as injectable and optionally sets scope or discovery tags.
 * @param {InjectableOptions | undefined} options Injectable configuration for scope and tags.
 * @returns {ClassDecorator} Class decorator that marks a class as injectable.
 */
export function Injectable(options?: InjectableOptions): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(INJECTABLE_METADATA_KEY, true, target);
        if (options) {
            Reflect.defineMetadata(INJECTABLE_OPTIONS_KEY, options, target);
        }
    };
}

/**
 * Overrides constructor parameter token resolution for dependency injection.
 * @param {InjectToken} token Explicit injection token for the decorated constructor parameter.
 * @returns {ParameterDecorator} Parameter decorator that stores the injection token override.
 */
export function Inject(token: InjectToken): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        assertConstructorParameterDecorator(propertyKey, "@Inject");
        const existing =
            (Reflect.getMetadata(INJECT_TOKENS_METADATA_KEY, target) as
                | Record<number, InjectToken>
                | undefined) ?? {};

        Reflect.defineMetadata(
            INJECT_TOKENS_METADATA_KEY,
            { ...existing, [parameterIndex]: token },
            target,
        );
    };
}

/**
 * Marks a constructor parameter as optional. If provider is missing, undefined is injected.
 * @returns {ParameterDecorator} Parameter decorator that marks the parameter as optional.
 */
export function Optional(): ParameterDecorator {
    return (target, propertyKey, parameterIndex) => {
        assertConstructorParameterDecorator(propertyKey, "@Optional");
        const existing =
            (Reflect.getMetadata(OPTIONAL_PARAMS_METADATA_KEY, target) as
                | number[]
                | undefined) ?? [];
        Reflect.defineMetadata(
            OPTIONAL_PARAMS_METADATA_KEY,
            [...new Set([...existing, parameterIndex])],
            target,
        );
    };
}

/**
 * Ensures a parameter decorator is only used on constructor parameters.
 * @param {string | symbol | undefined} propertyKey Property key passed to the decorator.
 * @param {string} decoratorName Decorator name used in the error message.
 * @returns {void}
 */
function assertConstructorParameterDecorator(
    propertyKey: string | symbol | undefined,
    decoratorName: string,
): void {
    if (propertyKey !== undefined) {
        throw new Error(
            `${decoratorName} can only be used on constructor parameters`,
        );
    }
}

export const metadataKeys = {
    module: MODULE_METADATA_KEY,
    paramtypes: MODULE_PARAMTYPES_KEY,
    injectable: INJECTABLE_METADATA_KEY,
    injectableOptions: INJECTABLE_OPTIONS_KEY,
    injectTokens: INJECT_TOKENS_METADATA_KEY,
    optionalParams: OPTIONAL_PARAMS_METADATA_KEY,
} as const;
