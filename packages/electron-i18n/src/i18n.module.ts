/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { type DynamicModule, Module, type Provider } from "@mariodebono/di";
import { I18nBridgeController } from "./i18n.bridge.js";
import { I18nLoader } from "./i18n.loader.js";
import type {
    I18nModuleAsyncOptions,
    I18nModuleOptions,
} from "./i18n.options.js";
import { I18nService } from "./i18n.service.js";
import { I18N_MODULE_OPTIONS } from "./i18n.tokens.js";

/**
 * Dynamic DI module that wires i18n options, loader, and service.
 */
@Module({})
export class I18nModule {
    /**
     * Registers i18n synchronously with a static options object.
     * @param options Static i18n module options.
     * @returns Dynamic module definition that provides `I18nService`.
     */
    static forRoot(options: I18nModuleOptions): DynamicModule {
        return {
            module: I18nModule,
            providers: buildProviders({
                provide: I18N_MODULE_OPTIONS,
                useValue: options,
            }),
            exports: [I18nService, I18nBridgeController],
        };
    }

    /**
     * Registers i18n asynchronously using a factory and injected dependencies.
     * @param options Async registration options with factory and inject metadata.
     * @returns Dynamic module definition that provides `I18nService`.
     */
    static forRootAsync(options: I18nModuleAsyncOptions): DynamicModule {
        return {
            module: I18nModule,
            imports: options.imports ?? [],
            providers: buildProviders({
                provide: I18N_MODULE_OPTIONS,
                useFactory: options.useFactory,
                inject: options.inject ?? [],
            }),
            exports: [I18nService, I18nBridgeController],
        };
    }
}

/**
 * Internal provider list shared by sync and async registration paths.
 * @param optionsProvider Provider that resolves `I18N_MODULE_OPTIONS`.
 * @returns Providers required by the i18n module runtime.
 */
function buildProviders(optionsProvider: Provider): Provider[] {
    return [optionsProvider, I18nLoader, I18nService, I18nBridgeController];
}
