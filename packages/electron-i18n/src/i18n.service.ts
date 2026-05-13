/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// biome-ignore lint/style/useImportType: Used for runtime DI resolution.
import { Inject, Injectable, Logger, type OnModuleInit } from "@mariodebono/di";
import i18next, { type i18n as I18nInstance } from "i18next";
// biome-ignore lint/style/useImportType: Used for runtime DI resolution.
import { I18nLoader } from "./i18n.loader.js";
import type { I18nModuleOptions } from "./i18n.options.js";
import { I18N_MODULE_OPTIONS } from "./i18n.tokens.js";
import type {
    I18nBridgeState,
    I18nResourcesByNamespace,
    I18nTranslateOptions,
    I18nTranslations,
} from "./i18n.types.js";

/**
 * Main i18n runtime service used by main-process modules.
 * Wraps a dedicated i18next instance and lazy-loads locale resources via `I18nLoader`.
 */
@Injectable()
export class I18nService implements OnModuleInit {
    private readonly logger: Logger;
    private readonly instance: I18nInstance;
    private readonly namespaces: string[];
    private readonly supportedLocales: string[];
    private readonly supportedLocaleSet: Set<string>;
    private readonly fallbackLocale: string;
    private readonly systemLocale: string;
    private locale: string;
    private readonly loadedLocales = new Set<string>();

    /**
     * @param logger Logger instance from DI container.
     * @param options Module options that define locale behavior and resource setup.
     * @param loader Loader used to fetch locale JSON payloads.
     * @throws {Error} When no supported locales are configured.
     */
    constructor(
        logger: Logger,
        @Inject(I18N_MODULE_OPTIONS)
        options: I18nModuleOptions,
        private readonly loader: I18nLoader,
    ) {
        this.logger = logger.withContext(I18nService.name);
        this.instance = i18next.createInstance();

        this.namespaces = [
            ...new Set(options.namespaces.map(normalizeLocaleKey)),
        ];

        this.supportedLocales = [
            ...new Set(options.supportedLocales.map(normalizeLocale)),
        ];

        if (this.supportedLocales.length === 0) {
            throw new Error(
                "I18nService requires at least one supported locale.",
            );
        }

        this.supportedLocaleSet = new Set(this.supportedLocales);

        this.fallbackLocale =
            this.resolveFromSupported(options.fallbackLocale) ??
            this.supportedLocales[0];
        this.systemLocale =
            this.resolveFromSupported(options.systemLocale) ??
            this.fallbackLocale;
        this.locale =
            this.resolveFromSupported(options.initialLocale) ??
            this.fallbackLocale;
    }

    /**
     * Initializes i18next and preloads fallback + initial locale resources.
     * @returns Resolves when initialization and preload are complete.
     * @throws {Error} When no namespaces are configured.
     */
    async onModuleInit(): Promise<void> {
        if (this.namespaces.length === 0) {
            throw new Error("I18nService requires at least one namespace.");
        }

        await this.instance.init({
            resources: {},
            lng: this.locale,
            fallbackLng: this.fallbackLocale,
            ns: this.namespaces,
            defaultNS: this.namespaces[0],
            interpolation: {
                escapeValue: false,
            },
            returnNull: false,
        });

        await this.ensureLocaleLoaded(this.fallbackLocale);
        await this.ensureLocaleLoaded(this.locale);
        await this.instance.changeLanguage(this.locale);

        this.logger.debug(
            `Initialized i18n with locale "${this.locale}" and fallback "${this.fallbackLocale}".`,
        );
    }

    /**
     * Returns the current active locale.
     * @returns Active locale code.
     */
    getLocale(): string {
        return this.locale;
    }

    /**
     * Returns the configured fallback locale.
     * @returns Fallback locale code.
     */
    getFallbackLocale(): string {
        return this.fallbackLocale;
    }

    /**
     * Returns the resolved system locale used when preference is `"system"`.
     * @returns Resolved system locale code.
     */
    getSystemLocale(): string {
        return this.systemLocale;
    }

    /**
     * Returns all supported locales from configuration.
     * @returns List of supported locale codes.
     */
    getSupportedLocales(): string[] {
        return [...this.supportedLocales];
    }

    /**
     * Returns configured namespaces loaded by this service.
     * @returns List of configured namespace keys.
     */
    getNamespaces(): string[] {
        return [...this.namespaces];
    }

    /**
     * Checks whether a locale can be resolved to a supported locale.
     * @param locale Locale input to validate.
     * @returns `true` if locale can be resolved to supported locales.
     */
    canResolveLocale(locale: string): boolean {
        return this.resolveFromSupported(locale) !== undefined;
    }

    /**
     * Resolves a locale to the nearest supported value, or fallback locale.
     * @param locale Locale input from user/system.
     * @returns Supported locale code or configured fallback locale.
     */
    resolveLocale(locale: string): string {
        return this.resolveFromSupported(locale) ?? this.fallbackLocale;
    }

    /**
     * Returns the current i18n bridge state, including raw locale resources.
     * @param locale Locale to inspect. Defaults to the active locale.
     * @returns Composed state used by the renderer bridge.
     */
    async getState(locale: string = this.locale): Promise<I18nBridgeState> {
        const resolvedLocale = this.resolveLocale(locale);
        const resources = await this.getResources(resolvedLocale);

        return {
            locale: resolvedLocale,
            fallbackLocale: this.fallbackLocale,
            systemLocale: this.systemLocale,
            supportedLocales: [...this.supportedLocales],
            namespaces: [...this.namespaces],
            resources,
        };
    }

    /**
     * Changes active locale and ensures its resources are loaded.
     * @param locale Requested locale.
     * @returns Resolves when locale has been loaded and switched in i18next.
     */
    async setLocale(locale: string): Promise<void> {
        const resolvedLocale = this.resolveLocale(locale);
        await this.ensureLocaleLoaded(resolvedLocale);
        this.locale = resolvedLocale;
        await this.instance.changeLanguage(resolvedLocale);
    }

    /**
     * Returns namespace resources for the requested locale (defaults to current locale).
     * @param locale Locale to read resources for. Defaults to active locale.
     * @returns Namespace-keyed resources for the resolved locale.
     */
    async getResources(
        locale: string = this.locale,
    ): Promise<I18nResourcesByNamespace> {
        const resolvedLocale = this.resolveLocale(locale);
        await this.ensureLocaleLoaded(resolvedLocale);
        return await this.loader.loadLocale(resolvedLocale);
    }

    /**
     * Translates a key with optional locale/namespace overrides.
     * @param key Translation key to resolve.
     * @param options Optional translation settings passed to i18next.
     * @returns Resolved translation string.
     */
    t(key: string, options: I18nTranslateOptions = {}): string {
        const { locale, ...rest } = options;
        const targetLocale = locale
            ? this.resolveLocale(String(locale))
            : this.locale;

        return this.instance.t(key, {
            ...rest,
            lng: targetLocale,
        }) as string;
    }

    /**
     * Returns a namespace-scoped translator similar to `useTranslation(ns)`.
     * @param namespace Namespace key to scope translations to.
     * @returns Namespace-scoped translation helpers.
     * @throws {Error} When namespace is not configured in module options.
     */
    useTranslations(namespace: string): I18nTranslations {
        const normalizedNamespace = normalizeLocaleKey(namespace);
        if (!this.namespaces.includes(normalizedNamespace)) {
            throw new Error(
                `Unknown translation namespace "${namespace}". Known namespaces: ${this.namespaces.join(", ")}`,
            );
        }

        return {
            locale: this.locale,
            namespace: normalizedNamespace,
            t: (key: string, options: I18nTranslateOptions = {}) =>
                this.t(key, {
                    ...options,
                    ns: normalizedNamespace,
                }),
        };
    }

    /**
     * Attempts exact and base-language locale matching against supported locales.
     * @param locale Locale input.
     * @returns Resolved supported locale or `undefined` when not matchable.
     */
    private resolveFromSupported(locale: string): string | undefined {
        const normalized = normalizeLocale(locale);

        if (this.supportedLocaleSet.has(normalized)) {
            return normalized;
        }

        const baseLocale = normalized.split("-")[0];
        if (this.supportedLocaleSet.has(baseLocale)) {
            return baseLocale;
        }

        return undefined;
    }

    /**
     * Loads and registers locale bundles into i18next once per locale.
     * @param locale Locale to ensure loaded.
     * @returns Resolves when locale resources are registered.
     * @throws {Error} When required namespace payload is missing.
     */
    private async ensureLocaleLoaded(locale: string): Promise<void> {
        const resolvedLocale = this.resolveLocale(locale);
        if (this.loadedLocales.has(resolvedLocale)) {
            return;
        }

        const resources = await this.loader.loadLocale(resolvedLocale);

        for (const namespace of this.namespaces) {
            const payload = resources[namespace];
            if (!payload) {
                throw new Error(
                    `Missing namespace "${namespace}" in locale "${resolvedLocale}" payload.`,
                );
            }

            this.instance.addResourceBundle(
                resolvedLocale,
                namespace,
                payload,
                true,
                true,
            );
        }

        this.loadedLocales.add(resolvedLocale);
    }
}

/**
 * Normalizes locale identifiers (`en_US` -> `en-us`) for matching.
 * @param locale Raw locale string.
 * @returns Normalized locale key.
 */
function normalizeLocale(locale: string): string {
    return locale.trim().toLowerCase().replaceAll("_", "-");
}

/**
 * Normalizes namespace keys for lookup.
 * @param value Raw namespace string.
 * @returns Normalized namespace key.
 */
function normalizeLocaleKey(value: string): string {
    return value.trim().toLowerCase();
}
