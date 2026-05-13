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
import { Module, type ProviderToken } from "@mariodebono/di";
import { CloseBehaviorService } from "./close-behavior.service.js";
import { ElectronAppService } from "./electron-app.service.js";
import { WindowManagerService } from "./window-manager.js";

/** Provider token for Electron module configuration values. */
export const ELECTRON_MODULE_OPTIONS: ProviderToken = Symbol(
    "electron:module-options",
);

/** Minimal platform module that exposes the Electron application services. */
@Module({
    providers: [WindowManagerService, CloseBehaviorService, ElectronAppService],
    exports: [WindowManagerService, ElectronAppService, CloseBehaviorService],
})
export class ElectronModule {}
