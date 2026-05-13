/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ProviderToken } from "@mariodebono/di";
import { getAppMigrationMetadata } from "./app-migration.decorator.js";

/**
 * Registered migration metadata resolved from tagged providers.
 */
export type RegisteredMigration = {
    token: ProviderToken;
    id: string;
    fatal: boolean | undefined;
};

/**
 * Resolves and validates migration metadata from tagged providers.
 * @param {ProviderToken[]} tokens Tagged provider tokens returned by `ModuleRef.findByTag()`.
 * @returns {RegisteredMigration[]} Sorted migration registrations.
 */
export function getRegisteredMigrations(
    tokens: ProviderToken[],
): RegisteredMigration[] {
    const migrations = tokens.map((token) => {
        const metadata = getAppMigrationMetadata(token);
        if (!metadata) {
            throw new Error(
                `Tagged app migration provider "${formatToken(token)}" is missing migration metadata.`,
            );
        }

        return {
            token,
            id: metadata.id,
            fatal: metadata.fatal,
        };
    });

    const duplicateIds = migrations
        .map((migration) => migration.id)
        .filter((id, index, ids) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
        throw new Error(
            `Duplicate app migration id(s) found: ${[...new Set(duplicateIds)].join(", ")}`,
        );
    }

    return migrations.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Formats a provider token for human-readable error messages.
 * @param {ProviderToken} token Provider token to describe.
 * @returns {string} Human-readable token label.
 */
export function formatToken(token: ProviderToken): string {
    if (typeof token === "symbol") {
        return token.toString();
    }

    if (typeof token === "function") {
        return token.name;
    }

    return String(token);
}
