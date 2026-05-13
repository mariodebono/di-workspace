/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ProviderToken } from "@mariodebono/di";
import type { AppMigrationStore } from "./app-migration.store.js";
import type { AppMigrationsOptions } from "./app-migrations.options.js";

/** Internal provider tag used to discover registered app migrations. */
export const APP_MIGRATION_TAG = Symbol("app:migrations:migration");
/** Internal metadata key used by the `@AppMigration()` decorator. */
export const APP_MIGRATION_METADATA_KEY = Symbol("app:migrations:metadata");
/** Internal token for normalized module options. */
export const APP_MIGRATIONS_MODULE_OPTIONS: ProviderToken<AppMigrationsOptions> =
    Symbol("app:migrations:module-options");
/** Internal runner token exported by the dynamic module. */
export const APP_MIGRATIONS_RUNNER = Symbol("app:migrations:runner");
/** Internal token for the resolved migration store. */
export const APP_MIGRATION_STORE: ProviderToken<AppMigrationStore> = Symbol(
    "app:migrations:store",
);
