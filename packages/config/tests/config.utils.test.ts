/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ModuleRef } from "@mariodebono/di";
import { describe, expect, it } from "vitest";
import { ConfigService } from "../src/config.service.js";
import type { ConfigFactory } from "../src/config.types.js";
import {
    applyValidation,
    buildNamespaceProviders,
    isConfigFactoryKeyHost,
    loadConfiguration,
    normalizeOptions,
    registerAs,
} from "../src/config.utils.js";

type NamespaceProvider = {
    useFactory: (moduleRef: Pick<ModuleRef, "get">) => unknown;
};

describe("config utils", () => {
    it("normalizes option defaults", () => {
        expect(normalizeOptions({})).toMatchObject({
            cache: true,
            loadProcessEnv: true,
            isGlobal: false,
        });
        expect(
            normalizeOptions({
                ignoreEnvVars: true,
                cache: false,
                isGlobal: true,
            }),
        ).toMatchObject({
            cache: false,
            loadProcessEnv: false,
            isGlobal: true,
        });
    });

    it("registerAs attaches namespace metadata", () => {
        const databaseConfig = registerAs("database", () => ({
            url: "file:///tmp/app.db",
        }));

        expect(databaseConfig.KEY).toBe("database");
        expect(typeof databaseConfig.TOKEN).toBe("symbol");
        expect(databaseConfig()).toEqual({
            url: "file:///tmp/app.db",
        });
        expect(isConfigFactoryKeyHost(databaseConfig)).toBe(true);
        expect(isConfigFactoryKeyHost(() => ({ plain: true }))).toBe(false);
    });

    it("loads defaults, env vars, plain factories, and merges namespaced factories", () => {
        const previous = process.env.CONFIG_TEST_PORT;
        process.env.CONFIG_TEST_PORT = "3000";

        try {
            const firstDatabaseFactory = registerAs("database", () => ({
                host: "localhost",
            }));
            const secondDatabaseFactory = registerAs("database", () => ({
                port: 5432,
            }));

            const config = loadConfiguration(
                normalizeOptions({
                    defaults: { appName: "Launcher" },
                    load: [
                        () => ({ featureEnabled: true }),
                        firstDatabaseFactory,
                        secondDatabaseFactory,
                    ],
                }),
            );

            expect(config).toMatchObject({
                appName: "Launcher",
                featureEnabled: true,
                CONFIG_TEST_PORT: "3000",
                database: {
                    host: "localhost",
                    port: 5432,
                },
            });
        } finally {
            if (previous === undefined) {
                delete process.env.CONFIG_TEST_PORT;
            } else {
                process.env.CONFIG_TEST_PORT = previous;
            }
        }
    });

    it("skips process.env when env loading is disabled and ignores non-object plain factories", () => {
        const previous = process.env.CONFIG_TEST_DISABLED;
        process.env.CONFIG_TEST_DISABLED = "hidden";
        const invalidFactory = (() => 42) as unknown as ConfigFactory;

        try {
            const config = loadConfiguration(
                normalizeOptions({
                    ignoreEnvVars: true,
                    load: [invalidFactory, () => ({ visible: true })],
                }),
            );

            expect(config).toEqual({
                visible: true,
            });
        } finally {
            if (previous === undefined) {
                delete process.env.CONFIG_TEST_DISABLED;
            } else {
                process.env.CONFIG_TEST_DISABLED = previous;
            }
        }
    });

    it("supports validate, schema.validate, safeParse, parse, and passthrough validation flows", () => {
        const rawConfig = {
            database: {
                url: "file:///tmp/app.db",
            },
        };
        const normalized = normalizeOptions({});

        expect(
            applyValidation(
                {
                    ...normalized,
                    validate: (config) => ({
                        validated: config.database,
                    }),
                },
                rawConfig,
            ),
        ).toEqual({
            validated: rawConfig.database,
        });

        expect(
            applyValidation(
                {
                    ...normalized,
                    validationOptions: { abortEarly: false },
                    validationSchema: {
                        validate: (config, options) => ({
                            error: undefined,
                            value: {
                                validated: config.database,
                                options,
                            },
                        }),
                    },
                },
                rawConfig,
            ),
        ).toEqual({
            validated: rawConfig.database,
            options: { abortEarly: false },
        });

        expect(
            applyValidation(
                {
                    ...normalized,
                    validationSchema: {
                        safeParse: () => ({
                            success: true,
                            data: { parsed: true },
                        }),
                    },
                },
                rawConfig,
            ),
        ).toEqual({
            parsed: true,
        });

        expect(
            applyValidation(
                {
                    ...normalized,
                    validationSchema: {
                        parse: () => ({
                            parsedWithSchema: true,
                        }),
                    },
                },
                rawConfig,
            ),
        ).toEqual({
            parsedWithSchema: true,
        });

        expect(applyValidation(normalized, rawConfig)).toBe(rawConfig);
    });

    it("throws validation errors from schema.validate and safeParse", () => {
        const normalized = normalizeOptions({});

        expect(() =>
            applyValidation(
                {
                    ...normalized,
                    validationSchema: {
                        validate: () => ({
                            error: new Error("schema validate failed"),
                            value: {},
                        }),
                    },
                },
                {},
            ),
        ).toThrow("schema validate failed");

        expect(() =>
            applyValidation(
                {
                    ...normalized,
                    validationSchema: {
                        safeParse: () => ({
                            success: false,
                            error: new Error("safe parse failed"),
                        }),
                    },
                },
                {},
            ),
        ).toThrow("safe parse failed");
    });

    it("builds namespace providers only for registerAs factories", () => {
        const databaseConfig = registerAs("database", () => ({
            url: "file:///tmp/app.db",
        }));
        const providers = buildNamespaceProviders([
            databaseConfig,
            () => ({ plain: true }),
        ]);

        expect(providers).toHaveLength(1);
        expect(providers[0]).toMatchObject({
            provide: databaseConfig.TOKEN,
            inject: [ModuleRef],
        });
    });

    it("namespace provider resolves through ConfigService and throws when root config is missing", () => {
        const databaseConfig = registerAs("database", () => ({
            url: "file:///tmp/app.db",
        }));
        const providers = buildNamespaceProviders([databaseConfig]);
        const provider = providers[0] as unknown as NamespaceProvider;

        const configService = new ConfigService({
            database: {
                url: "file:///tmp/app.db",
            },
        });
        const moduleRefWithConfig = {
            get<T>(token: unknown): T {
                if (token === ConfigService) {
                    return configService as T;
                }
                throw new Error(`Unexpected token: ${String(token)}`);
            },
        } as Pick<ModuleRef, "get">;
        const missingModuleRef = {
            get<T>(): T {
                throw new Error("missing");
            },
        } as Pick<ModuleRef, "get">;

        expect(provider.useFactory(moduleRefWithConfig)).toEqual({
            url: "file:///tmp/app.db",
        });

        expect(() => provider.useFactory(missingModuleRef)).toThrow(
            'ConfigModule.forFeature() requires ConfigModule.forRoot() to be imported before resolving namespace "database".',
        );
    });

    it("supports string tokens in ConfigFactoryKeyHost detection", () => {
        const stringTokenFactory = Object.assign(() => ({ ok: true }), {
            KEY: "custom",
            TOKEN: "custom-token",
        });

        expect(isConfigFactoryKeyHost(stringTokenFactory)).toBe(true);
    });

    it("supports function tokens in ConfigFactoryKeyHost detection", () => {
        function TokenHost(): void {}

        const functionTokenFactory = Object.assign(() => ({ ok: true }), {
            KEY: "custom",
            TOKEN: TokenHost,
        });

        expect(isConfigFactoryKeyHost(functionTokenFactory)).toBe(true);
    });
});
