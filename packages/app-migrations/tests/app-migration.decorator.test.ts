/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Injectable, metadataKeys } from "@mariodebono/di";
import { describe, expect, it } from "vitest";
import {
    AppMigration,
    getAppMigrationMetadata,
} from "../src/app-migration.decorator.js";
import { APP_MIGRATION_TAG } from "../src/app-migrations.constants.js";

describe("AppMigration decorator", () => {
    it("throws for empty or blank ids", () => {
        expect(() => AppMigration({ id: "" })).toThrow(
            "@AppMigration requires a non-empty id.",
        );
        expect(() => AppMigration({ id: "   " })).toThrow(
            "@AppMigration requires a non-empty id.",
        );
    });

    it("throws when applied to a class without execute()", () => {
        expect(() => {
            @AppMigration({ id: "20260417130000-invalid" })
            class InvalidMigration {}
            return InvalidMigration;
        }).toThrow(
            "@AppMigration can only be applied to classes with an execute() method.",
        );
    });

    it("attaches metadata, preserves existing tags, and only adds the migration tag once", () => {
        @Injectable({
            tags: ["existing"],
        })
        class ValidMigration {
            async execute(): Promise<void> {}
        }

        AppMigration({
            id: "20260417130500-valid",
            description: "test migration",
        })(ValidMigration);
        AppMigration({
            id: "20260417130500-valid",
        })(ValidMigration);

        expect(getAppMigrationMetadata(ValidMigration)).toEqual({
            id: "20260417130500-valid",
        });

        const injectableOptions = Reflect.getMetadata(
            metadataKeys.injectableOptions,
            ValidMigration,
        ) as { tags?: unknown[] };

        expect(injectableOptions.tags).toEqual(["existing", APP_MIGRATION_TAG]);
    });

    it("returns undefined metadata for non-function targets", () => {
        expect(getAppMigrationMetadata("not-a-class")).toBeUndefined();
    });
});
