/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";

describe("CloseBehaviorService", () => {
    it("stores and returns the hide-on-close preference", async () => {
        const { CloseBehaviorService } = await import(
            "../src/close-behavior.service.js"
        );
        const service = new CloseBehaviorService();

        expect(service.getHideOnClose()).toBe(false);
        service.setHideOnClose(true);
        expect(service.getHideOnClose()).toBe(true);
    });
});
