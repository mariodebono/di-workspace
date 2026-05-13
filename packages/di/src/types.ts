/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// biome-ignore lint/suspicious/noExplicitAny: Allow explicit any for constructor type
export type Constructor<T = unknown> = new (...args: any[]) => T;

export type ProviderToken<T = unknown> = Constructor<T> | symbol | string;

export type ProviderScope = "singleton" | "transient";

export const REQUEST_CONTEXT = Symbol("di:request-context");

export type ModuleImport = Constructor | DynamicModule;

export interface DynamicModule {
    module: Constructor;
    imports?: ModuleImport[];
    providers?: Provider[];
    exports?: ProviderToken[];
    global?: boolean;
}

export interface ClassProvider<T = unknown> {
    provide: ProviderToken<T>;
    useClass: Constructor<T>;
    scope?: ProviderScope;
    tags?: (string | symbol)[];
}

export interface ValueProvider<T = unknown> {
    provide: ProviderToken<T>;
    useValue: T;
    scope?: ProviderScope;
    tags?: (string | symbol)[];
}

export interface FactoryProvider<T = unknown> {
    provide: ProviderToken<T>;
    // biome-ignore lint/suspicious/noExplicitAny: Allow explicit any for factory args
    useFactory: (...args: any[]) => T | Promise<T>;
    inject?: ProviderToken[];
    scope?: ProviderScope;
    tags?: (string | symbol)[];
}

export type Provider<T = unknown> =
    | Constructor<T>
    | ClassProvider<T>
    | ValueProvider<T>
    | FactoryProvider<T>;

export type LogLevel = "log" | "error" | "warn" | "debug" | "verbose" | "fatal";

/**
 * Logging contract used across the platform. Implementations may add transport-specific
 * behavior but should honor these method signatures.
 */
export interface LoggerService {
    /**
     * Writes a standard log message.
     * @param {...unknown[]} args Values to log.
     * @returns {void}
     */
    log: (...args: unknown[]) => void;
    /**
     * Writes an error message.
     * @param {...unknown[]} args Values to log.
     * @returns {void}
     */
    error: (...args: unknown[]) => void;
    /**
     * Writes a warning message.
     * @param {...unknown[]} args Values to log.
     * @returns {void}
     */
    warn: (...args: unknown[]) => void;
    /**
     * Writes a debug message.
     * @param {...unknown[]} args Values to log.
     * @returns {void}
     */
    debug?: (...args: unknown[]) => void;
    /**
     * Writes a verbose message.
     * @param {...unknown[]} args Values to log.
     * @returns {void}
     */
    verbose?: (...args: unknown[]) => void;
    /**
     * Writes a fatal message.
     * @param {...unknown[]} args Values to log.
     * @returns {void}
     */
    fatal?: (...args: unknown[]) => void;
    /**
     * Replaces the enabled log levels for the logger.
     * @param {LogLevel[]} levels Log levels to enable.
     * @returns {void}
     */
    setLogLevels?: (levels: LogLevel[]) => void;
    /**
     * Returns a logger instance scoped to a context label.
     * @param {string} context Context label to attach to subsequent output.
     * @returns {LoggerService} Contextual logger instance.
     */
    withContext?: (context: string) => LoggerService;
}

export interface OnModuleInit {
    /**
     * Runs after the provider instance has been created.
     * @returns {void | Promise<void>} Optional async initialization work.
     */
    onModuleInit(): void | Promise<void>;
}

export interface OnModuleDestroy {
    /**
     * Runs when the provider instance is being destroyed.
     * @returns {void | Promise<void>} Optional async teardown work.
     */
    onModuleDestroy(): void | Promise<void>;
}
