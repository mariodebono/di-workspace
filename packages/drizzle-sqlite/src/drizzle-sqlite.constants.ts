/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ProviderToken } from "@mariodebono/di";
import type { drizzle } from "drizzle-orm/libsql";
import type { DrizzleSqliteOptions } from "./drizzle-sqlite.options.js";

export const DRIZZLE_SQLITE_MODULE_OPTIONS: ProviderToken<DrizzleSqliteOptions> =
    Symbol("drizzle-sqlite:module-options");

export const DRIZZLE_SQLITE_CLIENT: ProviderToken<ReturnType<typeof drizzle>> =
    Symbol("drizzle-sqlite:client");
