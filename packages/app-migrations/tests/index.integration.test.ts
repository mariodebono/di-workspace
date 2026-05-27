/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import * as migrations from "../src/index.js";

describe("package exports", () => {
    it("re-exports the intended public api only", () => {
        expect(typeof migrations.AppMigration).toBe("function");
        expect(typeof migrations.AppMigrationsModule.forRoot).toBe("function");
        expect(typeof migrations.AppMigrationExecutionError).toBe("function");
        expect("APP_MIGRATIONS_RUNNER" in migrations).toBe(false);
        expect("APP_MIGRATION_STORE" in migrations).toBe(false);
        expect("APP_MIGRATION_TAG" in migrations).toBe(false);
    });
});
