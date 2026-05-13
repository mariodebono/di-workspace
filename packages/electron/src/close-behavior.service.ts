/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { Injectable } from "@mariodebono/di";

/** Stores whether the main window should hide instead of quitting on close. */
@Injectable()
export class CloseBehaviorService {
    private hideOnClose = false;

    /**
     * Configure whether closing should hide the app instead of quitting.
     *
     * @param {boolean} value - True to hide on close, false to quit normally.
     */
    setHideOnClose(value: boolean): void {
        this.hideOnClose = value;
    }

    /** Return the current hide-on-close preference. */
    getHideOnClose(): boolean {
        return this.hideOnClose;
    }
}
