/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import "reflect-metadata";

import { type Constructor, Injectable, Module } from "@mariodebono/di";
import { vi } from "vitest";
import type { AppMigrationStore } from "../src/app-migration.store.js";
import { AppMigrationsModule } from "../src/app-migrations.module.js";
import type { AppMigrationsOptions } from "../src/app-migrations.options.js";

type StoreMock = {
    listCompletedMigrationIds: () => Promise<string[]>;
    markCompleted: (id: string, executedAt: Date) => Promise<void>;
};

/**
 * Creates a mock migration store plus a journal of completion writes.
 * @param {string[]} completedIds Pre-completed migration ids.
 * @param {{ listError?: Error; markError?: Error }} overrides Optional store failure overrides.
 * @returns {{ store: StoreMock; inserted: Array<{ id: string; executedAt: Date }> }} Mock store and recorded writes.
 */
export function createStoreMock(
    completedIds: string[] = [],
    overrides: {
        listError?: Error;
        markError?: Error;
    } = {},
): {
    store: StoreMock;
    inserted: Array<{ id: string; executedAt: Date }>;
} {
    const inserted: Array<{ id: string; executedAt: Date }> = [];
    const listCompletedMigrationIds = vi.fn(async () => {
        if (overrides.listError) {
            throw overrides.listError;
        }

        return [...completedIds];
    });
    const markCompleted = vi.fn(async (id: string, executedAt: Date) => {
        if (overrides.markError) {
            throw overrides.markError;
        }

        inserted.push({ id, executedAt });
    });

    return {
        store: {
            listCompletedMigrationIds,
            markCompleted,
        },
        inserted,
    };
}

/**
 * Creates a concrete store class backed by the provided mock implementation.
 * @param {StoreMock} store Mock store implementation.
 * @returns {Constructor<AppMigrationStore>} Injectable store class.
 */
export function createStoreService(
    store: StoreMock,
): Constructor<AppMigrationStore> {
    @Injectable()
    class StoreService implements AppMigrationStore {
        async listCompletedMigrationIds(): Promise<string[]> {
            return store.listCompletedMigrationIds();
        }

        async markCompleted(id: string, executedAt: Date): Promise<void> {
            return store.markCompleted(id, executedAt);
        }
    }

    return StoreService;
}

/**
 * Builds a root module that imports the feature module and migrations module.
 * @param {unknown} featureModule Feature module containing migration providers.
 * @param {StoreMock} store Mock store implementation.
 * @param {Omit<AppMigrationsOptions, "store">} options Additional migration module options.
 * @returns {Constructor} Root test module.
 */
export function createRootModule(
    featureModule: unknown,
    store: StoreMock,
    options: Omit<AppMigrationsOptions, "store"> = {},
): Constructor {
    const StoreService = createStoreService(store);

    @Module({
        imports: [
            featureModule as never,
            AppMigrationsModule.forRoot({
                ...options,
                store: StoreService,
            }),
        ],
    })
    class RootModule {}

    return RootModule;
}
