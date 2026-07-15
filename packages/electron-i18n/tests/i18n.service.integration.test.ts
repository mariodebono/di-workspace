/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Logger } from "@mariodebono/di";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nLoader } from "../src/i18n.loader.js";
import { I18nService } from "../src/i18n.service.js";

async function createLocaleFixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), "i18n-service-test-"));
    const enDir = path.join(root, "en");
    await mkdir(enDir, { recursive: true });

    await writeFile(
        path.join(enDir, "common.json"),
        JSON.stringify({ greeting: "Hello" }),
        "utf8",
    );

    await writeFile(
        path.join(enDir, "app.json"),
        JSON.stringify({ welcome: { title: "Hello" } }),
        "utf8",
    );

    await writeFile(
        path.join(enDir, "titlebar.json"),
        JSON.stringify({ appName: "Godot Launcher" }),
        "utf8",
    );

    return {
        root,
        cleanup: async () => rm(root, { recursive: true, force: true }),
    };
}

function createLogger(): Logger {
    return {
        withContext: vi.fn().mockReturnValue({
            debug: vi.fn(),
            log: vi.fn(),
        }),
    } as unknown as Logger;
}

describe("I18nService", () => {
    const cleanupCallbacks: Array<() => Promise<void>> = [];

    afterEach(async () => {
        while (cleanupCallbacks.length > 0) {
            const cleanup = cleanupCallbacks.pop();
            if (cleanup) {
                await cleanup();
            }
        }
    });

    it("initializes and translates keys", async () => {
        const fixture = await createLocaleFixture();
        cleanupCallbacks.push(fixture.cleanup);

        const logger = createLogger();
        const loader = new I18nLoader(logger, {
            localesRoot: fixture.root,
            supportedLocales: ["en"],
            namespaces: ["common", "app", "titlebar"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        });

        const service = new I18nService(
            logger,
            {
                localesRoot: fixture.root,
                supportedLocales: ["en"],
                namespaces: ["common", "app", "titlebar"],
                fallbackLocale: "en",
                initialLocale: "en",
                systemLocale: "en",
            },
            loader,
        );

        await service.onModuleInit();

        const state = await service.getState();

        expect(service.getLocale()).toBe("en");
        expect(state).toEqual({
            locale: "en",
            fallbackLocale: "en",
            systemLocale: "en",
            supportedLocales: ["en"],
            namespaces: ["common", "app", "titlebar"],
            resources: {
                common: { greeting: "Hello" },
                app: { welcome: { title: "Hello" } },
                titlebar: { appName: "Godot Launcher" },
            },
        });
        expect(service.t("welcome.title", { ns: "app" })).toBe("Hello");

        const titlebar = service.useTranslations("titlebar");
        expect(titlebar.t("appName")).toBe("Godot Launcher");
    });

    it("resolves locale variants and validates supported locales", async () => {
        const fixture = await createLocaleFixture();
        cleanupCallbacks.push(fixture.cleanup);

        const logger = createLogger();
        const loader = new I18nLoader(logger, {
            localesRoot: fixture.root,
            supportedLocales: ["en"],
            namespaces: ["common", "app", "titlebar"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        });

        const service = new I18nService(
            logger,
            {
                localesRoot: fixture.root,
                supportedLocales: ["en"],
                namespaces: ["common", "app", "titlebar"],
                fallbackLocale: "en",
                initialLocale: "en",
                systemLocale: "en",
            },
            loader,
        );

        await service.onModuleInit();

        expect(service.canResolveLocale("en-gb")).toBe(true);
        expect(service.canResolveLocale("fr")).toBe(false);

        await service.setLocale("en-gb");
        expect(service.getLocale()).toBe("en");

        const state = await service.getState();
        expect(state.locale).toBe("en");
    });

    it("preserves configured namespace names throughout the service state", async () => {
        const root = await mkdtemp(
            path.join(os.tmpdir(), "i18n-service-case-"),
        );
        cleanupCallbacks.push(() => rm(root, { recursive: true, force: true }));
        const localeDirectory = path.join(root, "pt-BR");
        await mkdir(localeDirectory, { recursive: true });
        await writeFile(
            path.join(localeDirectory, "createProject.json"),
            JSON.stringify({ title: "Criar projeto" }),
            "utf8",
        );

        const options = {
            localesRoot: root,
            supportedLocales: ["pt-BR"],
            namespaces: ["createProject"],
            fallbackLocale: "pt-BR",
            initialLocale: "pt-BR",
            systemLocale: "pt-BR",
        };
        const logger = createLogger();
        const loader = new I18nLoader(logger, options);
        const service = new I18nService(logger, options, loader);

        await service.onModuleInit();

        expect(await service.getState()).toEqual({
            locale: "pt-br",
            fallbackLocale: "pt-br",
            systemLocale: "pt-br",
            supportedLocales: ["pt-br"],
            namespaces: ["createProject"],
            resources: {
                createProject: { title: "Criar projeto" },
            },
        });
        expect(service.getNamespaces()).toEqual(["createProject"]);
        await expect(service.getResources()).resolves.toEqual({
            createProject: { title: "Criar projeto" },
        });
        expect(service.t("createProject:title")).toBe("Criar projeto");
        expect(service.t("title", { ns: "createProject" })).toBe(
            "Criar projeto",
        );
        expect(service.useTranslations("createProject").namespace).toBe(
            "createProject",
        );
        expect(() => service.useTranslations("createproject")).toThrow(
            'Unknown translation namespace "createproject"',
        );
    });
});
