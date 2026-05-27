/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from "node:fs";
import log from "electron-log";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    createElectronLogger,
    ElectronLogger,
} from "../src/electron-logger.js";

const electronLogMocks = vi.hoisted(() => {
    const instances: Array<{
        debug: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        info: ReturnType<typeof vi.fn>;
        initialize: ReturnType<typeof vi.fn>;
        transports: {
            console: { level?: string };
            file: {
                archiveLogFn?: (file: { path: string }) => string;
                fileName?: string;
                format?: string;
                level?: string;
                maxSize?: number;
                resolvePathFn?: () => string;
                setAppName: ReturnType<typeof vi.fn>;
            };
        };
        warn: ReturnType<typeof vi.fn>;
    }> = [];

    return {
        create: vi.fn((_: unknown) => {
            const instance = {
                debug: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
                initialize: vi.fn(),
                transports: {
                    console: {},
                    file: {
                        setAppName: vi.fn(),
                    },
                },
                warn: vi.fn(),
            };
            instances.push(instance);
            return instance;
        }),
        instances,
    };
});

vi.mock("electron-log", () => ({
    default: {
        create: electronLogMocks.create,
    },
}));

vi.mock("node:fs", () => ({
    default: {
        mkdirSync: vi.fn(),
        renameSync: vi.fn(),
    },
}));

beforeEach(() => {
    electronLogMocks.create.mockClear();
    electronLogMocks.instances.length = 0;
    vi.mocked(fs.mkdirSync).mockClear();
    vi.mocked(fs.renameSync).mockReset();
});

describe("ElectronLogger", () => {
    it("configures a new electron-log instance and archives log files", () => {
        const configure = vi.fn();
        const logger = createElectronLogger({
            appName: "launcher",
            configure,
            consoleLevel: "warn",
            fileLevel: "error",
            logFilePath: "/tmp/logs/launcher.log",
            maxSize: 512,
        });
        const instance = electronLogMocks.instances[0];

        expect(logger).toBeInstanceOf(ElectronLogger);
        expect(log.create).toHaveBeenCalledWith({ logId: "launcher" });
        expect(fs.mkdirSync).toHaveBeenCalledWith("/tmp/logs", {
            recursive: true,
        });
        expect(instance?.transports.file.fileName).toBe("launcher.log");
        expect(instance?.transports.file.resolvePathFn?.()).toBe(
            "/tmp/logs/launcher.log",
        );
        expect(instance?.transports.file.format).toBe(
            "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] ({processType}) {text}",
        );
        expect(instance?.transports.file.maxSize).toBe(512);
        expect(instance?.transports.console.level).toBe("warn");
        expect(instance?.transports.file.level).toBe("error");
        expect(instance?.transports.file.setAppName).toHaveBeenCalledWith(
            "launcher",
        );
        expect(configure).toHaveBeenCalledWith(instance);
        expect(instance?.initialize).toHaveBeenCalledOnce();

        const archivedPath = instance?.transports.file.archiveLogFn?.({
            path: "/tmp/logs/launcher.log",
        });

        expect(archivedPath?.replace(/\\/g, "/")).toMatch(
            /^\/tmp\/logs\/launcher-\d{4}-\d{2}-\d{2}\.log$/,
        );
        expect(fs.renameSync).toHaveBeenCalledWith(
            "/tmp/logs/launcher.log",
            archivedPath,
        );
    });

    it("logs archive failures and keeps using the same logger instance for child contexts", () => {
        const baseLogger = electronLogMocks.create({});
        vi.mocked(fs.renameSync).mockImplementation(() => {
            throw new Error("rename failed");
        });

        const logger = new ElectronLogger({
            loggerInstance: baseLogger as never,
            logFilePath: "/tmp/logs/app.log",
        });
        logger.setLogLevels(["warn", "error", "fatal"]);
        const child = logger.withContext("Bootstrap");
        child.log("skipped");
        child.warn("careful");
        child.error(new Error("boom"));
        child.fatal(new Error("fatal"));
        baseLogger.transports.file.archiveLogFn?.({
            path: "/tmp/logs/app.log",
        });

        expect(baseLogger.initialize).not.toHaveBeenCalled();
        expect(baseLogger.info).not.toHaveBeenCalled();
        expect(baseLogger.warn).toHaveBeenCalledWith("[Bootstrap] careful");
        expect(baseLogger.error).toHaveBeenNthCalledWith(
            1,
            "[Bootstrap] boom",
            expect.stringContaining("Error: boom"),
        );
        expect(baseLogger.error).toHaveBeenNthCalledWith(
            2,
            "[Bootstrap] fatal",
            expect.stringContaining("Error: fatal"),
        );
        expect(baseLogger.error).toHaveBeenNthCalledWith(
            3,
            "[ElectronLogger] Failed to archive log file",
            expect.any(Error),
        );
    });

    it("maps verbose logging to info and leaves disabled levels silent", () => {
        const logger = new ElectronLogger();
        const instance = electronLogMocks.instances[0];

        logger.setLogLevels(["debug", "verbose"]);
        logger.log("skip");
        logger.debug("details");
        logger.verbose("trace");

        expect(instance?.debug).toHaveBeenCalledWith("details");
        expect(instance?.info).toHaveBeenCalledWith("trace");
        expect(instance?.warn).not.toHaveBeenCalled();
    });
});
