/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const internals = vi.hoisted(() => {
    const container = {
        destroy: vi.fn(),
        destroyAsync: vi.fn(),
        findByTag: vi.fn(),
        register: vi.fn(),
        resolve: vi.fn(),
        resolveAsync: vi.fn(),
        setModuleContexts: vi.fn(),
    };
    const appLogger = {
        log: vi.fn(),
    };
    const bootstrapLogger = {
        debug: vi.fn(),
        log: vi.fn(),
    };
    const moduleContexts = new Map();
    const providerTokens = new Set([Symbol("TOKEN")]);

    return {
        appLogger,
        bootstrapLogger,
        buildModuleContexts: vi.fn(() => moduleContexts),
        collectModules: vi.fn(),
        container,
        createInternalContainer: vi.fn(() => container),
        initializeModulesAsync: vi.fn(),
        initializeProvidersAsync: vi.fn(),
        moduleContexts,
        providerTokens,
        registerApplicationLogger: vi.fn(() => appLogger),
        registerModuleGraph: vi.fn(() => providerTokens),
        withLoggerContext: vi.fn(() => bootstrapLogger),
    };
});

vi.mock("../src/container.js", async () => {
    const actual = await vi.importActual<typeof import("../src/container.js")>(
        "../src/container.js",
    );
    return {
        ...actual,
        createInternalContainer: internals.createInternalContainer,
    };
});

vi.mock("../src/application-internals/bootstrap.js", () => ({
    initializeModulesAsync: internals.initializeModulesAsync,
    initializeProvidersAsync: internals.initializeProvidersAsync,
}));

vi.mock("../src/application-internals/logger.js", () => ({
    registerApplicationLogger: internals.registerApplicationLogger,
    withLoggerContext: internals.withLoggerContext,
}));

vi.mock("../src/application-internals/module-graph.js", () => ({
    buildModuleContexts: internals.buildModuleContexts,
    collectModules: internals.collectModules,
    registerModuleGraph: internals.registerModuleGraph,
}));

import { createApplication } from "../src/application.js";
import { ModuleRef } from "../src/container.js";

describe("createApplication", () => {
    beforeEach(() => {
        internals.appLogger.log.mockClear();
        internals.bootstrapLogger.debug.mockClear();
        internals.bootstrapLogger.log.mockClear();
        internals.buildModuleContexts.mockClear();
        internals.collectModules.mockReset();
        internals.container.destroy.mockClear();
        internals.container.destroyAsync.mockReset();
        internals.container.destroyAsync.mockResolvedValue(undefined);
        internals.container.findByTag.mockReset();
        internals.container.register.mockClear();
        internals.container.resolve.mockReset();
        internals.container.resolveAsync.mockReset();
        internals.container.setModuleContexts.mockClear();
        internals.createInternalContainer.mockClear();
        internals.initializeModulesAsync.mockReset();
        internals.initializeProvidersAsync.mockReset();
        internals.registerApplicationLogger.mockClear();
        internals.registerModuleGraph.mockClear();
        internals.withLoggerContext.mockClear();
    });

    it("orchestrates application bootstrap with isolated internals", async () => {
        class EntryModule {}
        class ImportedModule {}
        const dynamicMetadata = new Map();
        internals.collectModules.mockReturnValue({
            dynamicMetadata,
            modules: [ImportedModule, EntryModule],
        });
        internals.container.resolve.mockReturnValue("resolved");
        internals.container.resolveAsync.mockResolvedValue("async-resolved");
        internals.container.findByTag.mockReturnValue(["TAGGED"]);

        const app = await createApplication(EntryModule, {
            logger: false,
        });

        expect(internals.createInternalContainer).toHaveBeenCalledOnce();
        expect(internals.registerApplicationLogger).toHaveBeenCalledWith(
            internals.container,
            false,
        );
        expect(internals.withLoggerContext).toHaveBeenCalledWith(
            internals.appLogger,
            "Bootstrap",
        );
        expect(internals.container.register).toHaveBeenCalledWith(
            expect.objectContaining({
                provide: ModuleRef,
                scope: "singleton",
                useValue: expect.any(ModuleRef),
            }),
        );
        expect(internals.collectModules).toHaveBeenCalledWith(EntryModule);
        expect(internals.buildModuleContexts).toHaveBeenCalledWith(
            [ImportedModule, EntryModule],
            dynamicMetadata,
        );
        expect(internals.container.setModuleContexts).toHaveBeenCalledWith(
            internals.moduleContexts,
        );
        expect(internals.registerModuleGraph).toHaveBeenCalledWith(
            internals.container,
            [ImportedModule, EntryModule],
            dynamicMetadata,
        );
        expect(internals.initializeProvidersAsync).toHaveBeenCalledWith(
            internals.container,
            internals.providerTokens,
        );
        expect(internals.initializeModulesAsync).toHaveBeenCalledWith(
            internals.container,
            [ImportedModule, EntryModule],
            internals.bootstrapLogger,
        );

        expect(app.get("TOKEN")).toBe("resolved");
        await expect(app.resolve("TOKEN")).resolves.toBe("async-resolved");
        expect(app.findByTag("tag")).toEqual(["TAGGED"]);
        expect(app.getContainer()).toBe(internals.container);

        app.destroy();
        await app.destroyAsync();

        expect(internals.container.resolve).toHaveBeenCalledWith("TOKEN");
        expect(internals.container.resolveAsync).toHaveBeenCalledWith("TOKEN");
        expect(internals.container.destroy).toHaveBeenCalledOnce();
        expect(internals.container.destroyAsync).toHaveBeenCalledOnce();
    });

    it("labels dynamic entry modules in bootstrap logging", async () => {
        class EntryModule {}
        internals.collectModules.mockReturnValue({
            dynamicMetadata: new Map(),
            modules: [EntryModule],
        });

        await createApplication({
            module: EntryModule,
        });

        expect(internals.bootstrapLogger.log).toHaveBeenCalledWith(
            "Bootstrapping entry module: EntryModule",
        );
    });
});
