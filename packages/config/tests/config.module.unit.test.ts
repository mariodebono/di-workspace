/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import {
    findProvider,
    type TestFactoryProvider,
    type TestValueProvider,
} from "../../../tests/helpers/di.js";
import { CONFIG_ROOT_DATA_TOKEN } from "../src/config.constants.js";
import {
    CONFIG_OPTIONS_TOKEN,
    ConfigModule,
    registerAs,
} from "../src/config.module.js";
import { ConfigService } from "../src/config.service.js";
import type { NormalizedConfigModuleOptions } from "../src/config.types.js";

describe("ConfigModule", () => {
    it("creates root providers that normalize options, load config, validate, and create ConfigService", () => {
        const databaseConfig = registerAs("database", () => ({
            url: "file:///tmp/app.db",
        }));
        const moduleDef = ConfigModule.forRoot({
            cache: false,
            defaults: { appName: "Launcher" },
            isGlobal: true,
            load: [databaseConfig],
            validate: (config) => ({
                database: config.database,
            }),
        });

        expect(moduleDef.module).toBe(ConfigModule);
        expect(moduleDef.global).toBe(true);
        expect(moduleDef.exports).toEqual([ConfigService]);

        const optionsProvider = findProvider<TestValueProvider>(
            moduleDef.providers,
            CONFIG_OPTIONS_TOKEN,
        );
        expect(optionsProvider.useValue).toMatchObject({
            cache: false,
            isGlobal: true,
            loadProcessEnv: true,
        });

        const rootDataProvider = findProvider<TestFactoryProvider>(
            moduleDef.providers,
            CONFIG_ROOT_DATA_TOKEN,
        );
        const rootConfig = rootDataProvider.useFactory(
            optionsProvider.useValue,
        );
        expect(rootConfig).toEqual({
            database: {
                url: "file:///tmp/app.db",
            },
        });

        const serviceProvider = findProvider<
            TestFactoryProvider<ConfigService>
        >(moduleDef.providers, ConfigService);
        const service = serviceProvider.useFactory(
            rootConfig,
            optionsProvider.useValue,
        );

        expect(service).toBeInstanceOf(ConfigService);
        expect(service.get("database.url")).toBe("file:///tmp/app.db");
    });

    it("creates async root providers that normalize factory output and preserve imports/inject", async () => {
        const useFactory = async () => ({
            defaults: { feature: true },
            ignoreEnvVars: true,
        });
        const moduleDef = ConfigModule.forRootAsync({
            imports: [class SettingsModule {}],
            inject: ["SETTINGS"],
            useFactory,
        });

        expect(moduleDef.imports).toHaveLength(1);
        expect(moduleDef.exports).toEqual([ConfigService]);

        const optionsProvider = findProvider<
            TestFactoryProvider<Promise<NormalizedConfigModuleOptions>>
        >(moduleDef.providers, CONFIG_OPTIONS_TOKEN);
        expect(optionsProvider.inject).toEqual(["SETTINGS"]);

        const normalized = await optionsProvider.useFactory("settings");

        expect(normalized).toMatchObject({
            cache: true,
            ignoreEnvVars: true,
            isGlobal: false,
            loadProcessEnv: false,
        });
    });

    it("creates feature namespace providers without registering ConfigService", () => {
        const databaseConfig = registerAs("database", () => ({
            fileName: "app.db",
        }));

        const moduleDef = ConfigModule.forFeature([databaseConfig]);

        expect(moduleDef.module).toBe(ConfigModule);
        expect(moduleDef.providers).toHaveLength(1);
        expect(moduleDef.exports).toEqual([databaseConfig.TOKEN]);
        expect(
            moduleDef.providers?.some(
                (provider) =>
                    typeof provider === "object" &&
                    provider !== null &&
                    "provide" in provider &&
                    provider.provide === ConfigService,
            ),
        ).toBe(false);
    });

    it("supports empty feature imports", () => {
        const moduleDef = ConfigModule.forFeature();

        expect(moduleDef.providers).toEqual([]);
        expect(moduleDef.exports).toEqual([]);
    });
});
