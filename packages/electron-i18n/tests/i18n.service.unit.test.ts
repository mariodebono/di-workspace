/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nLoader } from "../src/i18n.loader.js";

const i18nextMocks = vi.hoisted(() => ({
    addResourceBundle: vi.fn(),
    changeLanguage: vi.fn(),
    createInstance: vi.fn(),
    init: vi.fn(),
    t: vi.fn(),
}));

vi.mock("i18next", () => ({
    default: {
        createInstance: i18nextMocks.createInstance,
    },
}));

import { I18nService } from "../src/i18n.service.js";

function createLogger(): ConstructorParameters<typeof I18nService>[0] {
    return {
        withContext: vi.fn().mockReturnValue({
            debug: vi.fn(),
        }),
    } as ConstructorParameters<typeof I18nService>[0];
}

function createLoader(
    resourcesByLocale: Record<string, Record<string, object>>,
) {
    return {
        loadLocale: vi.fn((locale: string) =>
            Promise.resolve(resourcesByLocale[locale] ?? {}),
        ),
    } as unknown as I18nLoader;
}

describe("I18nService", () => {
    beforeEach(() => {
        i18nextMocks.addResourceBundle.mockClear();
        i18nextMocks.changeLanguage.mockReset();
        i18nextMocks.changeLanguage.mockResolvedValue(undefined);
        i18nextMocks.createInstance.mockReset();
        i18nextMocks.createInstance.mockReturnValue({
            addResourceBundle: i18nextMocks.addResourceBundle,
            changeLanguage: i18nextMocks.changeLanguage,
            init: i18nextMocks.init,
            t: i18nextMocks.t,
        });
        i18nextMocks.init.mockReset();
        i18nextMocks.init.mockResolvedValue(undefined);
        i18nextMocks.t.mockReset();
        i18nextMocks.t.mockReturnValue("translated");
    });

    it("normalizes configured locales and initializes i18next with loaded resources", async () => {
        const loader = createLoader({
            en: {
                common: { greeting: "Hello" },
                app: { title: "Launcher" },
            },
        });

        const service = new I18nService(
            createLogger(),
            {
                localesRoot: "/unused",
                supportedLocales: ["EN", "en"],
                namespaces: ["common", "APP", "common"],
                fallbackLocale: "en-gb",
                initialLocale: "system",
                systemLocale: "en-us",
            },
            loader,
        );

        expect(service.getLocale()).toBe("en");
        expect(service.getFallbackLocale()).toBe("en");
        expect(service.getSystemLocale()).toBe("en");
        expect(service.getSupportedLocales()).toEqual(["en"]);
        expect(service.getNamespaces()).toEqual(["common", "app"]);

        await service.onModuleInit();

        expect(i18nextMocks.init).toHaveBeenCalledWith(
            expect.objectContaining({
                defaultNS: "common",
                fallbackLng: "en",
                lng: "en",
                ns: ["common", "app"],
            }),
        );
        expect(loader.loadLocale).toHaveBeenCalledTimes(1);
        expect(i18nextMocks.addResourceBundle).toHaveBeenCalledWith(
            "en",
            "common",
            { greeting: "Hello" },
            true,
            true,
        );
        expect(i18nextMocks.addResourceBundle).toHaveBeenCalledWith(
            "en",
            "app",
            { title: "Launcher" },
            true,
            true,
        );
        expect(i18nextMocks.changeLanguage).toHaveBeenCalledWith("en");
    });

    it("changes locale, exposes state, and translates through i18next", async () => {
        const loader = createLoader({
            en: {
                common: { greeting: "Hello" },
            },
            fr: {
                common: { greeting: "Bonjour" },
            },
        });
        const service = new I18nService(
            createLogger(),
            {
                localesRoot: "/unused",
                supportedLocales: ["en", "fr"],
                namespaces: ["common"],
                fallbackLocale: "en",
                initialLocale: "en",
                systemLocale: "en",
            },
            loader,
        );

        await service.onModuleInit();
        await service.setLocale("fr-ca");

        expect(service.getLocale()).toBe("fr");
        expect(i18nextMocks.changeLanguage).toHaveBeenLastCalledWith("fr");
        expect(await service.getState()).toEqual({
            locale: "fr",
            fallbackLocale: "en",
            systemLocale: "en",
            supportedLocales: ["en", "fr"],
            namespaces: ["common"],
            resources: {
                common: { greeting: "Bonjour" },
            },
        });

        expect(service.t("greeting", { ns: "common", locale: "fr-ca" })).toBe(
            "translated",
        );
        expect(i18nextMocks.t).toHaveBeenCalledWith("greeting", {
            ns: "common",
            lng: "fr",
        });
    });

    it("throws for invalid configuration and missing namespace payloads", async () => {
        expect(
            () =>
                new I18nService(
                    createLogger(),
                    {
                        localesRoot: "/unused",
                        supportedLocales: [],
                        namespaces: ["common"],
                        fallbackLocale: "en",
                        initialLocale: "en",
                        systemLocale: "en",
                    },
                    createLoader({}),
                ),
        ).toThrow("I18nService requires at least one supported locale.");

        const service = new I18nService(
            createLogger(),
            {
                localesRoot: "/unused",
                supportedLocales: ["en"],
                namespaces: [],
                fallbackLocale: "en",
                initialLocale: "en",
                systemLocale: "en",
            },
            createLoader({ en: {} }),
        );

        await expect(service.onModuleInit()).rejects.toThrow(
            "I18nService requires at least one namespace.",
        );

        const missingNamespace = new I18nService(
            createLogger(),
            {
                localesRoot: "/unused",
                supportedLocales: ["en"],
                namespaces: ["common"],
                fallbackLocale: "en",
                initialLocale: "en",
                systemLocale: "en",
            },
            createLoader({ en: {} }),
        );

        await expect(missingNamespace.onModuleInit()).rejects.toThrow(
            'Missing namespace "common" in locale "en" payload.',
        );
    });

    it("returns namespace-scoped translation helpers and rejects unknown namespaces", () => {
        const service = new I18nService(
            createLogger(),
            {
                localesRoot: "/unused",
                supportedLocales: ["en"],
                namespaces: ["common"],
                fallbackLocale: "en",
                initialLocale: "en",
                systemLocale: "en",
            },
            createLoader({ en: { common: {} } }),
        );

        const translations = service.useTranslations("COMMON");

        expect(translations.locale).toBe("en");
        expect(translations.namespace).toBe("common");
        expect(translations.t("greeting")).toBe("translated");
        expect(i18nextMocks.t).toHaveBeenCalledWith("greeting", {
            ns: "common",
            lng: "en",
        });
        expect(() => service.useTranslations("missing")).toThrow(
            'Unknown translation namespace "missing". Known namespaces: common',
        );
    });
});
