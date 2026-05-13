/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        exclude: ["node_modules", "**/fixtures/**", "**/dist/**"],
        coverage: {
            clean: true,
            provider: "v8",
            include: ["**/src/**/*.ts"],
            exclude: ["**/src/**/*.test.ts"],
            thresholds: {
                perFile: true,
                lines: 70,
                functions: 70,
                branches: 70,
                statements: 70,
            },
        },
    },
});
