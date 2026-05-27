/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import {
    CONFIG_OPTIONS_TOKEN,
    ConfigModule,
    ConfigService,
    registerAs,
} from "../src/index.js";

describe("package exports", () => {
    it("re-exports the public runtime api from the package entrypoint", () => {
        const databaseConfig = registerAs("database", () => ({
            url: "file:///tmp/app.db",
        }));

        expect(typeof ConfigModule.forRoot).toBe("function");
        expect(typeof ConfigService).toBe("function");
        expect(typeof registerAs).toBe("function");
        expect(typeof CONFIG_OPTIONS_TOKEN).toBe("symbol");
        expect(databaseConfig.KEY).toBe("database");
    });
});
