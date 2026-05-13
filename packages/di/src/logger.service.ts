/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Injectable, Optional } from "./decorators.js";
import type { LoggerService, LogLevel } from "./types.js";

const DEFAULT_LOG_LEVELS: LogLevel[] = [
    "log",
    "error",
    "warn",
    "debug",
    "verbose",
    "fatal",
];

interface LoggerOptions {
    context?: string;
    logLevels?: LogLevel[];
}

@Injectable({ scope: "transient" })
export class Logger implements LoggerService {
    private readonly context?: string;
    private enabledLogLevels: Set<LogLevel>;

    /**
     * Creates a logger with an optional context label and enabled log levels.
     * @param {LoggerOptions} options Logger construction options.
     */
    constructor(@Optional() options: LoggerOptions = {}) {
        this.context = options.context;
        this.enabledLogLevels = new Set(
            options.logLevels ?? DEFAULT_LOG_LEVELS,
        );
    }

    /**
     * Returns a new logger instance bound to the given context label.
     * @param {string} context Context label to attach to log output.
     * @returns {Logger} New logger instance with the provided context.
     */
    withContext(context: string): Logger {
        return new Logger({
            context,
            logLevels: [...this.enabledLogLevels],
        });
    }

    /**
     * Replaces the set of enabled log levels.
     * @param {LogLevel[]} levels Log levels to enable.
     * @returns {void}
     */
    setLogLevels(levels: LogLevel[]): void {
        this.enabledLogLevels = new Set(levels);
    }

    /**
     * Writes a standard log message when the `log` level is enabled.
     * @param {unknown} message Primary message payload.
     * @param {...unknown[]} optionalParams Additional values to print.
     * @returns {void}
     */
    log(message?: unknown, ...optionalParams: unknown[]): void {
        this.print("log", message, ...optionalParams);
    }

    /**
     * Writes an error message, normalizing `Error` instances into message and stack output.
     * @param {unknown} message Primary message payload or `Error` instance.
     * @param {...unknown[]} optionalParams Additional values to print.
     * @returns {void}
     */
    error(message?: unknown, ...optionalParams: unknown[]): void {
        const [normalizedMessage, ...rest] =
            message instanceof Error
                ? [message.message, message.stack, ...optionalParams]
                : [message, ...optionalParams];
        this.print("error", normalizedMessage, ...rest);
    }

    /**
     * Writes a warning message when the `warn` level is enabled.
     * @param {unknown} message Primary message payload.
     * @param {...unknown[]} optionalParams Additional values to print.
     * @returns {void}
     */
    warn(message?: unknown, ...optionalParams: unknown[]): void {
        this.print("warn", message, ...optionalParams);
    }

    /**
     * Writes a debug message when the `debug` level is enabled.
     * @param {unknown} message Primary message payload.
     * @param {...unknown[]} optionalParams Additional values to print.
     * @returns {void}
     */
    debug(message?: unknown, ...optionalParams: unknown[]): void {
        this.print("debug", message, ...optionalParams);
    }

    /**
     * Writes a verbose message when the `verbose` level is enabled.
     * @param {unknown} message Primary message payload.
     * @param {...unknown[]} optionalParams Additional values to print.
     * @returns {void}
     */
    verbose(message?: unknown, ...optionalParams: unknown[]): void {
        this.print("verbose", message, ...optionalParams);
    }

    /**
     * Writes a fatal message, normalizing `Error` instances into message and stack output.
     * @param {unknown} message Primary message payload or `Error` instance.
     * @param {...unknown[]} optionalParams Additional values to print.
     * @returns {void}
     */
    fatal(message?: unknown, ...optionalParams: unknown[]): void {
        const [normalizedMessage, ...rest] =
            message instanceof Error
                ? [message.message, message.stack, ...optionalParams]
                : [message, ...optionalParams];
        this.print("fatal", normalizedMessage, ...rest);
    }

    /**
     * Formats and writes a log message using the appropriate console method.
     * @param {LogLevel} level Log level being written.
     * @param {unknown} message Primary message payload.
     * @param {...unknown[]} optionalParams Additional values to print.
     * @returns {void}
     */
    private print(
        level: LogLevel,
        message?: unknown,
        ...optionalParams: unknown[]
    ): void {
        if (!this.enabledLogLevels.has(level)) {
            return;
        }

        const timestamp = new Date().toISOString();
        const contextSuffix = this.context ? ` [${this.context}]` : "";
        const prefix = `${timestamp} ${level.toUpperCase()}${contextSuffix}:`;
        const write = this.resolveConsoleMethod(level);
        write(prefix, message, ...optionalParams);
    }

    /**
     * Resolves the console writer used for a given log level.
     * @param {LogLevel} level Log level being written.
     * @returns {(...args: unknown[]) => void} Console method for the level.
     */
    private resolveConsoleMethod(
        level: LogLevel,
    ): (...args: unknown[]) => void {
        switch (level) {
            case "error":
            case "fatal":
                return console.error;
            case "warn":
                return console.warn;
            case "debug":
                return console.debug;
            default:
                return console.log;
        }
    }
}
