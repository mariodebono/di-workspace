/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Injectable } from "@mariodebono/di";
import type { ConfigPath, ConfigPathValue } from "./config.types.js";

export interface ConfigGetOptions<TValue = unknown> {
    /** When true, use the service-level cache (default true). */
    cache?: boolean;
    /** Default value returned when the key is undefined. */
    defaultValue?: TValue;
}

export interface ConfigServiceOptions {
    cache?: boolean;
}

type ConfigKey<TConfig extends Record<string, unknown>> = Extract<
    keyof TConfig,
    string
>;

/**
 * In-memory configuration service with typed accessors and dot-notation lookup.
 */
@Injectable()
export class ConfigService<
    TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
    private readonly config: TConfig;
    private readonly cacheEnabled: boolean;
    private readonly lookupCache = new Map<string, unknown>();

    /**
     * Creates a configuration service backed by an in-memory config object.
     * @param {TConfig | undefined} config Root configuration object.
     * @param {ConfigServiceOptions} options Service options controlling lookup behavior.
     */
    constructor(config?: TConfig, options: ConfigServiceOptions = {}) {
        this.config = (config ?? {}) as TConfig;
        this.cacheEnabled = options.cache ?? true;
    }

    /**
     * Retrieve a configuration value by key or path (dot notation supported).
     * @param {K | string} key Config key or dot-notation path to resolve.
     * @param {ConfigGetOptions<unknown> | undefined} options Lookup behavior overrides.
     * @returns {unknown} Resolved config value or the configured default value.
     */
    get<K extends ConfigKey<TConfig>>(
        key: K,
        options?: ConfigGetOptions<TConfig[K]>,
    ): TConfig[K] | undefined;
    get<P extends ConfigPath<TConfig>>(
        key: P,
        options?: ConfigGetOptions<ConfigPathValue<TConfig, P>>,
    ): ConfigPathValue<TConfig, P> | undefined;
    get<T = unknown>(key: string, options?: ConfigGetOptions<T>): T | undefined;
    get(
        key: ConfigKey<TConfig> | string,
        options?: ConfigGetOptions<unknown>,
    ): unknown {
        const cacheKey = String(key);
        const useCache = options?.cache ?? this.cacheEnabled;

        if (useCache && this.lookupCache.has(cacheKey)) {
            return this.lookupCache.get(cacheKey);
        }

        const value =
            typeof key === "string"
                ? this.getByPath(key)
                : (this.config[key] as unknown);

        const resolved = value === undefined ? options?.defaultValue : value;

        if (useCache) {
            this.lookupCache.set(cacheKey, resolved);
        }

        return resolved;
    }

    /**
     * Retrieve a configuration value by key or throw if missing.
     * @param {K | string} key Config key or dot-notation path to resolve.
     * @param {ConfigGetOptions<unknown> | undefined} options Lookup behavior overrides.
     * @returns {unknown} Resolved config value.
     */
    getOrThrow<K extends ConfigKey<TConfig>>(
        key: K,
        options?: ConfigGetOptions<TConfig[K]>,
    ): TConfig[K];
    getOrThrow<P extends ConfigPath<TConfig>>(
        key: P,
        options?: ConfigGetOptions<ConfigPathValue<TConfig, P>>,
    ): ConfigPathValue<TConfig, P>;
    getOrThrow<T = unknown>(key: string, options?: ConfigGetOptions<T>): T;
    getOrThrow(
        key: ConfigKey<TConfig> | string,
        options?: ConfigGetOptions<unknown>,
    ): unknown {
        const value = this.get(key, options);
        if (value === undefined) {
            throw new Error(
                `Configuration key "${String(key)}" not found. Verify the namespace/path exists in the root config.`,
            );
        }
        return value;
    }

    /**
     * Check whether a configuration key exists.
     * @param {K | string} key Config key or dot-notation path to test.
     * @returns {boolean} True when the key resolves to a defined value.
     */
    has<K extends ConfigKey<TConfig>>(key: K): boolean;
    has<P extends ConfigPath<TConfig>>(key: P): boolean;
    has(key: string): boolean;
    has(key: ConfigKey<TConfig> | string): boolean {
        return this.get(key) !== undefined;
    }

    /**
     * Return the full configuration object.
     * @returns {TConfig} Full root configuration object.
     */
    getAll(): TConfig {
        return this.config;
    }

    /**
     * Resolves a configuration value using dot-notation path traversal.
     * @param {string} path Dot-notation path to resolve.
     * @returns {unknown} Resolved config value or `undefined` when missing.
     */
    private getByPath(path: string): unknown {
        if (!path.includes(".")) {
            return (this.config as Record<string, unknown>)[path];
        }

        const segments = path.split(".");
        let current: unknown = this.config;
        for (const segment of segments) {
            if (
                current === undefined ||
                current === null ||
                typeof current !== "object"
            ) {
                return undefined;
            }
            current = (current as Record<string, unknown>)[segment];
        }
        return current;
    }
}
