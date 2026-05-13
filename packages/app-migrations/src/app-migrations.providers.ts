/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Logger, ModuleRef, type Provider } from "@mariodebono/di";
import { AppMigrationExecutionError } from "./app-migration.error.js";
import type { AppMigrationStore } from "./app-migration.store.js";
import type { AppMigrationRunnable } from "./app-migration.types.js";
import {
    APP_MIGRATION_STORE,
    APP_MIGRATION_TAG,
    APP_MIGRATIONS_MODULE_OPTIONS,
    APP_MIGRATIONS_RUNNER,
} from "./app-migrations.constants.js";
import type { AppMigrationsOptions } from "./app-migrations.options.js";
import { getRegisteredMigrations } from "./app-migrations.registry.js";

/**
 * Creates the internal provider that aliases the configured store token.
 * @param {AppMigrationsOptions["store"]} storeToken Store provider token or constructor.
 * @returns {Provider<AppMigrationStore>} Alias provider for the migration store.
 */
export function createAppMigrationStoreProvider(
    storeToken: AppMigrationsOptions["store"],
): Provider<AppMigrationStore> {
    return {
        provide: APP_MIGRATION_STORE,
        useFactory: (store: AppMigrationStore) => store,
        inject: [storeToken],
    };
}

/**
 * Creates the internal provider that discovers and executes pending migrations.
 * @returns {Provider<boolean>} Runner provider that resolves when migrations complete.
 */
export function createAppMigrationsRunnerProvider(): Provider<boolean> {
    return {
        provide: APP_MIGRATIONS_RUNNER,
        useFactory: async (
            options: AppMigrationsOptions,
            moduleRef: ModuleRef,
            logger: Logger,
            store: AppMigrationStore,
        ): Promise<boolean> => {
            const scopedLogger = logger.withContext("AppMigrationsModule");

            if (options.enabled === false) {
                scopedLogger.log("App migrations are disabled. Skipping.");
                return true;
            }

            const completedMigrationIds = new Set(
                await store.listCompletedMigrationIds(),
            );
            const registeredTokens = moduleRef.findByTag(APP_MIGRATION_TAG);
            const migrations = getRegisteredMigrations(registeredTokens);

            if (migrations.length === 0) {
                scopedLogger.log("No app migrations registered.");
                return true;
            }

            scopedLogger.log("Starting app migrations...");

            for (const migration of migrations) {
                if (completedMigrationIds.has(migration.id)) {
                    scopedLogger.debug?.(
                        `Skipping completed app migration "${migration.id}".`,
                    );
                    continue;
                }

                const instance = (await moduleRef.resolve(
                    migration.token,
                )) as AppMigrationRunnable;

                scopedLogger.log(`Running app migration "${migration.id}"...`);

                try {
                    await instance.execute();
                    await store.markCompleted(migration.id, new Date());
                    scopedLogger.log(
                        `App migration "${migration.id}" completed successfully.`,
                    );
                } catch (error) {
                    if (migration.fatal !== false) {
                        scopedLogger.error(
                            `Fatal app migration "${migration.id}" failed.`,
                            error,
                        );
                        throw new AppMigrationExecutionError(
                            migration.id,
                            error,
                        );
                    }

                    scopedLogger.warn(
                        `Non-fatal app migration "${migration.id}" failed. Continuing startup.`,
                        error,
                    );
                }
            }

            scopedLogger.log("App migrations completed.");
            return true;
        },
        inject: [
            APP_MIGRATIONS_MODULE_OPTIONS,
            ModuleRef,
            Logger,
            APP_MIGRATION_STORE,
        ],
    };
}
