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
export {
    type AppLaunchContext,
    type AppLaunchOptions,
    OnAppLaunch,
} from "./app-launch.decorator.js";
export { AppReady, AppReadyOrder } from "./app-ready.decorator.js";
export {
    BridgeController,
    type BridgeControllerOptions,
    createIpcHandleTyped,
    IpcHandle,
    IpcHandleTyped,
} from "./ipc.decorator.js";
export {
    LifecycleHookOrder,
    OnAppQuit,
    OnMainWindowBlur,
    OnMainWindowClose,
    OnMainWindowFocus,
    OnMainWindowShow,
} from "./lifecycle-hooks.decorator.js";
