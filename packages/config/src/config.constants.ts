/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ProviderToken } from "@mariodebono/di";

/** Provider token used for normalized root config module options. */
export const CONFIG_OPTIONS_TOKEN: ProviderToken = Symbol("config:options");
/** Provider token used for the assembled and validated root config object. */
export const CONFIG_ROOT_DATA_TOKEN: ProviderToken = Symbol("config:root-data");
