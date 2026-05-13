/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
    FactoryProvider,
    ModuleImport,
    ProviderToken,
} from "@mariodebono/di";
import type { ConfigServiceOptions } from "./config.service.js";

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type Builtin = Primitive | Date | RegExp | typeof Function | Promise<unknown>;

type IsTraversableObject<T> = T extends object
    ? T extends readonly unknown[]
        ? false
        : T extends Builtin
          ? false
          : true
    : false;

type ConfigPathImpl<T> = {
    [K in Extract<keyof T, string>]: IsTraversableObject<T[K]> extends true
        ? K | `${K}.${ConfigPathImpl<T[K]>}`
        : K;
}[Extract<keyof T, string>];

/** Root configuration options used by `ConfigModule.forRoot()`. */
export interface ConfigModuleOptions<
    TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
    /** Whether to merge process.env (default true). */
    loadProcessEnv?: boolean;
    /** Alias for loadProcessEnv=false. */
    ignoreEnvVars?: boolean;
    /** Baseline values merged before any other sources. */
    defaults?: Record<string, unknown>;
    /** Factories to load additional config objects (namespaced via registerAs). */
    load?: ConfigFactory[];
    /** Optional validation/transform step; should return the typed config. */
    validate?: (config: Record<string, unknown>) => TConfig;
    /** Optional validation schema (Joi/Zod-style) to mirror Nest DX. */
    validationSchema?: ValidationSchema<TConfig>;
    /** Options passed to validation schema (Joi-style). */
    validationOptions?: Record<string, unknown>;
    /** Cache computed lookups on ConfigService (default true). */
    cache?: boolean;
    /** Make the module global (default false). */
    isGlobal?: boolean;
}

/** Async root configuration options used by `ConfigModule.forRootAsync()`. */
export interface ConfigModuleAsyncOptions<
    TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
    imports?: ModuleImport[];
    inject?: ProviderToken[];
    useFactory: FactoryProvider<ConfigModuleOptions<TConfig>>["useFactory"];
}

/** Supported validation schema shapes for root configuration validation. */
export type ValidationSchema<TConfig> =
    | {
          validate: (
              config: Record<string, unknown>,
              options?: Record<string, unknown>,
          ) => { error?: unknown; value: TConfig };
      }
    | {
          parse: (config: Record<string, unknown>) => TConfig;
      }
    | {
          safeParse: (config: Record<string, unknown>) => {
              success: boolean;
              data?: TConfig;
              error?: unknown;
          };
      };

/** Factory function that contributes configuration values. */
export type ConfigFactory<T = Record<string, unknown>> = () => T;
/** Resolved config type produced by a configuration factory. */
export type ConfigType<TFactory extends ConfigFactory> = ReturnType<TFactory>;
/** Dot-notation configuration path for a nested config object. */
export type ConfigPath<TConfig extends Record<string, unknown>> =
    ConfigPathImpl<TConfig>;
/** Value type resolved from a dot-notation config path. */
export type ConfigPathValue<
    TConfig extends Record<string, unknown>,
    TPath extends string,
> = TPath extends `${infer Head}.${infer Tail}`
    ? Head extends keyof TConfig
        ? TConfig[Head] extends Record<string, unknown>
            ? ConfigPathValue<TConfig[Head], Tail>
            : never
        : never
    : TPath extends keyof TConfig
      ? TConfig[TPath]
      : never;

/**
 * Configuration factory augmented with namespace metadata for `registerAs()`.
 * Consumers inject `TOKEN` to resolve the projected namespace value.
 */
export interface ConfigFactoryKeyHost<T = Record<string, unknown>> {
    KEY: string;
    TOKEN: ProviderToken<T>;
    (): T;
}

/** Internal normalized config options shape used by provider factories. */
export type NormalizedConfigModuleOptions<
    TConfig extends Record<string, unknown> = Record<string, unknown>,
> = ConfigModuleOptions<TConfig> & {
    cache: ConfigServiceOptions["cache"];
};
