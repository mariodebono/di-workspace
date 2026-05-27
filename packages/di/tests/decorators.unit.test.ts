/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import {
    forwardRef,
    Global,
    Inject,
    Injectable,
    isForwardReference,
    Module,
    metadataKeys,
    Optional,
} from "../src/decorators.js";

describe("DI decorators", () => {
    it("stores module metadata and constructor param types", () => {
        class Dependency {}
        class FeatureModule {
            constructor(readonly dependency: Dependency) {}
        }
        Reflect.defineMetadata(
            "design:paramtypes",
            [Dependency],
            FeatureModule,
        );

        Module({
            exports: [Dependency],
            imports: [class ImportedModule {}],
            providers: [Dependency],
        })(FeatureModule);

        expect(Reflect.getMetadata(metadataKeys.module, FeatureModule)).toEqual(
            expect.objectContaining({
                exports: [Dependency],
                providers: [Dependency],
            }),
        );
        expect(
            Reflect.getMetadata(metadataKeys.paramtypes, FeatureModule),
        ).toEqual([Dependency]);
    });

    it("marks modules as global without discarding existing metadata", () => {
        class GlobalModule {}

        Module({ providers: ["TOKEN"] })(GlobalModule);
        Global()(GlobalModule);

        expect(Reflect.getMetadata(metadataKeys.module, GlobalModule)).toEqual({
            providers: ["TOKEN"],
            global: true,
        });
    });

    it("stores injectable options and constructor injection metadata", () => {
        const TOKEN = Symbol("TOKEN");

        class Service {
            constructor(readonly value: unknown) {}
        }

        Injectable({ scope: "transient", tags: ["service"] })(Service);
        Inject(TOKEN)(Service, undefined, 0);
        Optional()(Service, undefined, 0);

        expect(Reflect.getMetadata(metadataKeys.injectable, Service)).toBe(
            true,
        );
        expect(
            Reflect.getMetadata(metadataKeys.injectableOptions, Service),
        ).toEqual({
            scope: "transient",
            tags: ["service"],
        });
        expect(Reflect.getMetadata(metadataKeys.injectTokens, Service)).toEqual(
            {
                0: TOKEN,
            },
        );
        expect(
            Reflect.getMetadata(metadataKeys.optionalParams, Service),
        ).toEqual([0]);
    });

    it("rejects parameter decorators on non-constructor parameters", () => {
        expect(() => Inject("TOKEN")({}, "method", 0)).toThrow(
            "@Inject can only be used on constructor parameters",
        );
        expect(() => Optional()({}, "method", 0)).toThrow(
            "@Optional can only be used on constructor parameters",
        );
    });

    it("creates and detects forward references", () => {
        class Deferred {}

        const ref = forwardRef(() => Deferred);

        expect(isForwardReference(ref)).toBe(true);
        expect(ref.forwardRef()).toBe(Deferred);
        expect(isForwardReference({ forwardRef: "nope" })).toBe(false);
    });
});
