/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Error thrown when a fatal application migration fails during bootstrap.
 */
export class AppMigrationExecutionError extends Error {
    readonly migrationId: string;
    override readonly cause: unknown;

    /**
     * Creates a new migration execution error.
     * @param {string} migrationId Failed migration identifier.
     * @param {unknown} cause Original failure cause.
     */
    constructor(migrationId: string, cause: unknown) {
        super(`App migration "${migrationId}" failed.`);
        this.name = AppMigrationExecutionError.name;
        this.migrationId = migrationId;
        this.cause = cause;
    }
}
