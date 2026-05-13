/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
    Constructor,
    FactoryProvider,
    ModuleImport,
    ProviderToken,
} from "@mariodebono/di";
import type { AppMigrationStore } from "./app-migration.store.js";

/**
 * Synchronous options for `AppMigrationsModule.forRoot()`.
 */
export interface AppMigrationsOptions {
    enabled?: boolean;
    imports?: ModuleImport[];
    store: Constructor<AppMigrationStore> | ProviderToken<AppMigrationStore>;
}

/**
 * Asynchronous options for `AppMigrationsModule.forRootAsync()`.
 */
export interface AppMigrationsAsyncOptions {
    imports?: ModuleImport[];
    store: Constructor<AppMigrationStore> | ProviderToken<AppMigrationStore>;
    inject?: ProviderToken[];
    useFactory: FactoryProvider<
        Omit<AppMigrationsOptions, "imports" | "store">
    >["useFactory"];
}
