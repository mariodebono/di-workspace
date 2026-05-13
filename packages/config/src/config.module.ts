/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { type DynamicModule, Module } from "@mariodebono/di";
import { CONFIG_OPTIONS_TOKEN } from "./config.constants.js";
import { ConfigService } from "./config.service.js";
import type {
    ConfigFactory,
    ConfigModuleAsyncOptions,
    ConfigModuleOptions,
    NormalizedConfigModuleOptions,
} from "./config.types.js";
import {
    buildNamespaceProviders,
    createRootProviders,
    normalizeOptions,
} from "./config.utils.js";

export { CONFIG_OPTIONS_TOKEN } from "./config.constants.js";
export type {
    ConfigFactory,
    ConfigFactoryKeyHost,
    ConfigModuleAsyncOptions,
    ConfigModuleOptions,
    ConfigType,
    ValidationSchema,
} from "./config.types.js";
export { registerAs } from "./config.utils.js";

/**
 * DI-backed configuration module inspired by NestJS `ConfigModule`.
 * Provides root config bootstrapping plus feature-level namespace projection.
 */
@Module({})
export class ConfigModule {
    /**
     * Registers the root configuration module with synchronously provided options.
     * @param {ConfigModuleOptions<TConfig>} options Root configuration options.
     * @returns {DynamicModule} Dynamic module definition that provides the root `ConfigService`.
     */
    static forRoot<
        TConfig extends Record<string, unknown> = Record<string, unknown>,
    >(options: ConfigModuleOptions<TConfig> = {}): DynamicModule {
        const normalized = normalizeOptions(options);

        return {
            module: ConfigModule,
            global: normalized.isGlobal,
            providers: [
                {
                    provide: CONFIG_OPTIONS_TOKEN,
                    useValue: normalized,
                },
                ...createRootProviders<TConfig>(),
            ],
            exports: [ConfigService],
        };
    }

    /**
     * Registers the root configuration module with asynchronously resolved options.
     * @param {ConfigModuleAsyncOptions<TConfig>} options Async configuration options factory and dependencies.
     * @returns {DynamicModule} Dynamic module definition that resolves root config options asynchronously.
     */
    static forRootAsync<
        TConfig extends Record<string, unknown> = Record<string, unknown>,
    >(options: ConfigModuleAsyncOptions<TConfig>): DynamicModule {
        return {
            module: ConfigModule,
            imports: options.imports ?? [],
            providers: [
                {
                    provide: CONFIG_OPTIONS_TOKEN,
                    useFactory: async (
                        ...args: unknown[]
                    ): Promise<NormalizedConfigModuleOptions<TConfig>> =>
                        normalizeOptions(await options.useFactory(...args)),
                    inject: options.inject ?? [],
                },
                ...createRootProviders<TConfig>(),
            ],
            exports: [ConfigService],
        };
    }

    /**
     * Load additional, feature-scoped configuration factories.
     * Mirrors ConfigModule.forFeature(loaders).
     * @param {ConfigFactory[]} load Namespace factories to expose from the root `ConfigService`.
     * @returns {DynamicModule} Dynamic module definition that exports namespace projection providers.
     */
    static forFeature(load: ConfigFactory[] = []): DynamicModule {
        const providers = buildNamespaceProviders(load);

        return {
            module: ConfigModule,
            providers,
            exports: providers.map((provider) =>
                typeof provider === "function" ? provider : provider.provide,
            ),
        };
    }
}
