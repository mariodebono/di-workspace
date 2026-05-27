/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import {
    createTestingApp,
    Injectable,
    Logger,
    REQUEST_CONTEXT,
} from "../src/index.js";

describe("core testing helpers", () => {
    it("creates isolated testing apps and resolves providers", () => {
        class FeatureService {
            readonly id = "feature";
        }
        Injectable()(FeatureService);

        const app = createTestingApp([
            FeatureService,
            { provide: "VALUE_TOKEN", useValue: 123 },
            {
                provide: "CTX_TOKEN",
                useFactory: (ctx: unknown) => ctx,
                inject: [REQUEST_CONTEXT],
            },
        ]);

        try {
            expect(app.get(FeatureService).id).toBe("feature");
            expect(app.get<number>("VALUE_TOKEN")).toBe(123);
            expect(app.get("CTX_TOKEN")).toBe("CTX_TOKEN");
        } finally {
            app.teardown();
        }
    });

    it("supports logger context and output methods", () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const debugSpy = vi
            .spyOn(console, "debug")
            .mockImplementation(() => {});
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const logger = new Logger().withContext("Spec");

        logger.log("hello");
        logger.warn("warn");
        logger.debug("debug");
        logger.error(new Error("boom"));
        logger.error("plain error message");

        expect(logSpy).toHaveBeenCalledOnce();
        expect(warnSpy).toHaveBeenCalledOnce();
        expect(debugSpy).toHaveBeenCalledOnce();
        expect(errorSpy).toHaveBeenCalledTimes(2);
    });

    it("supports async resolution and async teardown", async () => {
        const ASYNC_TOKEN = Symbol("ASYNC_TOKEN");

        class AsyncDestroyService {
            static destroyed = false;

            async onModuleDestroy(): Promise<void> {
                await Promise.resolve();
                AsyncDestroyService.destroyed = true;
            }
        }
        Injectable()(AsyncDestroyService);
        AsyncDestroyService.destroyed = false;

        const app = createTestingApp([
            AsyncDestroyService,
            {
                provide: ASYNC_TOKEN,
                useFactory: async () => 999,
            },
        ]);

        try {
            await expect(app.resolve<number>(ASYNC_TOKEN)).resolves.toBe(999);
            app.get(AsyncDestroyService);
        } finally {
            await app.teardownAsync();
        }

        expect(AsyncDestroyService.destroyed).toBe(true);
    });
});
