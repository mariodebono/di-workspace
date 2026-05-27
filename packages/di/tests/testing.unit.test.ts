/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "../src/types.js";

const containerMocks = vi.hoisted(() => {
    const container = {
        destroy: vi.fn(),
        destroyAsync: vi.fn(),
        register: vi.fn(),
        resolve: vi.fn(),
        resolveAsync: vi.fn(),
    };

    return {
        container,
        createInternalContainer: vi.fn(() => container),
        ModuleRef: class ModuleRef {
            constructor(readonly containerRef: unknown) {}
        },
    };
});

vi.mock("../src/container.js", () => ({
    createInternalContainer: containerMocks.createInternalContainer,
    ModuleRef: containerMocks.ModuleRef,
}));

import { createTestingApp } from "../src/testing.js";

describe("createTestingApp", () => {
    beforeEach(() => {
        containerMocks.createInternalContainer.mockClear();
        containerMocks.container.destroy.mockClear();
        containerMocks.container.destroyAsync.mockReset();
        containerMocks.container.destroyAsync.mockResolvedValue(undefined);
        containerMocks.container.register.mockClear();
        containerMocks.container.resolve.mockReset();
        containerMocks.container.resolveAsync.mockReset();
    });

    it("creates an isolated container and registers ModuleRef plus provided providers", () => {
        class FeatureService {}
        const valueProvider: Provider = {
            provide: "VALUE_TOKEN",
            useValue: 123,
        };

        createTestingApp([FeatureService, valueProvider]);

        expect(containerMocks.createInternalContainer).toHaveBeenCalledOnce();
        expect(containerMocks.container.register).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                provide: containerMocks.ModuleRef,
                scope: "singleton",
                useValue: expect.any(containerMocks.ModuleRef),
            }),
        );
        expect(containerMocks.container.register).toHaveBeenNthCalledWith(
            2,
            FeatureService,
        );
        expect(containerMocks.container.register).toHaveBeenNthCalledWith(
            3,
            valueProvider,
        );
    });

    it("delegates resolution and teardown to the backing container", async () => {
        const TOKEN = Symbol("TOKEN");
        containerMocks.container.resolve.mockReturnValue("sync-value");
        containerMocks.container.resolveAsync.mockResolvedValue("async-value");

        const app = createTestingApp([]);

        expect(app.get(TOKEN)).toBe("sync-value");
        await expect(app.resolve(TOKEN)).resolves.toBe("async-value");

        app.teardown();
        await app.teardownAsync();

        expect(containerMocks.container.resolve).toHaveBeenCalledWith(TOKEN);
        expect(containerMocks.container.resolveAsync).toHaveBeenCalledWith(
            TOKEN,
        );
        expect(containerMocks.container.destroy).toHaveBeenCalledOnce();
        expect(containerMocks.container.destroyAsync).toHaveBeenCalledOnce();
    });
});
