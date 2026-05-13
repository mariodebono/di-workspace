/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Injectable, metadataKeys } from "@mariodebono/di";
import { describe, expect, it } from "vitest";
import {
    APP_READY_INJECTABLE_TAG,
    APP_READY_METADATA_KEY,
    AppReady,
    type AppReadyOptions,
    AppReadyOrder,
    getAppReadyHandlers,
} from "../src/decorators/app-ready.decorator.js";

describe("AppReady decorator", () => {
    it("stores default metadata and tags class for discovery", () => {
        class DefaultReadyHandler {
            onReady(): void {}
        }
        applyAppReady(DefaultReadyHandler.prototype, "onReady");

        const handlers = getAppReadyHandlers(DefaultReadyHandler);
        expect(handlers).toEqual([
            {
                methodName: "onReady",
                order: AppReadyOrder.AfterWindow,
                priority: 0,
            },
        ]);

        const options = Reflect.getMetadata(
            metadataKeys.injectableOptions,
            DefaultReadyHandler,
        ) as { tags?: (string | symbol)[] } | undefined;

        expect(options?.tags).toContain(APP_READY_INJECTABLE_TAG);
    });

    it("stores custom priority and order", () => {
        class CustomReadyHandler {
            initialize(): void {}
        }
        applyAppReady(CustomReadyHandler.prototype, "initialize", {
            order: AppReadyOrder.BeforeWindow,
            priority: -10,
        });

        const handlers = getAppReadyHandlers(CustomReadyHandler);
        expect(handlers).toEqual([
            {
                methodName: "initialize",
                order: AppReadyOrder.BeforeWindow,
                priority: -10,
            },
        ]);
    });

    it("rejects static methods", () => {
        class InvalidStaticHandler {
            static initialize(): void {}
        }

        const descriptor = Object.getOwnPropertyDescriptor(
            InvalidStaticHandler,
            "initialize",
        );
        if (!descriptor) {
            throw new Error("Missing descriptor for initialize");
        }

        expect(() =>
            AppReady()(InvalidStaticHandler, "initialize", descriptor),
        ).toThrow("@AppReady cannot be applied to static methods");
    });

    it("preserves existing injectable options while adding app-ready tag", () => {
        const existingTag = Symbol("existing-tag");

        @Injectable({
            scope: "transient",
            tags: [existingTag, APP_READY_INJECTABLE_TAG],
        })
        class ExistingInjectableHandler {
            initialize(): void {}
        }
        applyAppReady(ExistingInjectableHandler.prototype, "initialize", {
            priority: 2,
        });

        const options = Reflect.getMetadata(
            metadataKeys.injectableOptions,
            ExistingInjectableHandler,
        ) as { scope?: string; tags?: (string | symbol)[] } | undefined;

        expect(options?.scope).toBe("transient");
        expect(options?.tags).toEqual(
            expect.arrayContaining([existingTag, APP_READY_INJECTABLE_TAG]),
        );

        const appReadyTags =
            options?.tags?.filter((tag) => tag === APP_READY_INJECTABLE_TAG) ??
            [];
        expect(appReadyTags).toHaveLength(1);

        const stored = Reflect.getMetadata(
            APP_READY_METADATA_KEY,
            ExistingInjectableHandler,
        ) as unknown[];
        expect(stored).toHaveLength(1);
    });
});

function applyAppReady(
    target: object,
    methodName: string,
    options?: AppReadyOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    AppReady(options)(target, methodName, descriptor);
}
