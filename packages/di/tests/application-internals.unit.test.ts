/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import {
    initializeModulesAsync,
    initializeProvidersAsync,
} from "../src/application-internals/bootstrap.js";
import {
    registerApplicationLogger,
    withLoggerContext,
} from "../src/application-internals/logger.js";
import { Logger } from "../src/logger.service.js";

describe("application bootstrap internals", () => {
    it("initializes all non-transient providers", async () => {
        const TRANSIENT = Symbol("TRANSIENT");
        const SINGLETON = Symbol("SINGLETON");
        const container = {
            getProviderScope: vi.fn((token: symbol) =>
                token === TRANSIENT ? "transient" : "singleton",
            ),
            resolveAsync: vi.fn().mockResolvedValue(undefined),
        };

        await initializeProvidersAsync(
            container as never,
            new Set([TRANSIENT, SINGLETON]),
        );

        expect(container.resolveAsync).toHaveBeenCalledOnce();
        expect(container.resolveAsync).toHaveBeenCalledWith(SINGLETON);
    });

    it("initializes module classes and logs each module", async () => {
        class FirstModule {}
        class SecondModule {}
        const container = {
            resolveAsync: vi.fn().mockResolvedValue(undefined),
        };
        const logger = {
            debug: vi.fn(),
        };

        await initializeModulesAsync(
            container as never,
            [FirstModule, SecondModule],
            logger as never,
        );

        expect(container.resolveAsync).toHaveBeenNthCalledWith(1, FirstModule);
        expect(container.resolveAsync).toHaveBeenNthCalledWith(2, SecondModule);
        expect(logger.debug).toHaveBeenCalledWith(
            "Initialized module: FirstModule",
        );
        expect(logger.debug).toHaveBeenCalledWith(
            "Initialized module: SecondModule",
        );
    });
});

describe("application logger internals", () => {
    it("registers the default logger as a transient provider", () => {
        const container = {
            register: vi.fn(),
            resolve: vi.fn(() => new Logger()),
        };

        const logger = registerApplicationLogger(container as never, undefined);

        expect(logger).toBeInstanceOf(Logger);
        expect(container.register).toHaveBeenCalledWith({
            provide: Logger,
            useClass: Logger,
            scope: "transient",
        });
        expect(container.resolve).toHaveBeenCalledWith(Logger);
    });

    it("wraps provided logger instances and log-level options", () => {
        const providedLogger = {
            log: vi.fn(),
            setLogLevels: vi.fn(),
            withContext: vi.fn().mockReturnValue({ log: vi.fn() }),
        };
        const container = {
            register: vi.fn(),
            resolve: vi.fn(),
        };

        const logger = registerApplicationLogger(
            container as never,
            providedLogger,
        );

        expect(logger).toBe(providedLogger);
        expect(container.register).toHaveBeenCalledWith(
            expect.objectContaining({
                provide: Logger,
                scope: "transient",
            }),
        );

        const disabled = registerApplicationLogger(container as never, false);
        expect(disabled).toBeInstanceOf(Logger);
    });

    it("returns contextual loggers when available", () => {
        const contextual = { log: vi.fn() };
        const logger = {
            withContext: vi.fn().mockReturnValue(contextual),
        };

        expect(withLoggerContext(logger as never, "Bootstrap")).toBe(
            contextual,
        );
        expect(logger.withContext).toHaveBeenCalledWith("Bootstrap");
    });
});
