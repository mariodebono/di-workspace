/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("electron/main", () => ({
    app: {},
    Menu: {},
}));

vi.mock("electron", () => ({
    BrowserWindow: class BrowserWindow {},
    dialog: {},
    shell: {},
}));

import { I18nBridgeController } from "../src/i18n.bridge.js";
import { I18nLoader } from "../src/i18n.loader.js";
import { I18nModule } from "../src/i18n.module.js";
import { I18nService } from "../src/i18n.service.js";
import { I18N_MODULE_OPTIONS } from "../src/i18n.tokens.js";

describe("I18nModule", () => {
    it("creates a sync module definition", () => {
        const options = {
            localesRoot: "/tmp/locales",
            supportedLocales: ["en"],
            namespaces: ["common"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        };

        const dynamicModule = I18nModule.forRoot(options);

        expect(dynamicModule.module).toBe(I18nModule);
        expect(dynamicModule.exports).toEqual([
            I18nService,
            I18nBridgeController,
        ]);

        const providers = dynamicModule.providers ?? [];
        expect(providers).toContain(I18nLoader);
        expect(providers).toContain(I18nService);
        expect(providers).toContain(I18nBridgeController);
        expect(providers).toContainEqual({
            provide: I18N_MODULE_OPTIONS,
            useValue: options,
        });
    });

    it("creates an async module definition", () => {
        const useFactory = () => ({
            localesRoot: "/tmp/locales",
            supportedLocales: ["en"],
            namespaces: ["common"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        });

        const dynamicModule = I18nModule.forRootAsync({
            imports: [],
            inject: ["TOKEN"],
            useFactory,
        });

        expect(dynamicModule.module).toBe(I18nModule);
        expect(dynamicModule.exports).toEqual([
            I18nService,
            I18nBridgeController,
        ]);

        const providers = dynamicModule.providers ?? [];
        expect(providers).toContain(I18nLoader);
        expect(providers).toContain(I18nService);
        expect(providers).toContain(I18nBridgeController);
        expect(providers).toContainEqual({
            provide: I18N_MODULE_OPTIONS,
            useFactory,
            inject: ["TOKEN"],
        });
    });
});
