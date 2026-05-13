/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { defineConfig } from "tsdown";

const licenseIdentifier = "MPL-2.0";
const licenseBanner = `/*
 * SPDX-License-Identifier: ${licenseIdentifier}
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
`;

export default defineConfig([
    {
        entry: {
            index: "./src/index.ts",
            renderer: "./src/renderer/index.ts",
        },
        format: "esm",
        dts: true,
        clean: true,
        exports: true,
        banner: {
            js: licenseBanner,
            dts: licenseBanner,
        },
    },
    {
        entry: {
            preload: "./src/preload.ts",
        },
        format: "cjs",
        dts: false,
        clean: false,
        exports: false,
        banner: {
            js: licenseBanner,
        },
    },
]);
