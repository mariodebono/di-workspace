/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

// biome-ignore lint/style/useImportType: Used for runtime DI resolution.
import { Inject, Injectable, Logger } from "@mariodebono/di";
import type { I18nModuleOptions } from "./i18n.options.js";
import { I18N_MODULE_OPTIONS } from "./i18n.tokens.js";
import type { I18nResourcesByNamespace } from "./i18n.types.js";

/**
 * Reads locale namespace JSON files from disk and caches them per locale.
 */
@Injectable()
export class I18nLoader {
    private readonly logger: Logger;

    private readonly localeCache = new Map<string, I18nResourcesByNamespace>();

    /**
     * @param logger Logger instance from DI container.
     * @param options Module options that provide locale root and namespaces.
     */
    constructor(
        logger: Logger,
        @Inject(I18N_MODULE_OPTIONS)
        private readonly options: I18nModuleOptions,
    ) {
        this.logger = logger.withContext(I18nLoader.name);
    }

    /**
     * Loads all configured namespaces for a locale from `/localesRoot/<locale>`.
     * @param locale Locale identifier requested by the caller.
     * @returns Namespace-keyed translation resources for the resolved locale.
     * @throws {Error} When a namespace file cannot be read, parsed, or validated.
     */
    async loadLocale(locale: string): Promise<I18nResourcesByNamespace> {
        const normalizedLocale = normalizeLocale(locale);
        const cached = this.localeCache.get(normalizedLocale);
        if (cached) {
            return cached;
        }

        const configuredLocale =
            this.options.supportedLocales
                .find(
                    (supportedLocale) =>
                        normalizeLocale(supportedLocale) === normalizedLocale,
                )
                ?.trim() ?? normalizedLocale;
        const resources: I18nResourcesByNamespace = {};

        for (const namespace of this.options.namespaces) {
            const filePath = path.join(
                this.options.localesRoot,
                configuredLocale,
                `${namespace}.json`,
            );

            let content = "";
            try {
                content = await readFile(filePath, "utf8");
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                throw new Error(
                    `Failed to load i18n namespace "${namespace}" for locale "${normalizedLocale}" from ${filePath}: ${message}`,
                );
            }

            let parsed: unknown;
            try {
                parsed = JSON.parse(content);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                throw new Error(
                    `Failed to parse i18n namespace "${namespace}" for locale "${normalizedLocale}" from ${filePath}: ${message}`,
                );
            }

            if (!isRecord(parsed)) {
                throw new Error(
                    `Invalid translation payload for namespace "${namespace}" in ${filePath}. Expected a JSON object.`,
                );
            }

            resources[namespace] = parsed;
        }

        this.localeCache.set(normalizedLocale, resources);
        this.logger.debug(
            `Loaded ${Object.keys(resources).length} namespace(s) for locale "${normalizedLocale}".`,
        );

        return resources;
    }
}

/**
 * Normalizes locale identifiers for file-system lookup (`en_US` -> `en-us`).
 * @param locale Raw locale value.
 * @returns Normalized locale string.
 */
function normalizeLocale(locale: string): string {
    return locale.trim().toLowerCase().replaceAll("_", "-");
}

/**
 * Guards translation payload shape to plain object.
 * @param value Parsed JSON value.
 * @returns `true` when `value` is a non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
