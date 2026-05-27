/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import {
    buildModuleContexts,
    collectModules,
    registerModuleGraph,
} from "../src/application-internals/module-graph.js";
import { Module } from "../src/decorators.js";

describe("module graph internals", () => {
    it("collects static and dynamic modules in dependency order", () => {
        class Service {}

        @Module({})
        class SharedModule {}

        @Module({
            imports: [SharedModule],
        })
        class FeatureModule {}

        @Module({})
        class RootModule {}

        const result = collectModules({
            module: RootModule,
            imports: [
                {
                    module: FeatureModule,
                    providers: [Service],
                    exports: [Service],
                    global: true,
                },
            ],
        });

        expect(result.modules).toEqual([
            SharedModule,
            FeatureModule,
            RootModule,
        ]);
        expect(result.dynamicMetadata.get(FeatureModule)).toMatchObject({
            providers: [Service],
            exports: [Service],
            global: true,
        });
    });

    it("builds module contexts from static and dynamic metadata", () => {
        const TOKEN = Symbol("TOKEN");

        @Module({})
        class ImportedModule {}

        @Module({
            imports: [ImportedModule],
            exports: ["STATIC_TOKEN"],
        })
        class FeatureModule {}

        const contexts = buildModuleContexts(
            [ImportedModule, FeatureModule],
            new Map([
                [
                    FeatureModule,
                    {
                        imports: [{ module: ImportedModule }],
                        exports: [TOKEN],
                        global: true,
                    },
                ],
            ]),
        );

        expect(contexts.get(FeatureModule)).toEqual({
            imports: new Set([ImportedModule]),
            exports: new Set(["STATIC_TOKEN", TOKEN]),
            global: true,
        });
    });

    it("registers module providers and owners", () => {
        const TOKEN = Symbol("TOKEN");
        const container = {
            register: vi.fn(),
            setProviderOwner: vi.fn(),
        };

        @Module({
            providers: [
                class ClassProvider {},
                {
                    provide: TOKEN,
                    useValue: 123,
                },
            ],
        })
        class FeatureModule {}

        const providerTokens = registerModuleGraph(
            container as never,
            [FeatureModule],
            new Map(),
        );

        expect(providerTokens).toEqual(new Set([expect.any(Function), TOKEN]));
        expect(container.register).toHaveBeenCalledWith(FeatureModule);
        expect(container.setProviderOwner).toHaveBeenCalledWith(
            TOKEN,
            FeatureModule,
        );
        expect(container.setProviderOwner).toHaveBeenCalledWith(
            FeatureModule,
            FeatureModule,
        );
    });
});
