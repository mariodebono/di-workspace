/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    Injectable,
    type InjectableOptions,
    metadataKeys,
} from "@mariodebono/di";
import "reflect-metadata";
import type {
    AppMigrationOptions,
    AppMigrationRunnable,
} from "./app-migration.types.js";
import {
    APP_MIGRATION_METADATA_KEY,
    APP_MIGRATION_TAG,
} from "./app-migrations.constants.js";

/**
 * Reads migration metadata from a decorated migration class.
 * @param {unknown} target Potential migration class target.
 * @returns {AppMigrationOptions | undefined} Attached migration metadata when available.
 */
export function getAppMigrationMetadata(
    target: unknown,
): AppMigrationOptions | undefined {
    if (typeof target !== "function") {
        return undefined;
    }

    return Reflect.getMetadata(APP_MIGRATION_METADATA_KEY, target) as
        | AppMigrationOptions
        | undefined;
}

/**
 * Marks a class as an application bootstrap migration.
 * @param {AppMigrationOptions} options Migration registration options.
 * @returns {ClassDecorator} Class decorator that stores migration metadata and tags the provider.
 */
export function AppMigration(options: AppMigrationOptions): ClassDecorator {
    if (!options.id.trim()) {
        throw new Error("@AppMigration requires a non-empty id.");
    }

    return (target) => {
        if (typeof target !== "function") {
            throw new Error("@AppMigration can only be applied to classes.");
        }

        const migrationTarget = target as typeof target & {
            prototype: AppMigrationRunnable;
        };

        if (typeof migrationTarget.prototype.execute !== "function") {
            throw new Error(
                "@AppMigration can only be applied to classes with an execute() method.",
            );
        }

        Reflect.defineMetadata(APP_MIGRATION_METADATA_KEY, options, target);
        tagInjectableForAppMigration(target);
    };
}

/**
 * Ensures a decorated migration class is also tagged as injectable.
 * @param {object} target Migration class constructor.
 * @returns {void}
 */
function tagInjectableForAppMigration(target: object): void {
    const existingOptions =
        (Reflect.getMetadata(metadataKeys.injectableOptions, target) as
            | InjectableOptions
            | undefined) ?? {};
    const existingTags = existingOptions.tags ?? [];

    if (existingTags.includes(APP_MIGRATION_TAG)) {
        return;
    }

    Injectable({
        ...existingOptions,
        tags: [...existingTags, APP_MIGRATION_TAG],
    })(target as never);
}
