/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import {
    findProvider,
    type TestFactoryProvider,
    type TestValueProvider,
} from "../../../tests/helpers/di.js";
import { AppMigration } from "../src/app-migration.decorator.js";
import { AppMigrationExecutionError } from "../src/app-migration.error.js";
import {
    APP_MIGRATION_STORE,
    APP_MIGRATIONS_MODULE_OPTIONS,
    APP_MIGRATIONS_RUNNER,
} from "../src/app-migrations.constants.js";
import { AppMigrationsModule } from "../src/app-migrations.module.js";
import {
    createAppMigrationStoreProvider,
    createAppMigrationsRunnerProvider,
} from "../src/app-migrations.providers.js";

function createLogger() {
    const scoped = {
        debug: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
    };

    return {
        scoped,
        logger: {
            withContext: vi.fn().mockReturnValue(scoped),
        },
    };
}

describe("AppMigrationsModule", () => {
    it("creates sync and async dynamic module definitions", async () => {
        class StoreService {
            async listCompletedMigrationIds(): Promise<string[]> {
                return [];
            }

            async markCompleted(): Promise<void> {}
        }

        const syncModule = AppMigrationsModule.forRoot({
            store: StoreService,
        });
        const asyncModule = AppMigrationsModule.forRootAsync({
            imports: [class SettingsModule {}],
            inject: ["SETTINGS"],
            store: "STORE_TOKEN",
            useFactory: async () => ({
                enabled: false,
            }),
        });

        expect(syncModule.module).toBe(AppMigrationsModule);
        expect(syncModule.providers).toContain(StoreService);
        expect(syncModule.exports).toEqual([APP_MIGRATIONS_RUNNER]);
        expect(
            findProvider<TestValueProvider>(
                syncModule.providers,
                APP_MIGRATIONS_MODULE_OPTIONS,
            ).useValue,
        ).toEqual({ store: StoreService });

        const asyncOptionsProvider = findProvider<
            TestFactoryProvider<Promise<unknown>>
        >(asyncModule.providers, APP_MIGRATIONS_MODULE_OPTIONS);
        expect(asyncModule.imports).toHaveLength(1);
        expect(asyncOptionsProvider.inject).toEqual(["SETTINGS"]);
        await expect(asyncOptionsProvider.useFactory()).resolves.toEqual({
            enabled: false,
            imports: asyncModule.imports,
            store: "STORE_TOKEN",
        });
    });

    it("aliases the configured store token", () => {
        const provider = createAppMigrationStoreProvider("STORE_TOKEN");
        const store = {
            listCompletedMigrationIds: vi.fn(),
            markCompleted: vi.fn(),
        };

        expect(provider).toMatchObject({
            provide: APP_MIGRATION_STORE,
            inject: ["STORE_TOKEN"],
        });
        expect((provider as TestFactoryProvider).useFactory(store)).toBe(store);
    });

    it("runs pending migrations, skips completed migrations, and journals successes", async () => {
        const executePending = vi.fn();
        const executeCompleted = vi.fn();

        @AppMigration({ id: "20260417142000-completed" })
        class CompletedMigration {
            async execute(): Promise<void> {
                executeCompleted();
            }
        }

        @AppMigration({ id: "20260417143000-pending" })
        class PendingMigration {
            async execute(): Promise<void> {
                executePending();
            }
        }

        const { logger } = createLogger();
        const store = {
            listCompletedMigrationIds: vi
                .fn()
                .mockResolvedValue(["20260417142000-completed"]),
            markCompleted: vi.fn().mockResolvedValue(undefined),
        };
        const moduleRef = {
            findByTag: vi
                .fn()
                .mockReturnValue([PendingMigration, CompletedMigration]),
            resolve: vi.fn(async (token: unknown) => {
                if (token === PendingMigration) {
                    return new PendingMigration();
                }
                return new CompletedMigration();
            }),
        };

        const runner =
            createAppMigrationsRunnerProvider() as TestFactoryProvider<
                Promise<boolean>
            >;

        await expect(
            runner.useFactory(
                { store: "STORE_TOKEN" },
                moduleRef,
                logger,
                store,
            ),
        ).resolves.toBe(true);

        expect(executeCompleted).not.toHaveBeenCalled();
        expect(executePending).toHaveBeenCalledOnce();
        expect(store.markCompleted).toHaveBeenCalledWith(
            "20260417143000-pending",
            expect.any(Date),
        );
    });

    it("handles disabled, fatal, and non-fatal runner paths", async () => {
        const { logger, scoped } = createLogger();
        const store = {
            listCompletedMigrationIds: vi.fn().mockResolvedValue([]),
            markCompleted: vi.fn().mockResolvedValue(undefined),
        };
        const runner =
            createAppMigrationsRunnerProvider() as TestFactoryProvider<
                Promise<boolean>
            >;

        await expect(
            runner.useFactory(
                { enabled: false, store: "STORE_TOKEN" },
                { findByTag: vi.fn() },
                logger,
                store,
            ),
        ).resolves.toBe(true);
        expect(scoped.log).toHaveBeenCalledWith(
            "App migrations are disabled. Skipping.",
        );

        @AppMigration({ id: "20260417145000-fatal" })
        class FatalMigration {
            async execute(): Promise<void> {
                throw new Error("boom");
            }
        }

        const fatalModuleRef = {
            findByTag: vi.fn().mockReturnValue([FatalMigration]),
            resolve: vi.fn(async () => new FatalMigration()),
        };

        await expect(
            runner.useFactory(
                { store: "STORE_TOKEN" },
                fatalModuleRef,
                logger,
                store,
            ),
        ).rejects.toBeInstanceOf(AppMigrationExecutionError);

        @AppMigration({ fatal: false, id: "20260417146000-non-fatal" })
        class NonFatalMigration {
            async execute(): Promise<void> {
                throw new Error("recoverable");
            }
        }

        const nonFatalModuleRef = {
            findByTag: vi.fn().mockReturnValue([NonFatalMigration]),
            resolve: vi.fn(async () => new NonFatalMigration()),
        };

        await expect(
            runner.useFactory(
                { store: "STORE_TOKEN" },
                nonFatalModuleRef,
                logger,
                store,
            ),
        ).resolves.toBe(true);
        expect(scoped.warn).toHaveBeenCalledWith(
            'Non-fatal app migration "20260417146000-non-fatal" failed. Continuing startup.',
            expect.any(Error),
        );
    });
});
