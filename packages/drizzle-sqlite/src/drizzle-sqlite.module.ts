/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createClient } from "@libsql/client";
import { type DynamicModule, Logger, Module } from "@mariodebono/di";
import { drizzle } from "drizzle-orm/libsql";
import { migrate as runMigrations } from "drizzle-orm/libsql/migrator";
import {
    DRIZZLE_SQLITE_CLIENT,
    DRIZZLE_SQLITE_MODULE_OPTIONS,
} from "./drizzle-sqlite.constants.js";
import type {
    DrizzleSqliteAsyncOptions,
    DrizzleSqliteOptions,
} from "./drizzle-sqlite.options.js";
import { DrizzleSqliteClientService } from "./drizzle-sqlite-client.service.js";

/**
 * DI module that creates a Drizzle SQLite client and optionally runs migrations.
 */
@Module({})
export class DrizzleSqliteModule {
    /**
     * Register the drizzle-sqlite module with a synchronous options object.
     * @param {DrizzleSqliteOptions} options Database connection and migration settings.
     * @returns {DynamicModule} Dynamic module definition for the database provider.
     */
    static forRoot(options: DrizzleSqliteOptions): DynamicModule {
        return {
            module: DrizzleSqliteModule,
            imports: [],
            providers: [
                {
                    provide: DRIZZLE_SQLITE_MODULE_OPTIONS,
                    useValue: options,
                },
                createDrizzleSqliteClientProvider(),
                DrizzleSqliteClientService,
            ],
            exports: [DrizzleSqliteClientService],
        };
    }

    /**
     * Register the drizzle-sqlite module with asynchronously resolved options.
     * @param {DrizzleSqliteAsyncOptions} options Async module setup options.
     * @returns {DynamicModule} Dynamic module definition for the database provider.
     */
    static forRootAsync(options: DrizzleSqliteAsyncOptions): DynamicModule {
        return {
            module: DrizzleSqliteModule,
            imports: options.imports ?? [],
            providers: [
                {
                    provide: DRIZZLE_SQLITE_MODULE_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject ?? [],
                },
                createDrizzleSqliteClientProvider(),
                DrizzleSqliteClientService,
            ],
            exports: [DrizzleSqliteClientService],
        };
    }
}

function createDrizzleSqliteClientProvider() {
    return {
        provide: DRIZZLE_SQLITE_CLIENT,
        useFactory: async (options: DrizzleSqliteOptions, logger: Logger) => {
            const scopedLogger = logger.withContext(DrizzleSqliteModule.name);
            const client = createClient(options);
            const db = drizzle({ client });

            if (!options.autoMigrate) {
                return db;
            }

            if (!options.migrationDir) {
                scopedLogger.warn(
                    "Auto-migration is enabled but no migration directory is specified. Skipping migrations.",
                );
                return db;
            }

            scopedLogger.log("Starting drizzle-sqlite migrations...");
            try {
                await runMigrations(db, {
                    migrationsFolder: options.migrationDir,
                    migrationsTable:
                        options.migrationTableName ?? "__database_migrations__",
                });
                scopedLogger.log(
                    "Drizzle SQLite migrations completed successfully.",
                );
                return db;
            } catch (error) {
                scopedLogger.error(
                    "Error during drizzle-sqlite migration:",
                    error instanceof Error ? error.message : error,
                );
                client.close();
                throw error;
            }
        },
        inject: [DRIZZLE_SQLITE_MODULE_OPTIONS, Logger],
    };
}
