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
    APP_QUIT_METADATA_KEY,
    getAppQuitHooks,
    getMainWindowBlurHooks,
    getMainWindowCloseHooks,
    getMainWindowFocusHooks,
    getMainWindowShowHooks,
    LIFECYCLE_HOOK_INJECTABLE_TAG,
    type LifecycleHookOptions,
    LifecycleHookOrder,
    MAIN_WINDOW_BLUR_METADATA_KEY,
    MAIN_WINDOW_CLOSE_METADATA_KEY,
    MAIN_WINDOW_FOCUS_METADATA_KEY,
    MAIN_WINDOW_SHOW_METADATA_KEY,
    OnAppQuit,
    OnMainWindowBlur,
    OnMainWindowClose,
    OnMainWindowFocus,
    OnMainWindowShow,
} from "../src/decorators/lifecycle-hooks.decorator.js";

describe("Lifecycle hook decorators", () => {
    it("stores default metadata and tags class for discovery", () => {
        class DefaultHookHandler {
            onBeforeQuit(): void {}
        }
        applyOnAppQuit(DefaultHookHandler.prototype, "onBeforeQuit");

        const handlers = getAppQuitHooks(DefaultHookHandler);
        expect(handlers).toEqual([
            {
                methodName: "onBeforeQuit",
                order: LifecycleHookOrder.After,
                priority: 0,
            },
        ]);

        const options = getInjectableOptions(DefaultHookHandler);

        expect(options?.tags).toContain(LIFECYCLE_HOOK_INJECTABLE_TAG);
    });

    it("stores custom priority and order for each lifecycle hook type", () => {
        class CustomHookHandler {
            onBeforeQuit(): void {}
            onWindowBlur(): void {}
            onWindowClose(): void {}
            onWindowFocus(): void {}
            onWindowShow(): void {}
        }
        applyOnAppQuit(CustomHookHandler.prototype, "onBeforeQuit", {
            order: LifecycleHookOrder.Before,
            priority: -10,
        });
        applyOnMainWindowBlur(CustomHookHandler.prototype, "onWindowBlur", {
            order: LifecycleHookOrder.Before,
            priority: -15,
        });
        applyOnMainWindowClose(CustomHookHandler.prototype, "onWindowClose", {
            order: LifecycleHookOrder.Before,
            priority: -5,
        });
        applyOnMainWindowFocus(CustomHookHandler.prototype, "onWindowFocus", {
            order: LifecycleHookOrder.After,
            priority: 3,
        });
        applyOnMainWindowShow(CustomHookHandler.prototype, "onWindowShow", {
            order: LifecycleHookOrder.After,
            priority: 5,
        });

        expect(getAppQuitHooks(CustomHookHandler)).toEqual([
            {
                methodName: "onBeforeQuit",
                order: LifecycleHookOrder.Before,
                priority: -10,
            },
        ]);
        expect(getMainWindowBlurHooks(CustomHookHandler)).toEqual([
            {
                methodName: "onWindowBlur",
                order: LifecycleHookOrder.Before,
                priority: -15,
            },
        ]);
        expect(getMainWindowCloseHooks(CustomHookHandler)).toEqual([
            {
                methodName: "onWindowClose",
                order: LifecycleHookOrder.Before,
                priority: -5,
            },
        ]);
        expect(getMainWindowFocusHooks(CustomHookHandler)).toEqual([
            {
                methodName: "onWindowFocus",
                order: LifecycleHookOrder.After,
                priority: 3,
            },
        ]);
        expect(getMainWindowShowHooks(CustomHookHandler)).toEqual([
            {
                methodName: "onWindowShow",
                order: LifecycleHookOrder.After,
                priority: 5,
            },
        ]);
    });

    it("rejects static methods", () => {
        class InvalidStaticHandler {
            static onBeforeQuit(): void {}
            static onWindowBlur(): void {}
            static onWindowClose(): void {}
            static onWindowFocus(): void {}
            static onWindowShow(): void {}
        }

        const beforeQuitDescriptor = Object.getOwnPropertyDescriptor(
            InvalidStaticHandler,
            "onBeforeQuit",
        );
        const blurDescriptor = Object.getOwnPropertyDescriptor(
            InvalidStaticHandler,
            "onWindowBlur",
        );
        const closeDescriptor = Object.getOwnPropertyDescriptor(
            InvalidStaticHandler,
            "onWindowClose",
        );
        const focusDescriptor = Object.getOwnPropertyDescriptor(
            InvalidStaticHandler,
            "onWindowFocus",
        );
        const showDescriptor = Object.getOwnPropertyDescriptor(
            InvalidStaticHandler,
            "onWindowShow",
        );
        if (
            !beforeQuitDescriptor ||
            !blurDescriptor ||
            !closeDescriptor ||
            !focusDescriptor ||
            !showDescriptor
        ) {
            throw new Error("Missing lifecycle hook descriptor");
        }

        expect(() =>
            OnAppQuit()(
                InvalidStaticHandler,
                "onBeforeQuit",
                beforeQuitDescriptor,
            ),
        ).toThrow("@OnAppQuit cannot be applied to static methods");

        expect(() =>
            OnMainWindowBlur()(
                InvalidStaticHandler,
                "onWindowBlur",
                blurDescriptor,
            ),
        ).toThrow("@OnMainWindowBlur cannot be applied to static methods");

        expect(() =>
            OnMainWindowClose()(
                InvalidStaticHandler,
                "onWindowClose",
                closeDescriptor,
            ),
        ).toThrow("@OnMainWindowClose cannot be applied to static methods");

        expect(() =>
            OnMainWindowFocus()(
                InvalidStaticHandler,
                "onWindowFocus",
                focusDescriptor,
            ),
        ).toThrow("@OnMainWindowFocus cannot be applied to static methods");

        expect(() =>
            OnMainWindowShow()(
                InvalidStaticHandler,
                "onWindowShow",
                showDescriptor,
            ),
        ).toThrow("@OnMainWindowShow cannot be applied to static methods");
    });

    it("adds the lifecycle hook tag once when applied repeatedly", () => {
        class ExistingInjectableHandler {
            onBeforeQuit(): void {}
            onWindowBlur(): void {}
            onWindowClose(): void {}
            onWindowFocus(): void {}
            onWindowShow(): void {}
        }
        applyOnAppQuit(ExistingInjectableHandler.prototype, "onBeforeQuit");
        applyOnAppQuit(ExistingInjectableHandler.prototype, "onBeforeQuit");
        applyOnMainWindowBlur(
            ExistingInjectableHandler.prototype,
            "onWindowBlur",
        );
        applyOnMainWindowClose(
            ExistingInjectableHandler.prototype,
            "onWindowClose",
        );
        applyOnMainWindowFocus(
            ExistingInjectableHandler.prototype,
            "onWindowFocus",
        );
        applyOnMainWindowShow(
            ExistingInjectableHandler.prototype,
            "onWindowShow",
        );

        const options = getInjectableOptions(ExistingInjectableHandler);

        expect(options?.tags).toContain(LIFECYCLE_HOOK_INJECTABLE_TAG);

        const lifecycleTags =
            options?.tags?.filter(
                (tag) => tag === LIFECYCLE_HOOK_INJECTABLE_TAG,
            ) ?? [];
        expect(lifecycleTags).toHaveLength(1);

        const beforeQuitStored = Reflect.getMetadata(
            APP_QUIT_METADATA_KEY,
            ExistingInjectableHandler,
        ) as unknown[];
        const blurStored = Reflect.getMetadata(
            MAIN_WINDOW_BLUR_METADATA_KEY,
            ExistingInjectableHandler,
        ) as unknown[];
        const closeStored = Reflect.getMetadata(
            MAIN_WINDOW_CLOSE_METADATA_KEY,
            ExistingInjectableHandler,
        ) as unknown[];
        const focusStored = Reflect.getMetadata(
            MAIN_WINDOW_FOCUS_METADATA_KEY,
            ExistingInjectableHandler,
        ) as unknown[];
        const showStored = Reflect.getMetadata(
            MAIN_WINDOW_SHOW_METADATA_KEY,
            ExistingInjectableHandler,
        ) as unknown[];

        expect(beforeQuitStored).toHaveLength(2);
        expect(blurStored).toHaveLength(1);
        expect(closeStored).toHaveLength(1);
        expect(focusStored).toHaveLength(1);
        expect(showStored).toHaveLength(1);
    });
});

function applyOnAppQuit(
    target: object,
    methodName: string,
    options?: LifecycleHookOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    OnAppQuit(options)(target, methodName, descriptor);
}

function applyOnMainWindowClose(
    target: object,
    methodName: string,
    options?: LifecycleHookOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    OnMainWindowClose(options)(target, methodName, descriptor);
}

function applyOnMainWindowBlur(
    target: object,
    methodName: string,
    options?: LifecycleHookOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    OnMainWindowBlur(options)(target, methodName, descriptor);
}

function applyOnMainWindowFocus(
    target: object,
    methodName: string,
    options?: LifecycleHookOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    OnMainWindowFocus(options)(target, methodName, descriptor);
}

function applyOnMainWindowShow(
    target: object,
    methodName: string,
    options?: LifecycleHookOptions,
): void {
    const descriptor = Object.getOwnPropertyDescriptor(target, methodName);
    if (!descriptor) {
        throw new Error(`Missing method descriptor for ${methodName}`);
    }

    OnMainWindowShow(options)(target, methodName, descriptor);
}
