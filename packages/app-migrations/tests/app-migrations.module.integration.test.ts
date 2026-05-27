/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createApplication, Injectable, Module } from "@mariodebono/di";
import { describe, expect, it, vi } from "vitest";
import { AppMigration } from "../src/app-migration.decorator.js";
import { AppMigrationExecutionError } from "../src/app-migration.error.js";
import {
    APP_MIGRATION_TAG,
    APP_MIGRATIONS_RUNNER,
} from "../src/app-migrations.constants.js";
import { AppMigrationsModule } from "../src/app-migrations.module.js";
import { createRootModule, createStoreMock } from "./helpers.js";

function createLoggerMock() {
    const logger = {
        withContext: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
        fatal: vi.fn(),
        setLogLevels: vi.fn(),
    };
    logger.withContext.mockReturnValue(logger);
    return logger;
}

describe("AppMigrationsModule", () => {
    it("creates the expected dynamic module shape for store constructors and tokens", () => {
        @Injectable()
        class StoreService {
            async listCompletedMigrationIds(): Promise<string[]> {
                return [];
            }

            async markCompleted(): Promise<void> {}
        }

        const STORE_TOKEN = Symbol("store-token");
        const forRootDef = AppMigrationsModule.forRoot({
            store: STORE_TOKEN,
        });
        const forRootAsyncDef = AppMigrationsModule.forRootAsync({
            store: StoreService,
            useFactory: async () => ({
                enabled: true,
            }),
        });

        expect(forRootDef.providers).not.toContain(STORE_TOKEN);
        expect(forRootDef.exports).toContain(APP_MIGRATIONS_RUNNER);
        expect(forRootAsyncDef.providers).toContain(StoreService);
        expect(forRootAsyncDef.exports).toContain(APP_MIGRATIONS_RUNNER);
    });

    it("waits for app migrations before bootstrap resolves", async () => {
        const { store } = createStoreMock();
        let resolveMigration: (() => void) | undefined;

        @AppMigration({ id: "20260417140000-wait" })
        class WaitMigration {
            async execute(): Promise<void> {
                await new Promise<void>((resolve) => {
                    resolveMigration = resolve;
                });
            }
        }

        @Module({
            providers: [WaitMigration],
        })
        class FeatureModule {}

        let settled = false;
        const appPromise = createApplication(
            createRootModule(FeatureModule, store),
            {
                logger: false,
            },
        )
            .then((app) => {
                settled = true;
                return app;
            })
            .catch((error) => {
                settled = true;
                throw error;
            });

        await vi.waitFor(() => {
            expect(resolveMigration).toBeTypeOf("function");
        });
        expect(settled).toBe(false);

        resolveMigration?.();
        const app = await appPromise;
        app.destroy();
    });

    it("skips completed migrations", async () => {
        const { store, inserted } = createStoreMock([
            "20260417141000-completed",
        ]);
        const execute = vi.fn();

        @AppMigration({ id: "20260417141000-completed" })
        class CompletedMigration {
            async execute(): Promise<void> {
                execute();
            }
        }

        @Module({
            providers: [CompletedMigration],
        })
        class FeatureModule {}

        const app = await createApplication(
            createRootModule(FeatureModule, store),
            {
                logger: false,
            },
        );

        try {
            expect(execute).not.toHaveBeenCalled();
            expect(inserted).toEqual([]);
        } finally {
            app.destroy();
        }
    });

    it("runs pending migrations in ascending id order and journals successes", async () => {
        const { store, inserted } = createStoreMock();
        const callOrder: string[] = [];

        @AppMigration({ id: "20260417143000-second" })
        class SecondMigration {
            async execute(): Promise<void> {
                callOrder.push("second");
            }
        }

        @AppMigration({ id: "20260417142000-first" })
        class FirstMigration {
            async execute(): Promise<void> {
                callOrder.push("first");
            }
        }

        @Module({
            providers: [SecondMigration, FirstMigration],
        })
        class FeatureModule {}

        const app = await createApplication(
            createRootModule(FeatureModule, store),
            {
                logger: false,
            },
        );

        try {
            expect(callOrder).toEqual(["first", "second"]);
            expect(inserted.map((row) => row.id)).toEqual([
                "20260417142000-first",
                "20260417143000-second",
            ]);
        } finally {
            app.destroy();
        }
    });

    it("fails bootstrap when duplicate migration ids are registered", async () => {
        const { store } = createStoreMock();

        @AppMigration({ id: "20260417144000-duplicate" })
        class FirstDuplicateMigration {
            async execute(): Promise<void> {}
        }

        @AppMigration({ id: "20260417144000-duplicate" })
        class SecondDuplicateMigration {
            async execute(): Promise<void> {}
        }

        @Module({
            providers: [FirstDuplicateMigration, SecondDuplicateMigration],
        })
        class FeatureModule {}

        await expect(
            createApplication(createRootModule(FeatureModule, store), {
                logger: false,
            }),
        ).rejects.toThrow("Duplicate app migration id(s) found");
    });

    it("throws a fatal migration execution error when a migration fails", async () => {
        const { store, inserted } = createStoreMock();

        @AppMigration({ id: "20260417145000-fatal" })
        class FatalMigration {
            async execute(): Promise<void> {
                throw new Error("boom");
            }
        }

        @Module({
            providers: [FatalMigration],
        })
        class FeatureModule {}

        await expect(
            createApplication(createRootModule(FeatureModule, store), {
                logger: false,
            }),
        ).rejects.toMatchObject({
            name: AppMigrationExecutionError.name,
            migrationId: "20260417145000-fatal",
        });
        expect(inserted).toEqual([]);
    });

    it("logs and continues for non-fatal migration failures", async () => {
        const { store, inserted } = createStoreMock();
        const logger = createLoggerMock();
        const successfulExecute = vi.fn();

        @AppMigration({
            id: "20260417146000-non-fatal",
            fatal: false,
        })
        class NonFatalMigration {
            async execute(): Promise<void> {
                throw new Error("soft failure");
            }
        }

        @AppMigration({ id: "20260417147000-success" })
        class SuccessfulMigration {
            async execute(): Promise<void> {
                successfulExecute();
            }
        }

        @Module({
            providers: [NonFatalMigration, SuccessfulMigration],
        })
        class FeatureModule {}

        const app = await createApplication(
            createRootModule(FeatureModule, store),
            {
                logger,
            },
        );

        try {
            expect(successfulExecute).toHaveBeenCalledOnce();
            expect(inserted.map((row) => row.id)).toEqual([
                "20260417147000-success",
            ]);
            expect(logger.warn).toHaveBeenCalledWith(
                'Non-fatal app migration "20260417146000-non-fatal" failed. Continuing startup.',
                expect.any(Error),
            );
        } finally {
            app.destroy();
        }
    });

    it("skips migration discovery and store reads when disabled", async () => {
        const { store, inserted } = createStoreMock();
        const logger = createLoggerMock();
        const execute = vi.fn();

        @AppMigration({ id: "20260417148000-disabled" })
        class DisabledMigration {
            async execute(): Promise<void> {
                execute();
            }
        }

        @Module({
            providers: [DisabledMigration],
        })
        class FeatureModule {}

        const app = await createApplication(
            createRootModule(FeatureModule, store, {
                enabled: false,
            }),
            {
                logger,
            },
        );

        try {
            expect(execute).not.toHaveBeenCalled();
            expect(store.listCompletedMigrationIds).not.toHaveBeenCalled();
            expect(inserted).toEqual([]);
            expect(logger.log).toHaveBeenCalledWith(
                "App migrations are disabled. Skipping.",
            );
        } finally {
            app.destroy();
        }
    });

    it("logs when no app migrations are registered", async () => {
        const { store } = createStoreMock();
        const logger = createLoggerMock();

        @Module({})
        class FeatureModule {}

        const app = await createApplication(
            createRootModule(FeatureModule, store),
            {
                logger,
            },
        );

        try {
            expect(store.listCompletedMigrationIds).toHaveBeenCalledOnce();
            expect(logger.log).toHaveBeenCalledWith(
                "No app migrations registered.",
            );
        } finally {
            app.destroy();
        }
    });

    it("fails when a tagged provider is missing migration metadata", async () => {
        const { store } = createStoreMock();

        @Injectable({
            tags: [APP_MIGRATION_TAG],
        })
        class TaggedOnlyProvider {
            async execute(): Promise<void> {}
        }

        @Module({
            providers: [TaggedOnlyProvider],
        })
        class FeatureModule {}

        await expect(
            createApplication(createRootModule(FeatureModule, store), {
                logger: false,
            }),
        ).rejects.toThrow(
            'Tagged app migration provider "TaggedOnlyProvider" is missing migration metadata.',
        );
    });

    it("propagates store read failures", async () => {
        const failure = new Error("store read failed");
        const { store } = createStoreMock([], {
            listError: failure,
        });

        @Module({})
        class FeatureModule {}

        await expect(
            createApplication(createRootModule(FeatureModule, store), {
                logger: false,
            }),
        ).rejects.toThrow("store read failed");
    });

    it("treats markCompleted failures as fatal", async () => {
        const { store, inserted } = createStoreMock([], {
            markError: new Error("journal write failed"),
        });
        const execute = vi.fn();

        @AppMigration({ id: "20260417149000-journal" })
        class JournaledMigration {
            async execute(): Promise<void> {
                execute();
            }
        }

        @Module({
            providers: [JournaledMigration],
        })
        class FeatureModule {}

        await expect(
            createApplication(createRootModule(FeatureModule, store), {
                logger: false,
            }),
        ).rejects.toMatchObject({
            name: AppMigrationExecutionError.name,
            migrationId: "20260417149000-journal",
        });
        expect(execute).toHaveBeenCalledOnce();
        expect(inserted).toEqual([]);
    });

    it("supports async root configuration and store provider tokens", async () => {
        const { store, inserted } = createStoreMock();
        const execute = vi.fn();
        const STORE_TOKEN = Symbol("store-token");

        @Injectable()
        class SettingsProvider {
            migrationsEnabled(): boolean {
                return true;
            }
        }

        @Injectable()
        class StoreService {
            async listCompletedMigrationIds(): Promise<string[]> {
                return store.listCompletedMigrationIds();
            }

            async markCompleted(id: string, executedAt: Date): Promise<void> {
                return store.markCompleted(id, executedAt);
            }
        }

        @AppMigration({ id: "20260417150000-async" })
        class AsyncMigration {
            async execute(): Promise<void> {
                execute();
            }
        }

        @Module({
            providers: [SettingsProvider],
            exports: [SettingsProvider],
        })
        class SettingsModule {}

        @Module({
            providers: [
                StoreService,
                {
                    provide: STORE_TOKEN,
                    useFactory: (storeService: StoreService) => storeService,
                    inject: [StoreService],
                },
                AsyncMigration,
            ],
            exports: [STORE_TOKEN],
        })
        class FeatureModule {}

        @Module({
            imports: [
                SettingsModule,
                FeatureModule,
                AppMigrationsModule.forRootAsync({
                    imports: [SettingsModule, FeatureModule],
                    inject: [SettingsProvider],
                    store: STORE_TOKEN,
                    useFactory: async (settings: SettingsProvider) => ({
                        enabled: settings.migrationsEnabled(),
                    }),
                }),
            ],
        })
        class RootModule {}

        const app = await createApplication(RootModule, {
            logger: false,
        });

        try {
            expect(execute).toHaveBeenCalledOnce();
            expect(inserted.map((row) => row.id)).toEqual([
                "20260417150000-async",
            ]);
        } finally {
            app.destroy();
        }
    });
});
