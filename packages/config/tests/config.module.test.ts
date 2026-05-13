/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createApplication, Inject, Injectable, Module } from "@mariodebono/di";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
    ConfigModule,
    type ConfigType,
    registerAs,
} from "../src/config.module.js";
import { ConfigService } from "../src/config.service.js";
import {
    createConfigService,
    getProvider,
    setCtorParamTypes,
} from "./helpers.js";

describe("ConfigModule", () => {
    it("loads process.env before load factories and allows factories to override", () => {
        const previous = process.env.GODOT_LAUNCHER_FOO;
        process.env.GODOT_LAUNCHER_FOO = "from-process-env";

        try {
            const moduleDef = ConfigModule.forRoot({
                load: [
                    () => ({
                        seenInFactory: process.env.GODOT_LAUNCHER_FOO,
                        GODOT_LAUNCHER_FOO: "from-factory",
                    }),
                ],
            });

            const configService =
                createConfigService<Record<string, unknown>>(moduleDef);

            expect(configService.get("seenInFactory")).toBe("from-process-env");
            expect(configService.get("GODOT_LAUNCHER_FOO")).toBe(
                "from-factory",
            );
        } finally {
            if (previous === undefined) {
                delete process.env.GODOT_LAUNCHER_FOO;
            } else {
                process.env.GODOT_LAUNCHER_FOO = previous;
            }
        }
    });

    it("supports typed dot-path lookups and generic string fallback", () => {
        const databaseConfig = registerAs("database", () => ({
            url: "file:///tmp/app.db",
            pool: {
                maxConnections: 10,
            },
        }));
        const moduleDef = ConfigModule.forRoot({
            load: [databaseConfig],
        });
        const configService = createConfigService<{
            database: ConfigType<typeof databaseConfig>;
        }>(moduleDef);

        const nestedValue = configService.get("database.pool.maxConnections");
        const dynamicKey: string = "database.pool.maxConnections";

        expect(nestedValue).toBe(10);
        expect(configService.getOrThrow("database.url")).toBe(
            "file:///tmp/app.db",
        );
        expect(configService.has("database.pool.maxConnections")).toBe(true);
        expectTypeOf(nestedValue).toEqualTypeOf<number | undefined>();
        expectTypeOf(
            configService.getOrThrow("database.url"),
        ).toEqualTypeOf<string>();
        expectTypeOf(configService.get(dynamicKey)).toEqualTypeOf<
            unknown | undefined
        >();
    });

    it("forFeature exports namespace providers without registering ConfigService", () => {
        const databaseConfig = registerAs("database", () => ({
            fileName: "app.db",
            url: "file:///tmp/app.db",
        }));

        const moduleDef = ConfigModule.forFeature([databaseConfig]);
        const namespaceProvider = getProvider(moduleDef, databaseConfig.TOKEN);

        expect(
            (moduleDef.providers ?? []).some((provider) => {
                return (
                    provider !== null &&
                    typeof provider === "object" &&
                    "provide" in provider &&
                    (
                        provider as {
                            provide: unknown;
                        }
                    ).provide === ConfigService
                );
            }),
        ).toBe(false);
        expect(namespaceProvider).toBeTruthy();
        expect(databaseConfig.TOKEN).not.toBe(databaseConfig.KEY);
    });

    it("supports registerAs namespaces projected from the root ConfigService", async () => {
        const databaseConfig = registerAs("database", () => ({
            fileName: "app.db",
            url: "file:///tmp/app.db",
        }));

        @Injectable()
        class DatabaseConsumer {
            constructor(
                @Inject(databaseConfig.TOKEN)
                readonly database: {
                    fileName: string;
                    url: string;
                },
            ) {}
        }
        setCtorParamTypes(DatabaseConsumer, [Object]);

        @Module({
            imports: [
                ConfigModule.forRoot({ load: [databaseConfig] }),
                ConfigModule.forFeature([databaseConfig]),
            ],
            providers: [DatabaseConsumer],
        })
        class RootModule {}

        const app = await createApplication(RootModule);
        try {
            expect(app.get(DatabaseConsumer).database).toEqual({
                fileName: "app.db",
                url: "file:///tmp/app.db",
            });
            expect(app.get(ConfigService).get("database.url")).toBe(
                "file:///tmp/app.db",
            );
        } finally {
            app.destroy();
        }
    });

    it("supports forRootAsync and preserves root loading behavior", async () => {
        const previous = process.env.GODOT_LAUNCHER_ASYNC;
        process.env.GODOT_LAUNCHER_ASYNC = "from-process-env";

        const asyncLoader = registerAs("asyncConfig", () => ({
            seenInFactory: process.env.GODOT_LAUNCHER_ASYNC,
            value: "from-factory",
        }));

        @Injectable()
        class AsyncConsumer {
            constructor(
                readonly configService: ConfigService,
                @Inject(asyncLoader.TOKEN)
                readonly asyncConfig: {
                    seenInFactory: string;
                    value: string;
                },
            ) {}
        }
        setCtorParamTypes(AsyncConsumer, [ConfigService, Object]);

        @Module({
            imports: [
                ConfigModule.forRootAsync({
                    useFactory: async () => ({
                        load: [asyncLoader],
                    }),
                }),
                ConfigModule.forFeature([asyncLoader]),
            ],
            providers: [AsyncConsumer],
        })
        class RootModule {}

        try {
            const app = await createApplication(RootModule);
            try {
                const consumer = app.get(AsyncConsumer);
                expect(consumer.asyncConfig).toEqual({
                    seenInFactory: "from-process-env",
                    value: "from-factory",
                });
                expect(consumer.configService.get("asyncConfig.value")).toBe(
                    "from-factory",
                );
            } finally {
                app.destroy();
            }
        } finally {
            if (previous === undefined) {
                delete process.env.GODOT_LAUNCHER_ASYNC;
            } else {
                process.env.GODOT_LAUNCHER_ASYNC = previous;
            }
        }
    });

    it("supports forRootAsync validation failures", async () => {
        @Module({
            imports: [
                ConfigModule.forRootAsync({
                    useFactory: async () => ({
                        defaults: { a: 1 },
                        validationSchema: {
                            safeParse: () => ({
                                success: false as const,
                                error: new Error("invalid async config"),
                            }),
                        },
                    }),
                }),
            ],
        })
        class RootModule {}

        await expect(() => createApplication(RootModule)).rejects.toThrow(
            "invalid async config",
        );
    });

    it("preserves validated config output through forRootAsync", async () => {
        @Injectable()
        class SettingsProvider {
            getMaxConnections(): number {
                return 24;
            }
        }

        type AppConfig = {
            database: {
                pool: {
                    maxConnections: number;
                };
            };
        };

        @Injectable()
        class Consumer {
            constructor(readonly configService: ConfigService<AppConfig>) {}
        }
        setCtorParamTypes(Consumer, [ConfigService]);

        @Module({
            providers: [SettingsProvider],
            exports: [SettingsProvider],
        })
        class SettingsModule {}

        @Module({
            imports: [
                SettingsModule,
                ConfigModule.forRootAsync<AppConfig>({
                    imports: [SettingsModule],
                    inject: [SettingsProvider],
                    useFactory: async (settings: SettingsProvider) => ({
                        load: [
                            registerAs("database", () => ({
                                pool: {
                                    maxConnections:
                                        settings.getMaxConnections(),
                                },
                            })),
                        ],
                        validate: (config) => config as AppConfig,
                    }),
                }),
            ],
            providers: [Consumer],
        })
        class RootModule {}

        const app = await createApplication(RootModule);
        try {
            const configService = app.get(Consumer).configService;
            expect(
                configService.getOrThrow("database.pool.maxConnections"),
            ).toBe(24);
            expectTypeOf(
                configService.getOrThrow("database.pool.maxConnections"),
            ).toEqualTypeOf<number>();
        } finally {
            app.destroy();
        }
    });

    it("throws a clear error when forFeature is used without forRoot", async () => {
        const databaseConfig = registerAs("database", () => ({
            fileName: "app.db",
        }));

        @Injectable()
        class DatabaseConsumer {
            constructor(
                @Inject(databaseConfig.TOKEN)
                readonly database: {
                    fileName: string;
                },
            ) {}
        }
        setCtorParamTypes(DatabaseConsumer, [Object]);

        @Module({
            imports: [ConfigModule.forFeature([databaseConfig])],
            providers: [DatabaseConsumer],
        })
        class RootModule {}

        await expect(() => createApplication(RootModule)).rejects.toThrow(
            'ConfigModule.forFeature() requires ConfigModule.forRoot() to be imported before resolving namespace "database".',
        );
    });

    it("allows multiple forFeature imports to project different namespaces", async () => {
        const databaseConfig = registerAs("database", () => ({
            fileName: "app.db",
        }));
        const authConfig = registerAs("auth", () => ({
            issuer: "godot-launcher",
        }));

        @Injectable()
        class NamespaceConsumer {
            constructor(
                @Inject(databaseConfig.TOKEN)
                readonly database: {
                    fileName: string;
                },
                @Inject(authConfig.TOKEN)
                readonly auth: {
                    issuer: string;
                },
            ) {}
        }
        setCtorParamTypes(NamespaceConsumer, [Object, Object]);

        @Module({
            imports: [
                ConfigModule.forRoot({ load: [databaseConfig, authConfig] }),
                ConfigModule.forFeature([databaseConfig]),
                ConfigModule.forFeature([authConfig]),
            ],
            providers: [NamespaceConsumer],
        })
        class RootModule {}

        const app = await createApplication(RootModule);
        try {
            expect(app.get(NamespaceConsumer)).toMatchObject({
                database: { fileName: "app.db" },
                auth: { issuer: "godot-launcher" },
            });
        } finally {
            app.destroy();
        }
    });

    it("namespace providers still throw when the root config key is missing", async () => {
        const databaseConfig = registerAs("database", () => ({
            fileName: "app.db",
        }));

        @Injectable()
        class DatabaseConsumer {
            constructor(
                @Inject(databaseConfig.TOKEN)
                readonly database: {
                    fileName: string;
                },
            ) {}
        }
        setCtorParamTypes(DatabaseConsumer, [Object]);

        @Module({
            imports: [
                ConfigModule.forRoot({
                    load: [() => ({ unrelated: true })],
                }),
                ConfigModule.forFeature([databaseConfig]),
            ],
            providers: [DatabaseConsumer],
        })
        class RootModule {}

        await expect(() => createApplication(RootModule)).rejects.toThrow(
            'Configuration key "database" not found. Verify the namespace/path exists in the root config.',
        );
    });

    it("no longer exposes namespace projection providers under KEY tokens", async () => {
        const databaseConfig = registerAs("database", () => ({
            fileName: "app.db",
        }));

        @Injectable()
        class InvalidKeyConsumer {
            constructor(
                @Inject(databaseConfig.KEY)
                readonly database: {
                    fileName: string;
                },
            ) {}
        }
        setCtorParamTypes(InvalidKeyConsumer, [Object]);

        @Module({
            imports: [
                ConfigModule.forRoot({ load: [databaseConfig] }),
                ConfigModule.forFeature([databaseConfig]),
            ],
            providers: [InvalidKeyConsumer],
        })
        class RootModule {}

        await expect(() => createApplication(RootModule)).rejects.toThrow(
            /No provider for database/,
        );
    });

    it("supports empty forFeature imports", () => {
        const moduleDef = ConfigModule.forFeature();

        expect(moduleDef.providers).toEqual([]);
        expect(moduleDef.exports).toEqual([]);
    });
});
