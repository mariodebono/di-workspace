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
import type { Application, ProviderToken } from "@mariodebono/di";

import { type IpcMainInvokeEvent, ipcMain } from "electron";
import "reflect-metadata";
import { IpcError, serializeIpcError } from "./ipc-error.js";
import {
    createIpcErrorResponse,
    createIpcSuccessResponse,
} from "./ipc-response.js";

export {
    BridgeController,
    CONTROLLER_INJECTABLE_TAG,
    CONTROLLER_METADATA_KEY,
    CONTROLLER_NAMESPACE_METADATA_KEY,
    createIpcHandleTyped,
    IPC_HANDLER_METADATA_KEY,
    IpcHandle,
    IpcHandleTyped,
} from "./decorators/ipc.decorator.js";

/** Validates an incoming IPC invocation before its controller method runs. */
export type IpcEventValidator = (
    event: IpcMainInvokeEvent,
    channel: string,
) => void | Promise<void>;

class InvalidIpcSenderError extends IpcError {
    constructor() {
        super("electron.invalid_ipc_sender", "Invalid IPC sender");
    }
}

import type { HandlerMetadata } from "./decorators/ipc.decorator.js";
import {
    CONTROLLER_METADATA_KEY,
    IPC_HANDLER_METADATA_KEY,
} from "./decorators/ipc.decorator.js";
import type { WindowManagerService } from "./window-manager.js";

/** Creates the package IPC validator with optional additional consumer rules. */
export function createIpcEventValidator(
    windowManager: Pick<WindowManagerService, "isTrustedIpcSender">,
    additionalValidator?: IpcEventValidator,
): IpcEventValidator {
    return async (event, channel) => {
        if (
            !windowManager.isTrustedIpcSender(event.sender, event.senderFrame)
        ) {
            throw new InvalidIpcSenderError();
        }

        await additionalValidator?.(event, channel);
    };
}

/**
 * Registers all IPC handlers defined on bridge controllers with Electron's ipcMain.
 *
 * @param {ProviderToken[]} controllers - Tokens tagged as bridge controllers.
 * @param {Application} container - Application container used to resolve controller instances.
 */
export function registerIpcControllers(
    controllers: ProviderToken[],
    container: Application,
    validateEvent: IpcEventValidator,
): void {
    for (const controller of controllers) {
        const handlers =
            (Reflect.getMetadata(IPC_HANDLER_METADATA_KEY, controller) as
                | HandlerMetadata[]
                | undefined) ?? [];
        if (!handlers.length) continue;
        const instance = container.get(controller);
        const namespace = getControllerNamespace(controller);
        for (const handler of handlers) {
            const channel = handler.useControllerNamespace
                ? `${namespace}.${handler.channel}`
                : handler.channel;

            ipcMain.handle(channel, async (event, ...args) => {
                try {
                    await validateEvent(event, channel);
                    // biome-ignore lint/suspicious/noExplicitAny: Allow explicit any for method call
                    const result = await (instance as any)[handler.methodName](
                        ...args,
                    );
                    return createIpcSuccessResponse(result);
                } catch (error) {
                    return createIpcErrorResponse(serializeIpcError(error));
                }
            });
        }
    }
}

function getControllerNamespace(controller: ProviderToken): string {
    const metadata = Reflect.getMetadata(CONTROLLER_METADATA_KEY, controller) as
        | { namespace?: string }
        | undefined;

    if (
        typeof metadata?.namespace !== "string" ||
        metadata.namespace.length === 0
    ) {
        throw new Error("Bridge controllers require a namespace");
    }

    return metadata.namespace;
}
