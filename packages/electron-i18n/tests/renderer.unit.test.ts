/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";

import {
    createI18nRendererBridge,
    createI18nRendererEvents,
    type I18nBridgeApi,
    type I18nLocaleChangedEvent,
    type I18nRendererEvents,
} from "../src/renderer.js";

type MockTransport = {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    on: (channel: string, listener: (...args: unknown[]) => void) => void;
    off: (channel: string, listener: (...args: unknown[]) => void) => void;
};

function setWindowTransport(
    transport: MockTransport | null | undefined,
): () => void {
    const globalObject = globalThis as {
        window?: { __di_electron__?: MockTransport };
    };
    const previousWindow = globalObject.window;

    if (transport === undefined) {
        Reflect.deleteProperty(globalObject, "window");
    } else if (transport === null) {
        globalObject.window = {};
    } else {
        globalObject.window = { __di_electron__: transport };
    }

    return () => {
        if (previousWindow === undefined) {
            Reflect.deleteProperty(globalObject, "window");
            return;
        }

        globalObject.window = previousWindow;
    };
}

function createTransport(state: unknown, resources: unknown): MockTransport {
    return {
        invoke: vi.fn().mockImplementation(async (channel: string) => {
            if (channel === "i18n.getResources") {
                return {
                    success: true,
                    data: resources,
                };
            }

            return {
                success: true,
                data: state,
            };
        }),
        on: vi.fn(),
        off: vi.fn(),
    };
}

describe("I18n renderer bridge", () => {
    it("prefixes bridge calls with the i18n namespace", async () => {
        const resources = {
            common: { greeting: "Hello" },
        };
        const state = {
            locale: "en",
            fallbackLocale: "en",
            systemLocale: "en",
            supportedLocales: ["en"],
            namespaces: ["common"],
            resources,
        };
        const transport = createTransport(state, resources);
        const invoke = transport.invoke;

        const bridge: I18nBridgeApi = createI18nRendererBridge(transport);

        await expect(bridge.getState()).resolves.toEqual(state);
        expect(invoke).toHaveBeenLastCalledWith("i18n.getState");

        await expect(bridge.setLocale("en-gb")).resolves.toEqual(state);
        expect(invoke).toHaveBeenLastCalledWith("i18n.setLocale", "en-gb");

        await expect(bridge.getResources("en")).resolves.toEqual(resources);
        expect(invoke).toHaveBeenLastCalledWith("i18n.getResources", "en");
    });

    it("exposes locale changed event helpers", () => {
        const transport = {
            invoke: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        };
        const events: I18nRendererEvents = createI18nRendererEvents(transport);
        const listener: (event: I18nLocaleChangedEvent) => void = vi.fn();

        events.onLocaleChanged(listener);
        events.offLocaleChanged(listener);

        expect(transport.on).toHaveBeenCalledWith(
            "i18n.localeChanged",
            listener,
        );
        expect(transport.off).toHaveBeenCalledWith(
            "i18n.localeChanged",
            listener,
        );
    });

    it("uses the preload transport when no override is provided", async () => {
        const resources = {
            common: { greeting: "Hello" },
        };
        const state = {
            locale: "en",
            fallbackLocale: "en",
            systemLocale: "en",
            supportedLocales: ["en"],
            namespaces: ["common"],
            resources,
        };
        const transport = createTransport(state, resources);
        const restoreWindow = setWindowTransport(transport);

        try {
            const bridge: I18nBridgeApi = createI18nRendererBridge();
            const events: I18nRendererEvents = createI18nRendererEvents();
            const listener: (event: I18nLocaleChangedEvent) => void = vi.fn();

            await expect(bridge.getState()).resolves.toEqual(state);
            await expect(bridge.setLocale("en-gb")).resolves.toEqual(state);
            await expect(bridge.getResources("en")).resolves.toEqual(resources);

            events.onLocaleChanged(listener);
            events.offLocaleChanged(listener);

            expect(transport.on).toHaveBeenCalledWith(
                "i18n.localeChanged",
                listener,
            );
            expect(transport.off).toHaveBeenCalledWith(
                "i18n.localeChanged",
                listener,
            );
        } finally {
            restoreWindow();
        }
    });

    it("throws when no browser window exists", () => {
        const restoreWindow = setWindowTransport(undefined);

        try {
            expect(() => createI18nRendererBridge()).toThrow("browser window");
            expect(() => createI18nRendererEvents()).toThrow("browser window");
        } finally {
            restoreWindow();
        }
    });

    it("throws when the preload transport is missing", () => {
        const restoreWindow = setWindowTransport(null);

        try {
            expect(() => createI18nRendererBridge()).toThrow(
                "DI Electron preload bridge",
            );
            expect(() => createI18nRendererEvents()).toThrow(
                "DI Electron preload bridge",
            );
        } finally {
            restoreWindow();
        }
    });
});
