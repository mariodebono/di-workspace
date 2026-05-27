/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import { ConfigService } from "../src/config.service.js";

describe("ConfigService", () => {
    it("returns top-level and nested values plus the full config object", () => {
        const config = {
            appName: "Launcher",
            nested: {
                enabled: true,
            },
        };
        const service = new ConfigService(config);

        expect(service.get("appName")).toBe("Launcher");
        expect(service.get("nested.enabled")).toBe(true);
        expect(service.getAll()).toBe(config);
    });

    it("returns default values for missing keys", () => {
        const service = new ConfigService({
            nested: {},
        });

        expect(
            service.get("nested.missing", {
                defaultValue: "fallback",
            }),
        ).toBe("fallback");
    });

    it("throws a clear error when getOrThrow cannot resolve a value", () => {
        const service = new ConfigService({
            nested: {},
        });

        expect(() => service.getOrThrow("nested.missing")).toThrow(
            'Configuration key "nested.missing" not found. Verify the namespace/path exists in the root config.',
        );
    });

    it("returns false when traversal hits a non-object mid-path", () => {
        const service = new ConfigService({
            nested: {
                value: 5,
            },
        });

        expect(service.get("nested.value.deep")).toBeUndefined();
        expect(service.has("nested.value.deep")).toBe(false);
    });

    it("uses cache by default and can bypass it per lookup", () => {
        const config = {
            nested: {
                enabled: true,
            },
        };
        const service = new ConfigService(config);

        expect(service.get("nested.enabled")).toBe(true);
        config.nested.enabled = false;

        expect(service.get("nested.enabled")).toBe(true);
        expect(service.get("nested.enabled", { cache: false })).toBe(false);
    });

    it("disables cache when constructed with cache=false", () => {
        const config = {
            nested: {
                enabled: true,
            },
        };
        const service = new ConfigService(config, { cache: false });

        expect(service.get("nested.enabled")).toBe(true);
        config.nested.enabled = false;

        expect(service.get("nested.enabled")).toBe(false);
    });
});
