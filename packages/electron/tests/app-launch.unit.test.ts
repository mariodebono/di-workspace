/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import { getInjectableOptions } from "../../../tests/helpers/di.js";
import {
    APP_LAUNCH_INJECTABLE_TAG,
    APP_LAUNCH_METADATA_KEY,
    type AppLaunchOptions,
    getAppLaunchHandlers,
    OnAppLaunch,
} from "../src/decorators/app-launch.decorator.js";

describe("OnAppLaunch decorator", () => {
    it("stores default metadata and tags class for discovery", () => {
        class DefaultLaunchHandler {
            onLaunch(): void {}
        }
        applyOnAppLaunch(DefaultLaunchHandler.prototype, "onLaunch");

        const handlers = getAppLaunchHandlers(DefaultLaunchHandler);
        expect(handlers).toEqual([
            {
                methodName: "onLaunch",
                priority: 0,
            },
        ]);

        const options = getInjectableOptions(DefaultLaunchHandler);

        expect(options?.tags).toContain(APP_LAUNCH_INJECTABLE_TAG);
    });

    it("stores custom priority", () => {
        class CustomLaunchHandler {
            initialize(): void {}
        }
        applyOnAppLaunch(CustomLaunchHandler.prototype, "initialize", {
            priority: -10,
        });

        expect(getAppLaunchHandlers(CustomLaunchHandler)).toEqual([
            {
                methodName: "initialize",
                priority: -10,
            },
        ]);
    });

    it("returns no handlers for non-function provider tokens", () => {
        expect(getAppLaunchHandlers("launch-handler")).toEqual([]);
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
            OnAppLaunch()(InvalidStaticHandler, "initialize", descriptor),
        ).toThrow("@OnAppLaunch cannot be applied to static methods");
    });

    it("rejects non-method targets", () => {
        class InvalidHandler {
            value = 1;
        }

        expect(() =>
            OnAppLaunch()(
                InvalidHandler.prototype,
                "value",
                {} as PropertyDescriptor,
            ),
        ).toThrow("@OnAppLaunch can only be applied to methods");
    });

    it("adds the app-launch tag once when applied repeatedly", () => {
        class ExistingInjectableHandler {
            initialize(): void {}
        }
        applyOnAppLaunch(ExistingInjectableHandler.prototype, "initialize", {
            priority: 2,
        });
        applyOnAppLaunch(ExistingInjectableHandler.prototype, "initialize", {
            priority: 3,
        });

        const options = getInjectableOptions(ExistingInjectableHandler);

        expect(options?.tags).toContain(APP_LAUNCH_INJECTABLE_TAG);

        const appLaunchTags =
            options?.tags?.filter((tag) => tag === APP_LAUNCH_INJECTABLE_TAG) ??
            [];
        expect(appLaunchTags).toHaveLength(1);

        const stored = Reflect.getMetadata(
            APP_LAUNCH_METADATA_KEY,
            ExistingInjectableHandler,
        ) as unknown[];
        expect(stored).toHaveLength(2);
    });
});

function applyOnAppLaunch(
    target: object,
    methodName: string,
    options?: AppLaunchOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    OnAppLaunch(options)(target, methodName, descriptor);
}
