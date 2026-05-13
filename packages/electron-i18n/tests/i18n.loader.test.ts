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

async function createLocaleFixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), "i18n-loader-test-"));
    const enDir = path.join(root, "en");
    await mkdir(enDir, { recursive: true });

    return {
        root,
        cleanup: async () => rm(root, { recursive: true, force: true }),
    };
}

function createLogger(): Logger {
    return {
        withContext: vi.fn().mockReturnValue({
            debug: vi.fn(),
        }),
    } as unknown as Logger;
}

describe("I18nLoader", () => {
    const cleanupCallbacks: Array<() => Promise<void>> = [];

    afterEach(async () => {
        while (cleanupCallbacks.length > 0) {
            const cleanup = cleanupCallbacks.pop();
            if (cleanup) {
                await cleanup();
            }
        }
    });

    it("loads locale namespace files and caches the payload", async () => {
        const fixture = await createLocaleFixture();
        cleanupCallbacks.push(fixture.cleanup);

        await writeFile(
            path.join(fixture.root, "en", "common.json"),
            JSON.stringify({ greeting: "Hello" }),
            "utf8",
        );
        await writeFile(
            path.join(fixture.root, "en", "app.json"),
            JSON.stringify({ welcome: { title: "Launcher" } }),
            "utf8",
        );

        const loader = new I18nLoader(createLogger(), {
            localesRoot: fixture.root,
            supportedLocales: ["en"],
            namespaces: ["common", "app"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        });

        const first = await loader.loadLocale("en");
        const second = await loader.loadLocale("en");

        expect(first).toEqual({
            common: { greeting: "Hello" },
            app: { welcome: { title: "Launcher" } },
        });
        expect(second).toBe(first);
    });

    it("throws when required namespace file is missing", async () => {
        const fixture = await createLocaleFixture();
        cleanupCallbacks.push(fixture.cleanup);

        await writeFile(
            path.join(fixture.root, "en", "common.json"),
            JSON.stringify({ greeting: "Hello" }),
            "utf8",
        );

        const loader = new I18nLoader(createLogger(), {
            localesRoot: fixture.root,
            supportedLocales: ["en"],
            namespaces: ["common", "app"],
            fallbackLocale: "en",
            initialLocale: "en",
            systemLocale: "en",
        });

        await expect(loader.loadLocale("en")).rejects.toThrow(
            "Failed to load i18n namespace",
        );
    });
});
