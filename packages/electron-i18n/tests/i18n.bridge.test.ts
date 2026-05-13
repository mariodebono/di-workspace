/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@mariodebono/di-electron", () => ({
    BridgeController: () => (target: unknown) => target,
    createIpcHandleTyped:
        () =>
        () =>
        (
            _target: object,
            _propertyKey: string | symbol,
            descriptor?: PropertyDescriptor,
        ) =>
            descriptor,
}));

import { I18nBridgeController } from "../src/i18n.bridge.js";

describe("I18nBridgeController", () => {
    it("delegates getState, setLocale, and getResources to the service", async () => {
        const state = {
            locale: "en",
            fallbackLocale: "en",
            systemLocale: "en",
            supportedLocales: ["en"],
            namespaces: ["common"],
            resources: {
                common: { greeting: "Hello" },
            },
        };

        const i18nService = {
            getState: vi.fn().mockResolvedValue(state),
            setLocale: vi.fn().mockResolvedValue(undefined),
            getResources: vi.fn().mockResolvedValue(state.resources),
        };

        const controller = new I18nBridgeController(i18nService as never);

        await expect(controller.getState()).resolves.toEqual(state);
        expect(i18nService.getState).toHaveBeenCalledOnce();

        await expect(controller.setLocale("en-gb")).resolves.toEqual(state);
        expect(i18nService.setLocale).toHaveBeenCalledWith("en-gb");

        await expect(controller.getResources("en")).resolves.toEqual(
            state.resources,
        );
        expect(i18nService.getResources).toHaveBeenCalledWith("en");
    });
});
