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
    type CreateElectronApplicationOptions,
    type CreateElectronApplicationResult,
    createElectronApplication,
} from "./application.js";
export { CloseBehaviorService } from "./close-behavior.service.js";
export {
    type AppLaunchContext,
    type AppLaunchOptions,
    OnAppLaunch,
} from "./decorators/app-launch.decorator.js";
export { AppReady, AppReadyOrder } from "./decorators/app-ready.decorator.js";
export {
    BridgeController,
    type BridgeControllerOptions,
    createIpcHandleTyped,
    IpcHandle,
    IpcHandleTyped,
} from "./decorators/ipc.decorator.js";
export {
    LifecycleHookOrder,
    OnAppQuit,
    OnMainWindowBlur,
    OnMainWindowClose,
    OnMainWindowFocus,
    OnMainWindowShow,
} from "./decorators/lifecycle-hooks.decorator.js";
export { ElectronAppService } from "./electron-app.service.js";
export {
    createElectronLogger,
    ElectronLogger,
    type ElectronLoggerOptions,
} from "./electron-logger.js";
export type { IpcEventValidator } from "./ipc.js";
export {
    DEFAULT_IPC_ERROR_MESSAGE,
    DEFAULT_IPC_ERROR_TYPE,
    IpcError,
    isIpcError,
    isSerializedIpcError,
    type SerializedIpcError,
    serializeIpcError,
    toClientIpcError,
} from "./ipc-error.js";
export { ElectronModule } from "./module.js";
export {
    type CreateWindowOptions,
    type WindowBasePath,
    WindowManagerService,
} from "./window-manager.js";
