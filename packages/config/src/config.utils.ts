/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Provider } from "@mariodebono/di";
import { ModuleRef } from "@mariodebono/di";
import {
    CONFIG_OPTIONS_TOKEN,
    CONFIG_ROOT_DATA_TOKEN,
} from "./config.constants.js";
import { ConfigService } from "./config.service.js";
import type {
    ConfigFactory,
    ConfigFactoryKeyHost,
    ConfigModuleOptions,
    NormalizedConfigModuleOptions,
} from "./config.types.js";

/**
 * Wraps a config factory with a namespace key for feature-level injection.
 * @param {string} namespace Namespace key used for registration and lookup.
 * @param {() => TConfig} factory Factory that produces the namespace config object.
 * @returns {ConfigFactoryKeyHost<TConfig>} Namespaced config factory with attached `KEY` and `TOKEN` properties.
 */
export function registerAs<TConfig>(
    namespace: string,
    factory: () => TConfig,
): ConfigFactoryKeyHost<TConfig> {
    const wrapped = () => factory();
    const host = wrapped as ConfigFactoryKeyHost<TConfig>;
    host.KEY = namespace;
    host.TOKEN = Symbol(
        `config:namespace:${namespace}`,
    ) as ConfigFactoryKeyHost<TConfig>["TOKEN"];
    return host;
}

/**
 * Applies default values to root config module options.
 * @param {ConfigModuleOptions<TConfig>} options User-provided root config options.
 * @returns {NormalizedConfigModuleOptions<TConfig>} Normalized config options with defaults applied.
 */
export function normalizeOptions<
    TConfig extends Record<string, unknown> = Record<string, unknown>,
>(
    options: ConfigModuleOptions<TConfig>,
): NormalizedConfigModuleOptions<TConfig> {
    return {
        ...options,
        cache: options.cache ?? true,
        loadProcessEnv: options.loadProcessEnv ?? !options.ignoreEnvVars,
        isGlobal: options.isGlobal ?? false,
    };
}

/**
 * Builds the raw configuration object from defaults, env vars, and load factories.
 * @param {NormalizedConfigModuleOptions} options Normalized root config options.
 * @returns {Record<string, unknown>} Assembled raw configuration object before validation.
 */
export function loadConfiguration(
    options: NormalizedConfigModuleOptions,
): Record<string, unknown> {
    let config: Record<string, unknown> = { ...(options.defaults ?? {}) };

    const envVars =
        options.ignoreEnvVars || options.loadProcessEnv === false
            ? {}
            : process.env;
    config = { ...config, ...envVars };

    if (options.load?.length) {
        for (const factory of options.load) {
            const produced = factory();
            if (isConfigFactoryKeyHost(factory)) {
                const existingNamespace =
                    (config[factory.KEY] as Record<string, unknown>) ?? {};
                config = {
                    ...config,
                    [factory.KEY]: {
                        ...existingNamespace,
                        ...(produced as Record<string, unknown>),
                    },
                };
            } else if (produced && typeof produced === "object") {
                config = {
                    ...config,
                    ...(produced as Record<string, unknown>),
                };
            }
        }
    }

    return config;
}

/**
 * Applies validation or transformation to the assembled root config object.
 * @param {NormalizedConfigModuleOptions<TConfig>} options Normalized root config options.
 * @param {Record<string, unknown>} config Assembled raw configuration object.
 * @returns {TConfig} Validated and typed root configuration object.
 */
export function applyValidation<
    TConfig extends Record<string, unknown> = Record<string, unknown>,
>(
    options: NormalizedConfigModuleOptions<TConfig>,
    config: Record<string, unknown>,
): TConfig {
    if (options.validate) {
        return options.validate(config);
    }

    if (options.validationSchema) {
        const schema = options.validationSchema as
            | {
                  parse?: (c: Record<string, unknown>) => TConfig;
                  validate?: (
                      c: Record<string, unknown>,
                      opts?: Record<string, unknown>,
                  ) => { error?: unknown; value: TConfig };
                  safeParse?: (c: Record<string, unknown>) => {
                      success: boolean;
                      data?: TConfig;
                      error?: unknown;
                  };
              }
            | undefined;

        if (schema?.validate) {
            const result = schema.validate(
                config,
                options.validationOptions ?? {},
            );
            if (result.error) {
                throw result.error;
            }
            return result.value;
        }
        if (schema?.safeParse) {
            const result = schema.safeParse(config);
            if (!result.success) {
                throw result.error;
            }
            return result.data as TConfig;
        }
        if (schema?.parse) {
            return schema.parse(config);
        }
    }

    return config as TConfig;
}

/**
 * Creates the root providers that assemble config data and instantiate `ConfigService`.
 * @returns {Provider[]} Providers for validated root config data and the root `ConfigService`.
 */
export function createRootProviders<
    TConfig extends Record<string, unknown> = Record<string, unknown>,
>(): Provider[] {
    return [
        {
            provide: CONFIG_ROOT_DATA_TOKEN,
            useFactory: (
                opts: NormalizedConfigModuleOptions<TConfig>,
            ): TConfig =>
                applyValidation<TConfig>(opts, loadConfiguration(opts)),
            inject: [CONFIG_OPTIONS_TOKEN],
        },
        {
            provide: ConfigService,
            useFactory: (
                rootConfig: TConfig,
                opts: NormalizedConfigModuleOptions<TConfig>,
            ): ConfigService<TConfig> =>
                new ConfigService<TConfig>(rootConfig, {
                    cache: opts.cache,
                }),
            inject: [CONFIG_ROOT_DATA_TOKEN, CONFIG_OPTIONS_TOKEN],
        },
    ];
}

/**
 * Creates namespace projection providers for `ConfigModule.forFeature()`.
 * @param {ConfigFactory[]} load Namespace factories to expose from the root config service.
 * @returns {Provider[]} Namespace projection providers.
 */
export function buildNamespaceProviders(
    load: ConfigFactory[] = [],
): Provider[] {
    const providers: Provider[] = [];
    for (const factory of load) {
        if (!isConfigFactoryKeyHost(factory)) continue;
        providers.push({
            provide: factory.TOKEN,
            useFactory: (moduleRef: ModuleRef) => {
                let configService: ConfigService;
                try {
                    configService = moduleRef.get(ConfigService);
                } catch {
                    throw new Error(
                        `ConfigModule.forFeature() requires ConfigModule.forRoot() to be imported before resolving namespace "${factory.KEY}".`,
                    );
                }
                return configService.getOrThrow(factory.KEY);
            },
            inject: [ModuleRef],
        });
    }
    return providers;
}

/**
 * Checks whether a config factory carries a namespace key from `registerAs()`.
 * @param {ConfigFactory} factory Config factory to test.
 * @returns {factory is ConfigFactoryKeyHost} True when the factory has `KEY` and `TOKEN` metadata.
 */
export function isConfigFactoryKeyHost(
    factory: ConfigFactory,
): factory is ConfigFactoryKeyHost {
    return (
        typeof (factory as ConfigFactoryKeyHost).KEY === "string" &&
        (typeof (factory as ConfigFactoryKeyHost).TOKEN === "symbol" ||
            typeof (factory as ConfigFactoryKeyHost).TOKEN === "string" ||
            typeof (factory as ConfigFactoryKeyHost).TOKEN === "function")
    );
}
