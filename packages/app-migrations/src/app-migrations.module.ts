/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { type DynamicModule, Module } from "@mariodebono/di";
import {
    APP_MIGRATIONS_MODULE_OPTIONS,
    APP_MIGRATIONS_RUNNER,
} from "./app-migrations.constants.js";
import type {
    AppMigrationsAsyncOptions,
    AppMigrationsOptions,
} from "./app-migrations.options.js";
import {
    createAppMigrationStoreProvider,
    createAppMigrationsRunnerProvider,
} from "./app-migrations.providers.js";

/**
 * Module that discovers and executes application bootstrap migrations.
 */
@Module({})
export class AppMigrationsModule {
    /**
     * Registers the migrations module with synchronously provided options.
     * @param {AppMigrationsOptions} options Migrations module options.
     * @returns {DynamicModule} Dynamic module definition for application migrations.
     */
    static forRoot(options: AppMigrationsOptions): DynamicModule {
        return {
            module: AppMigrationsModule,
            imports: options.imports ?? [],
            providers: [
                ...(typeof options.store === "function" ? [options.store] : []),
                createAppMigrationStoreProvider(options.store),
                {
                    provide: APP_MIGRATIONS_MODULE_OPTIONS,
                    useValue: options,
                },
                createAppMigrationsRunnerProvider(),
            ],
            exports: [APP_MIGRATIONS_RUNNER],
        };
    }

    /**
     * Registers the migrations module with asynchronously resolved options.
     * @param {AppMigrationsAsyncOptions} options Async migrations module options.
     * @returns {DynamicModule} Dynamic module definition for asynchronously configured migrations.
     */
    static forRootAsync(options: AppMigrationsAsyncOptions): DynamicModule {
        return {
            module: AppMigrationsModule,
            imports: options.imports ?? [],
            providers: [
                ...(typeof options.store === "function" ? [options.store] : []),
                createAppMigrationStoreProvider(options.store),
                {
                    provide: APP_MIGRATIONS_MODULE_OPTIONS,
                    useFactory: async (...args: unknown[]) => ({
                        ...(await options.useFactory(...args)),
                        imports: options.imports,
                        store: options.store,
                    }),
                    inject: options.inject ?? [],
                },
                createAppMigrationsRunnerProvider(),
            ],
            exports: [APP_MIGRATIONS_RUNNER],
        };
    }
}
