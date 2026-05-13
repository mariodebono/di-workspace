/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import { AppMigration } from "../src/app-migration.decorator.js";
import {
    formatToken,
    getRegisteredMigrations,
} from "../src/app-migrations.registry.js";

describe("app migrations registry", () => {
    it("sorts registered migrations by id", () => {
        @AppMigration({ id: "20260417133000-second" })
        class SecondMigration {
            async execute(): Promise<void> {}
        }

        @AppMigration({ id: "20260417132000-first" })
        class FirstMigration {
            async execute(): Promise<void> {}
        }

        expect(
            getRegisteredMigrations([SecondMigration, FirstMigration]).map(
                (migration) => migration.id,
            ),
        ).toEqual(["20260417132000-first", "20260417133000-second"]);
    });

    it("throws when a tagged provider is missing migration metadata", () => {
        class UndecoratedMigration {
            async execute(): Promise<void> {}
        }

        expect(() => getRegisteredMigrations([UndecoratedMigration])).toThrow(
            'Tagged app migration provider "UndecoratedMigration" is missing migration metadata.',
        );
    });

    it("throws when duplicate migration ids are registered", () => {
        @AppMigration({ id: "20260417134000-duplicate" })
        class FirstDuplicateMigration {
            async execute(): Promise<void> {}
        }

        @AppMigration({ id: "20260417134000-duplicate" })
        class SecondDuplicateMigration {
            async execute(): Promise<void> {}
        }

        expect(() =>
            getRegisteredMigrations([
                FirstDuplicateMigration,
                SecondDuplicateMigration,
            ]),
        ).toThrow("Duplicate app migration id(s) found");
    });

    it("formats symbol, function, and string tokens", () => {
        function FunctionToken(): void {}

        expect(formatToken(Symbol("migration"))).toBe("Symbol(migration)");
        expect(formatToken(FunctionToken)).toBe("FunctionToken");
        expect(formatToken("string-token")).toBe("string-token");
    });
});
