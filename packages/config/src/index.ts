/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export {
    CONFIG_OPTIONS_TOKEN,
    type ConfigFactory,
    type ConfigFactoryKeyHost,
    ConfigModule,
    type ConfigModuleAsyncOptions,
    type ConfigModuleOptions,
    type ConfigType,
    registerAs,
    type ValidationSchema,
} from "./config.module.js";
export {
    type ConfigGetOptions,
    ConfigService,
    type ConfigServiceOptions,
} from "./config.service.js";
export type { ConfigPath, ConfigPathValue } from "./config.types.js";
