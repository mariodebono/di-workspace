/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { metadataKeys } from "@mariodebono/di";
import { describe, expect, it, vi } from "vitest";

import {
    createI18nLocaleChangedHookRunner,
    getLocaleChangedHandlers,
    OnLocaleChanged,
} from "../src/i18n.hooks.js";
import type { I18nLocaleChangedEvent } from "../src/i18n.types.js";

class LocaleChangedHandler {
    public readonly calls: I18nLocaleChangedEvent[] = [];

    handle(event: I18nLocaleChangedEvent): void {
        this.calls.push(event);
    }
}

const handleDescriptor = Object.getOwnPropertyDescriptor(
    LocaleChangedHandler.prototype,
    "handle",
);

if (!handleDescriptor) {
    throw new Error("Missing handle descriptor");
}

OnLocaleChanged({ priority: 5 })(
    LocaleChangedHandler.prototype,
    "handle",
    handleDescriptor as TypedPropertyDescriptor<LocaleChangedHandler["handle"]>,
);

describe("I18n locale changed hooks", () => {
    it("registers handler metadata and tags the provider", () => {
        const handlers = getLocaleChangedHandlers(LocaleChangedHandler);

        expect(handlers).toEqual([
            {
                methodName: "handle",
                priority: 5,
            },
        ]);

        const injectableOptions = Reflect.getMetadata(
            metadataKeys.injectableOptions,
            LocaleChangedHandler,
        ) as { tags?: unknown[] } | undefined;

        expect(injectableOptions?.tags).toHaveLength(1);
    });

    it("collects and runs locale-changed handlers", async () => {
        const instance = new LocaleChangedHandler();
        const application = {
            findByTag: vi.fn().mockReturnValue([LocaleChangedHandler]),
            get: vi.fn().mockReturnValue(instance),
        };

        const runner = createI18nLocaleChangedHookRunner({
            logger: () => ({ error: vi.fn() }) as never,
        });

        const invocations = runner.collectLocaleChangedInvocations(
            application as never,
        );

        expect(invocations).toHaveLength(1);

        const event: I18nLocaleChangedEvent = {
            previousLocale: "en",
            requestedLocale: "en-gb",
            resolvedLocale: "en",
        };

        await runner.runLocaleChangedHandlers(invocations, event);

        expect(instance.calls).toEqual([event]);
    });
});
