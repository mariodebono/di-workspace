/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            {
                find: /^@mariodebono\/di$/,
                replacement: `${workspaceRoot}packages/di/src/index.ts`,
            },
            {
                find: /^@mariodebono\/di-electron$/,
                replacement: `${workspaceRoot}packages/electron/src/index.ts`,
            },
            {
                find: /^@mariodebono\/di-electron\/renderer$/,
                replacement: `${workspaceRoot}packages/electron/src/renderer/index.ts`,
            },
            {
                find: /^@mariodebono\/di-config$/,
                replacement: `${workspaceRoot}packages/config/src/index.ts`,
            },
            {
                find: /^@mariodebono\/di-app-migrations$/,
                replacement: `${workspaceRoot}packages/app-migrations/src/index.ts`,
            },
            {
                find: /^@mariodebono\/di-drizzle-sqlite$/,
                replacement: `${workspaceRoot}packages/drizzle-sqlite/src/index.ts`,
            },
            {
                find: /^@mariodebono\/di-electron-i18n$/,
                replacement: `${workspaceRoot}packages/electron-i18n/src/index.ts`,
            },
            {
                find: /^@mariodebono\/di-electron-i18n\/renderer$/,
                replacement: `${workspaceRoot}packages/electron-i18n/src/renderer.ts`,
            },
        ],
    },
    test: {
        globals: true,
        environment: "node",
        exclude: [
            "node_modules",
            "**/node_modules/**",
            "**/fixtures/**",
            "**/dist/**",
        ],
        coverage: {
            clean: true,
            provider: "v8",
            include: ["**/src/**/*.ts"],
            exclude: [
                "**/src/**/*.test.ts",
                "**/src/index.ts",
                "**/src/**/index.ts",
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 70,
                statements: 70,
            },
        },
    },
});
