/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
    readFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
    readFile: fsMocks.readFile,
}));

import { I18nLoader } from "../src/i18n.loader.js";

function createLogger(): ConstructorParameters<typeof I18nLoader>[0] {
    return {
        withContext: vi.fn().mockReturnValue({
            debug: vi.fn(),
        }),
    } as ConstructorParameters<typeof I18nLoader>[0];
}

describe("I18nLoader", () => {
    beforeEach(() => {
        fsMocks.readFile.mockReset();
    });

    it("loads normalized locale namespace files and caches the payload", async () => {
        fsMocks.readFile.mockImplementation((filePath: string) => {
            if (filePath.endsWith(path.join("en-us", "common.json"))) {
                return Promise.resolve(JSON.stringify({ greeting: "Hello" }));
            }
            if (filePath.endsWith(path.join("en-us", "app.json"))) {
                return Promise.resolve(
                    JSON.stringify({ welcome: { title: "Launcher" } }),
                );
            }
            return Promise.reject(new Error(`Unexpected path: ${filePath}`));
        });

        const loader = new I18nLoader(createLogger(), {
            localesRoot: "/locales",
            supportedLocales: ["en"],
            namespaces: ["common", "app"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        });

        const first = await loader.loadLocale("EN_us");
        const second = await loader.loadLocale("en-us");

        expect(first).toEqual({
            common: { greeting: "Hello" },
            app: { welcome: { title: "Launcher" } },
        });
        expect(second).toBe(first);
        expect(fsMocks.readFile).toHaveBeenCalledTimes(2);
    });

    it("throws a contextual error when a namespace file cannot be read", async () => {
        fsMocks.readFile.mockRejectedValue(new Error("missing file"));

        const loader = new I18nLoader(createLogger(), {
            localesRoot: "/locales",
            supportedLocales: ["en"],
            namespaces: ["common"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        });

        await expect(loader.loadLocale("en")).rejects.toThrow(
            `Failed to load i18n namespace "common" for locale "en" from ${path.join("/locales", "en", "common.json")}: missing file`,
        );
    });

    it("throws when a namespace file is invalid JSON or not an object", async () => {
        const loader = new I18nLoader(createLogger(), {
            localesRoot: "/locales",
            supportedLocales: ["en"],
            namespaces: ["common"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        });

        fsMocks.readFile.mockResolvedValueOnce("{");
        await expect(loader.loadLocale("en")).rejects.toThrow(
            "Failed to parse i18n namespace",
        );

        fsMocks.readFile.mockResolvedValueOnce(JSON.stringify(["not-object"]));
        await expect(loader.loadLocale("fr")).rejects.toThrow(
            'Invalid translation payload for namespace "common"',
        );
    });
});
