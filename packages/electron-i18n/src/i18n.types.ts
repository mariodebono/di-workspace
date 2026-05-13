/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * User locale preference value. `"system"` delegates to OS locale.
 */
export type I18nLocalePreference = "system" | string;

/**
 * One namespace payload loaded from a locale JSON file.
 */
export type I18nNamespaceResource = Record<string, unknown>;

/**
 * All namespace payloads for a given locale.
 */
export type I18nResourcesByNamespace = Record<string, I18nNamespaceResource>;

/**
 * Composed bridge state shared with the renderer.
 */
export type I18nBridgeState = {
    locale: string;
    fallbackLocale: string;
    systemLocale: string;
    supportedLocales: string[];
    namespaces: string[];
    resources: I18nResourcesByNamespace;
};

/**
 * Payload emitted when the active locale changes.
 */
export type I18nLocaleChangedEvent = {
    previousLocale: string;
    requestedLocale: string;
    resolvedLocale: string;
};

/**
 * IPC bridge contract exposed to the renderer.
 */
export type I18nBridgeApi = {
    getState(): Promise<I18nBridgeState>;
    setLocale(locale: string): Promise<I18nBridgeState>;
    getResources(locale?: string): Promise<I18nResourcesByNamespace>;
};

/**
 * Renderer-facing locale change event helpers.
 */
export type I18nRendererEvents = {
    onLocaleChanged: (
        listener: (event: I18nLocaleChangedEvent) => void,
    ) => void;
    offLocaleChanged: (
        listener: (event: I18nLocaleChangedEvent) => void,
    ) => void;
};

/**
 * Translation call options passed through to i18next.
 */
export type I18nTranslateOptions = {
    ns?: string;
    locale?: string;
    [key: string]: unknown;
};

/**
 * Namespace-scoped translation helper returned by `useTranslations`.
 */
export type I18nTranslations = {
    locale: string;
    namespace: string;
    t: (key: string, options?: I18nTranslateOptions) => string;
};
