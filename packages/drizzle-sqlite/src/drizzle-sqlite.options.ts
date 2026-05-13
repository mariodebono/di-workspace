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

/**
 * Options used to configure the Drizzle SQLite client.
 */
export interface DrizzleSqliteOptions {
    /**
     * SQLite connection URL passed to `@libsql/client`.
     */
    url: string;
    /**
     * When true, run migrations before the database provider resolves.
     */
    autoMigrate?: boolean;
    /**
     * Directory containing generated Drizzle migration files.
     */
    migrationDir?: string;
    /**
     * Optional migration table name. Defaults to `__database_migrations__`.
     */
    migrationTableName?: string;
}

/**
 * Async registration options for `DrizzleSqliteModule.forRootAsync()`.
 */
export interface DrizzleSqliteAsyncOptions {
    /**
     * Imported modules needed to resolve the factory dependencies.
     */
    imports?: ModuleImport[];
    /**
     * Provider tokens injected into the `useFactory` callback.
     */
    inject?: ProviderToken[];
    /**
     * Factory that returns the module options.
     */
    useFactory: FactoryProvider<DrizzleSqliteOptions>["useFactory"];
}
