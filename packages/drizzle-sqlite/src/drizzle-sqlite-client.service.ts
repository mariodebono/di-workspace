/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Inject, Injectable, type OnModuleDestroy } from "@mariodebono/di";
import type { drizzle } from "drizzle-orm/libsql";
import {
    DRIZZLE_SQLITE_CLIENT,
    DRIZZLE_SQLITE_MODULE_OPTIONS,
} from "./drizzle-sqlite.constants.js";
import type { DrizzleSqliteOptions } from "./drizzle-sqlite.options.js";

/**
 * Injectable wrapper around the resolved Drizzle SQLite client.
 */
@Injectable({ scope: "singleton" })
export class DrizzleSqliteClientService implements OnModuleDestroy {
    /**
     * Create a drizzle-sqlite client service from the resolved module options and client provider.
     * @param {DrizzleSqliteOptions} _options Module options used during provider setup.
     * @param {ReturnType<typeof drizzle>} db Resolved Drizzle client instance.
     */
    constructor(
        @Inject(DRIZZLE_SQLITE_MODULE_OPTIONS)
        _options: DrizzleSqliteOptions,
        @Inject(DRIZZLE_SQLITE_CLIENT)
        private readonly db: ReturnType<typeof drizzle>,
    ) {}

    /**
     * The resolved Drizzle client instance.
     */
    get client(): ReturnType<typeof drizzle> {
        return this.db;
    }

    /**
     * Close the underlying LibSQL client.
     */
    close(): void {
        this.db.$client.close();
    }

    /**
     * Close the database client during module teardown.
     */
    onModuleDestroy(): void {
        this.close();
    }
}
