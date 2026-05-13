/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Store contract used to journal completed application migrations.
 */
export interface AppMigrationStore {
    /**
     * Lists migration ids that have already completed successfully.
     * @returns {Promise<string[]>} Completed migration identifiers.
     */
    listCompletedMigrationIds(): Promise<string[]>;
    /**
     * Marks a migration as completed at the provided execution time.
     * @param {string} id Completed migration identifier.
     * @param {Date} executedAt Migration completion timestamp.
     * @returns {Promise<void>}
     */
    markCompleted(id: string, executedAt: Date): Promise<void>;
}
