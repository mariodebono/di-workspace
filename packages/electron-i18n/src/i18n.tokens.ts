/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ProviderToken } from "@mariodebono/di";
import type { I18nModuleOptions } from "./index.js";

/**
 * DI token used to inject i18n module options.
 */
export const I18N_MODULE_OPTIONS: ProviderToken<I18nModuleOptions> = Symbol(
    "i18n:module-options",
);
