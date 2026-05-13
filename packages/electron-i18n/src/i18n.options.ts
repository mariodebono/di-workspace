/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ModuleImport, ProviderToken } from "@mariodebono/di";

/**
 * Required configuration for bootstrapping the i18n module/service.
 */
export interface I18nModuleOptions {
    localesRoot: string;
    supportedLocales: string[];
    namespaces: string[];
    fallbackLocale: string;
    initialLocale: string;
    systemLocale: string;
}

/**
 * Async registration options for `I18nModule.forRootAsync(...)`.
 */
export interface I18nModuleAsyncOptions {
    /**
     * Modules required to resolve injected factory dependencies.
     */
    imports?: ModuleImport[];

    /**
     * Provider tokens injected into `useFactory`.
     */
    inject?: ProviderToken[];

    /**
     * Factory that returns i18n module options.
     * @param args Values injected from `inject` tokens in declaration order.
     * @returns Resolved i18n module options.
     */
    useFactory: (
        // biome-ignore lint/suspicious/noExplicitAny: factory args are user-defined DI injections
        ...args: any[]
    ) => Promise<I18nModuleOptions> | I18nModuleOptions;
}
