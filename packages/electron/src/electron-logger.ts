/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from "node:fs";
import path from "node:path";
import type { LoggerService, LogLevel } from "@mariodebono/di";
import log, { type LevelOption, type LogFile } from "electron-log";

type ElectronLogInstance = ReturnType<typeof log.create>;
const DEFAULT_LOG_LEVELS: LogLevel[] = [
    "log",
    "error",
    "warn",
    "debug",
    "verbose",
    "fatal",
];

/** Options used to configure the Electron logger integration. */
export interface ElectronLoggerOptions {
    /** Optional application name used by electron-log for file metadata. */
    appName?: string;
    /** Log level for file transport. */
    fileLevel?: LevelOption;
    /** Log level for console transport. */
    consoleLevel?: LevelOption;
    /** Absolute or relative path for the log file. */
    logFilePath?: string;
    /** Max size in bytes before the file is archived (renamed with a date suffix). */
    maxSize?: number;
    /** Hook to tweak the underlying electron-log instance before use. */
    configure?: (logger: ElectronLogInstance) => void;
    /** Provide an existing electron-log instance to reuse across loggers. */
    loggerInstance?: ElectronLogInstance;
}

/** LoggerService implementation backed by electron-log. */
export class ElectronLogger implements LoggerService {
    private context?: string;
    private readonly logger: ElectronLogInstance;
    private readonly options: ElectronLoggerOptions;
    private enabledLogLevels: Set<LogLevel>;

    /**
     * Create an Electron logger that decorates electron-log with context and
     * optional file/console configuration.
     *
     * @param {ElectronLoggerOptions} [options] - Logger configuration.
     */
    constructor(options: ElectronLoggerOptions = {}) {
        this.options = options;
        const usesExistingInstance = Boolean(options.loggerInstance);
        this.enabledLogLevels = new Set(DEFAULT_LOG_LEVELS);
        this.logger =
            options.loggerInstance ??
            log.create({ logId: options.appName ?? "electron-app" });

        if (options.logFilePath) {
            const logsDirectory = path.dirname(options.logFilePath);
            fs.mkdirSync(logsDirectory, { recursive: true });
            this.logger.transports.file.fileName = path.basename(
                options.logFilePath,
            );
            this.logger.transports.file.resolvePathFn = () =>
                options.logFilePath as string;
            this.logger.transports.file.format =
                "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] ({processType}) {text}";
            if (options.maxSize) {
                this.logger.transports.file.maxSize = options.maxSize;
            }
            this.logger.transports.file.archiveLogFn = (
                oldLogFile: LogFile,
            ) => {
                const stamp = new Date().toISOString().slice(0, 10);
                const ext = path.extname(oldLogFile.path);
                const base = path.basename(oldLogFile.path, ext);
                const dir = path.dirname(oldLogFile.path);
                const archived = path.join(dir, `${base}-${stamp}${ext}`);
                try {
                    fs.renameSync(oldLogFile.path, archived);
                } catch (error) {
                    this.logger.error?.(
                        `[ElectronLogger] Failed to archive log file`,
                        error,
                    );
                }
                return archived;
            };
        }

        if (options.appName) {
            this.logger.transports.file.setAppName(options.appName);
        }

        if (options.consoleLevel) {
            this.logger.transports.console.level = options.consoleLevel;
        }
        if (options.fileLevel) {
            this.logger.transports.file.level = options.fileLevel;
        }

        options.configure?.(this.logger);
        if (!usesExistingInstance) {
            this.logger.initialize();
        }
    }

    /** Attach a context label that will prefix emitted log messages. */
    private bindContext(context: string): void {
        this.context = context;
    }

    /** Returns a logger that prefixes messages with the provided context. */
    withContext(context: string): ElectronLogger {
        const next = new ElectronLogger({
            ...this.options,
            loggerInstance: this.logger,
        });
        next.setLogLevels([...this.enabledLogLevels]);
        next.bindContext(context);
        return next;
    }

    /** Configure which log levels are enabled for this logger instance. */
    setLogLevels(levels: LogLevel[]): void {
        this.enabledLogLevels = new Set(levels);
    }

    /** Create a child logger that shares the same electron-log instance. */
    createChildLogger(name: string): ElectronLogger {
        return this.withContext(name);
    }

    /** Info-level logging (mapped to electron-log info). */
    log(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.enabledLogLevels.has("log")) {
            return;
        }
        this.logger.info(this.format(message), ...optionalParams);
    }

    /** Error-level logging (maps Error to message + stack). */
    error(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.enabledLogLevels.has("error")) {
            return;
        }
        const [normalizedMessage, ...rest] =
            message instanceof Error
                ? [message.message, message.stack, ...optionalParams]
                : [message, ...optionalParams];
        this.logger.error(this.format(normalizedMessage), ...rest);
    }

    /** Warn-level logging. */
    warn(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.enabledLogLevels.has("warn")) {
            return;
        }
        this.logger.warn(this.format(message), ...optionalParams);
    }

    /** Debug-level logging. */
    debug(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.enabledLogLevels.has("debug")) {
            return;
        }
        this.logger.debug(this.format(message), ...optionalParams);
    }

    /** Verbose-level logging. */
    verbose(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.enabledLogLevels.has("verbose")) {
            return;
        }
        this.logger.info(this.format(message), ...optionalParams);
    }

    /** Fatal-level logging. */
    fatal(message?: unknown, ...optionalParams: unknown[]): void {
        if (!this.enabledLogLevels.has("fatal")) {
            return;
        }
        const [normalizedMessage, ...rest] =
            message instanceof Error
                ? [message.message, message.stack, ...optionalParams]
                : [message, ...optionalParams];
        this.logger.error(this.format(normalizedMessage), ...rest);
    }

    /** Format a message with the active context prefix when present. */
    private format(message?: unknown): unknown {
        if (!this.context) return message;
        return `[${this.context}] ${String(message ?? "")}`;
    }
}

/**
 * Create a configured Electron logger instance.
 *
 * @param {ElectronLoggerOptions} [options] - Logger configuration.
 */
export function createElectronLogger(
    options?: ElectronLoggerOptions,
): ElectronLogger {
    return new ElectronLogger(options);
}
