/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import "reflect-metadata";
import {
    createApplication,
    Injectable,
    type LoggerService,
    Module,
} from "@mariodebono/di";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleSqliteModule } from "../src/drizzle-sqlite.module.js";
import type { DrizzleSqliteOptions } from "../src/drizzle-sqlite.options.js";
import { DrizzleSqliteClientService } from "../src/drizzle-sqlite-client.service.js";
import * as drizzleSqlite from "../src/index.js";

const { createClientMock, drizzleMock, migrateMock } = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    drizzleMock: vi.fn(),
    migrateMock: vi.fn(),
}));

vi.mock("@libsql/client", () => ({
    createClient: createClientMock,
}));

vi.mock("drizzle-orm/libsql", () => ({
    drizzle: drizzleMock,
}));

vi.mock("drizzle-orm/libsql/migrator", () => ({
    migrate: migrateMock,
}));

function createRootModule(options: DrizzleSqliteOptions) {
    class RootModule {}
    Module({
        imports: [DrizzleSqliteModule.forRoot(options)],
    })(RootModule);

    return RootModule;
}

function createTestLogger(): LoggerService {
    const logger = {
        withContext: vi.fn(),
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn(),
        fatal: vi.fn(),
        setLogLevels: vi.fn(),
    };

    logger.withContext.mockReturnValue(logger);
    return logger;
}

describe("DrizzleSqliteModule", () => {
    beforeEach(() => {
        createClientMock.mockReset();
        drizzleMock.mockReset();
        migrateMock.mockReset();
        Reflect.defineMetadata(
            "design:paramtypes",
            [Object, Object],
            DrizzleSqliteClientService,
        );
    });

    it("re-exports the public entrypoint API", () => {
        expect(drizzleSqlite.DrizzleSqliteModule).toBe(DrizzleSqliteModule);
        expect(drizzleSqlite.DrizzleSqliteClientService).toBe(
            DrizzleSqliteClientService,
        );
        expect("DatabaseModule" in drizzleSqlite).toBe(false);
        expect("DatabaseClientService" in drizzleSqlite).toBe(false);
    });

    it("uses default async module options when imports and inject are omitted", async () => {
        const close = vi.fn();
        const client = { close };
        const db = { $client: client };

        createClientMock.mockReturnValue(client);
        drizzleMock.mockReturnValue(db);

        const RootModule = class {};
        Module({
            imports: [
                DrizzleSqliteModule.forRootAsync({
                    useFactory: async () => ({
                        url: "file://test.db",
                        autoMigrate: false,
                    }),
                }),
            ],
        })(RootModule);

        const app = await createApplication(RootModule, {
            logger: false,
        });

        try {
            expect(app.get(DrizzleSqliteClientService).client).toBe(db);
        } finally {
            app.destroy();
        }
    });

    it("resolves async options from injected providers and uses a custom migration table", async () => {
        const close = vi.fn();
        const client = { close };
        const db = { $client: client };

        createClientMock.mockReturnValue(client);
        drizzleMock.mockReturnValue(db);

        @Injectable()
        class SettingsService {
            getDatabaseUrl() {
                return "file://test.db";
            }
        }

        @Module({
            providers: [SettingsService],
            exports: [SettingsService],
        })
        class SettingsModule {}

        const RootModule = class {};
        Module({
            imports: [
                SettingsModule,
                DrizzleSqliteModule.forRootAsync({
                    imports: [SettingsModule],
                    inject: [SettingsService],
                    useFactory: async (settings: SettingsService) => ({
                        url: settings.getDatabaseUrl(),
                        autoMigrate: true,
                        migrationDir: "./migrations",
                        migrationTableName: "custom_migrations",
                    }),
                }),
            ],
        })(RootModule);

        const app = await createApplication(RootModule, {
            logger: false,
        });

        try {
            expect(migrateMock).toHaveBeenCalledOnce();
            expect(migrateMock).toHaveBeenCalledWith(db, {
                migrationsFolder: "./migrations",
                migrationsTable: "custom_migrations",
            });
            expect(app.get(DrizzleSqliteClientService).client).toBe(db);
        } finally {
            app.destroy();
        }
    });

    it("waits for migrations before app bootstrap resolves", async () => {
        const close = vi.fn();
        const client = { close };
        const db = { $client: client };

        createClientMock.mockReturnValue(client);
        drizzleMock.mockReturnValue(db);

        let resolveMigration: (() => void) | undefined;
        migrateMock.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveMigration = resolve;
                }),
        );

        const RootModule = createRootModule({
            url: "file://test.db",
            autoMigrate: true,
            migrationDir: "./migrations",
        });

        let isSettled = false;
        const appPromise = createApplication(RootModule, {
            logger: false,
        })
            .then((app) => {
                isSettled = true;
                return app;
            })
            .catch((error) => {
                isSettled = true;
                throw error;
            });

        await vi.waitFor(() => {
            expect(migrateMock).toHaveBeenCalledOnce();
        });
        expect(isSettled).toBe(false);

        resolveMigration?.();
        const app = await appPromise;

        try {
            expect(app.get(DrizzleSqliteClientService).client).toBe(db);
        } finally {
            app.destroy();
        }
    });

    it("does not run migrations when autoMigrate is disabled", async () => {
        const close = vi.fn();
        const client = { close };
        const db = { $client: client };

        createClientMock.mockReturnValue(client);
        drizzleMock.mockReturnValue(db);

        const RootModule = createRootModule({
            url: "file://test.db",
            autoMigrate: false,
            migrationDir: "./migrations",
        });

        const app = await createApplication(RootModule, {
            logger: false,
        });

        try {
            expect(migrateMock).not.toHaveBeenCalled();
            expect(app.get(DrizzleSqliteClientService).client).toBe(db);
        } finally {
            app.destroy();
        }
    });

    it("warns and skips migrations when autoMigrate is enabled without migrationDir", async () => {
        const close = vi.fn();
        const client = { close };
        const db = { $client: client };
        const logger = createTestLogger();

        createClientMock.mockReturnValue(client);
        drizzleMock.mockReturnValue(db);

        const RootModule = createRootModule({
            url: "file://test.db",
            autoMigrate: true,
        });

        const app = await createApplication(RootModule, {
            logger,
        });

        try {
            expect(migrateMock).not.toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith(
                "Auto-migration is enabled but no migration directory is specified. Skipping migrations.",
            );
        } finally {
            app.destroy();
        }
    });

    it("throws on migration failure and closes the raw libsql client", async () => {
        const close = vi.fn();
        const client = { close };
        const db = { $client: client };

        createClientMock.mockReturnValue(client);
        drizzleMock.mockReturnValue(db);
        migrateMock.mockRejectedValueOnce(new Error("migration failed"));

        const RootModule = createRootModule({
            url: "file://test.db",
            autoMigrate: true,
            migrationDir: "./migrations",
        });

        await expect(
            createApplication(RootModule, {
                logger: false,
            }),
        ).rejects.toThrow("migration failed");

        expect(close).toHaveBeenCalledOnce();
    });

    it("logs non-error migration failures as-is and closes the raw libsql client", async () => {
        const close = vi.fn();
        const client = { close };
        const db = { $client: client };
        const logger = createTestLogger();

        createClientMock.mockReturnValue(client);
        drizzleMock.mockReturnValue(db);
        migrateMock.mockRejectedValueOnce("migration failed");

        const RootModule = createRootModule({
            url: "file://test.db",
            autoMigrate: true,
            migrationDir: "./migrations",
        });

        await expect(
            createApplication(RootModule, {
                logger,
            }),
        ).rejects.toBe("migration failed");

        expect(logger.error).toHaveBeenCalledWith(
            "Error during drizzle-sqlite migration:",
            "migration failed",
        );
        expect(close).toHaveBeenCalledOnce();
    });
});
