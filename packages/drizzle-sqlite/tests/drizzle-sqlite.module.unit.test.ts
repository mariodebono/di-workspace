/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    findProvider,
    type TestFactoryProvider,
    type TestValueProvider,
} from "../../../tests/helpers/di.js";
import {
    DRIZZLE_SQLITE_CLIENT,
    DRIZZLE_SQLITE_MODULE_OPTIONS,
} from "../src/drizzle-sqlite.constants.js";
import { DrizzleSqliteModule } from "../src/drizzle-sqlite.module.js";
import { DrizzleSqliteClientService } from "../src/drizzle-sqlite-client.service.js";

const drizzleMocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    drizzle: vi.fn(),
    migrate: vi.fn(),
}));

vi.mock("@libsql/client", () => ({
    createClient: drizzleMocks.createClient,
}));

vi.mock("drizzle-orm/libsql", () => ({
    drizzle: drizzleMocks.drizzle,
}));

vi.mock("drizzle-orm/libsql/migrator", () => ({
    migrate: drizzleMocks.migrate,
}));

function createLogger() {
    const scoped = {
        error: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
    };

    return {
        scoped,
        logger: {
            withContext: vi.fn().mockReturnValue(scoped),
        },
    };
}

describe("DrizzleSqliteModule", () => {
    beforeEach(() => {
        drizzleMocks.createClient.mockReset();
        drizzleMocks.drizzle.mockReset();
        drizzleMocks.migrate.mockReset();
    });

    it("creates sync and async dynamic module definitions", async () => {
        const syncOptions = {
            autoMigrate: false,
            url: "file://test.db",
        };
        const syncModule = DrizzleSqliteModule.forRoot(syncOptions);

        expect(syncModule.module).toBe(DrizzleSqliteModule);
        expect(syncModule.exports).toEqual([DrizzleSqliteClientService]);
        expect(syncModule.providers).toContain(DrizzleSqliteClientService);
        expect(
            findProvider<TestValueProvider>(
                syncModule.providers,
                DRIZZLE_SQLITE_MODULE_OPTIONS,
            ).useValue,
        ).toBe(syncOptions);

        const asyncFactory = async () => syncOptions;
        const asyncModule = DrizzleSqliteModule.forRootAsync({
            imports: [class SettingsModule {}],
            inject: ["SETTINGS"],
            useFactory: asyncFactory,
        });
        const asyncOptionsProvider = findProvider<TestFactoryProvider>(
            asyncModule.providers,
            DRIZZLE_SQLITE_MODULE_OPTIONS,
        );

        expect(asyncModule.imports).toHaveLength(1);
        expect(asyncOptionsProvider.inject).toEqual(["SETTINGS"]);
        expect(asyncOptionsProvider.useFactory).toBe(asyncFactory);
    });

    it("creates a drizzle client and skips migrations when disabled", async () => {
        const close = vi.fn();
        const client = { close };
        const db = { $client: client };
        const { logger } = createLogger();
        drizzleMocks.createClient.mockReturnValue(client);
        drizzleMocks.drizzle.mockReturnValue(db);

        const moduleDef = DrizzleSqliteModule.forRoot({
            autoMigrate: false,
            url: "file://test.db",
        });
        const clientProvider = findProvider<
            TestFactoryProvider<Promise<unknown>>
        >(moduleDef.providers, DRIZZLE_SQLITE_CLIENT);

        await expect(
            clientProvider.useFactory(
                { autoMigrate: false, url: "file://test.db" },
                logger,
            ),
        ).resolves.toBe(db);

        expect(drizzleMocks.createClient).toHaveBeenCalledWith({
            autoMigrate: false,
            url: "file://test.db",
        });
        expect(drizzleMocks.drizzle).toHaveBeenCalledWith({ client });
        expect(drizzleMocks.migrate).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
    });

    it("runs migrations with the configured folder and table", async () => {
        const client = { close: vi.fn() };
        const db = { $client: client };
        const { logger, scoped } = createLogger();
        drizzleMocks.createClient.mockReturnValue(client);
        drizzleMocks.drizzle.mockReturnValue(db);
        drizzleMocks.migrate.mockResolvedValue(undefined);

        const clientProvider = findProvider<
            TestFactoryProvider<Promise<unknown>>
        >(
            DrizzleSqliteModule.forRoot({
                autoMigrate: true,
                migrationDir: "./migrations",
                migrationTableName: "custom_migrations",
                url: "file://test.db",
            }).providers,
            DRIZZLE_SQLITE_CLIENT,
        );

        await expect(
            clientProvider.useFactory(
                {
                    autoMigrate: true,
                    migrationDir: "./migrations",
                    migrationTableName: "custom_migrations",
                    url: "file://test.db",
                },
                logger,
            ),
        ).resolves.toBe(db);

        expect(drizzleMocks.migrate).toHaveBeenCalledWith(db, {
            migrationsFolder: "./migrations",
            migrationsTable: "custom_migrations",
        });
        expect(scoped.log).toHaveBeenCalledWith(
            "Drizzle SQLite migrations completed successfully.",
        );
    });

    it("warns when auto migration has no directory and closes the client on migration failure", async () => {
        const client = { close: vi.fn() };
        const db = { $client: client };
        const { logger, scoped } = createLogger();
        drizzleMocks.createClient.mockReturnValue(client);
        drizzleMocks.drizzle.mockReturnValue(db);

        const clientProvider = findProvider<
            TestFactoryProvider<Promise<unknown>>
        >(
            DrizzleSqliteModule.forRoot({
                autoMigrate: true,
                url: "file://test.db",
            }).providers,
            DRIZZLE_SQLITE_CLIENT,
        );

        await expect(
            clientProvider.useFactory(
                { autoMigrate: true, url: "file://test.db" },
                logger,
            ),
        ).resolves.toBe(db);
        expect(scoped.warn).toHaveBeenCalledWith(
            "Auto-migration is enabled but no migration directory is specified. Skipping migrations.",
        );

        const failure = new Error("migration failed");
        drizzleMocks.migrate.mockRejectedValueOnce(failure);
        await expect(
            clientProvider.useFactory(
                {
                    autoMigrate: true,
                    migrationDir: "./migrations",
                    url: "file://test.db",
                },
                logger,
            ),
        ).rejects.toBe(failure);

        expect(client.close).toHaveBeenCalledOnce();
        expect(scoped.error).toHaveBeenCalledWith(
            "Error during drizzle-sqlite migration:",
            "migration failed",
        );
    });
});
