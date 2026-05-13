/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { IContainerInternal } from "../container.js";
import { Logger } from "../logger.service.js";
import type { Constructor, LoggerService, LogLevel } from "../types.js";

export type ApplicationLoggerOption =
    | true
    | false
    | LogLevel[]
    | Constructor<LoggerService>
    | LoggerService;

const APP_LOGGER = Symbol("app:logger");

/**
 * Registers the application logger strategy and ensures `Logger` remains injectable.
 * @param {IContainerInternal} container Container that stores logger providers.
 * @param {ApplicationLoggerOption | undefined} loggerOption Logger configuration supplied at bootstrap.
 * @returns {LoggerService} Resolved logger instance used during bootstrap.
 */
export function registerApplicationLogger(
    container: IContainerInternal,
    loggerOption: ApplicationLoggerOption | undefined,
): LoggerService {
    if (
        loggerOption === undefined ||
        loggerOption === true ||
        loggerOption === Logger
    ) {
        container.register({
            provide: Logger,
            useClass: Logger,
            scope: "transient",
        });
        return container.resolve(Logger);
    }

    if (
        loggerOption === false ||
        Array.isArray(loggerOption) ||
        typeof loggerOption !== "function"
    ) {
        const logger =
            loggerOption === false
                ? createCoreLoggerWithLevels([])
                : Array.isArray(loggerOption)
                  ? createCoreLoggerWithLevels(loggerOption)
                  : loggerOption;

        container.register({
            provide: APP_LOGGER,
            useValue: logger,
            scope: "singleton",
        });
        container.register({
            provide: Logger,
            useFactory: (baseLogger: LoggerService) =>
                createInjectableLogger(baseLogger),
            inject: [APP_LOGGER],
            scope: "transient",
        });
        return logger;
    }

    const loggerToken = loggerOption;
    container.register(loggerToken);
    container.register({
        provide: Logger,
        useFactory: (resolvedLogger: LoggerService) =>
            createInjectableLogger(resolvedLogger),
        inject: [loggerToken],
        scope: "transient",
    });

    return container.resolve(loggerToken);
}

/**
 * Creates the built-in core logger with the specified enabled levels.
 * @param {LogLevel[]} levels Log levels to enable on the logger instance.
 * @returns {Logger} Configured core logger instance.
 */
function createCoreLoggerWithLevels(levels: LogLevel[]): Logger {
    const logger = new Logger();
    logger.setLogLevels(levels);
    return logger;
}

/**
 * Normalizes an injectable logger to a context-aware instance when supported.
 * @param {LoggerService} logger Base logger implementation.
 * @returns {LoggerService} Logger instance safe to inject into providers.
 */
function createInjectableLogger(logger: LoggerService): LoggerService {
    return logger.withContext?.("") ?? logger;
}

/**
 * Attaches a context label to a logger when the logger supports contextual instances.
 * @param {LoggerService} logger Logger to decorate with a context label.
 * @param {string} context Context label to attach.
 * @returns {LoggerService} Contextual logger when supported, otherwise the original logger.
 */
export function withLoggerContext(
    logger: LoggerService,
    context: string,
): LoggerService {
    return logger.withContext?.(context) ?? logger;
}
