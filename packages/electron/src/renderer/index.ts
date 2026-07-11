/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { unwrapIpcResponse } from "../ipc-response.js";
import {
    DI_ELECTRON_IPC_GLOBAL,
    type RendererIpcListener,
    type RendererIpcTransport,
} from "../ipc-transport.js";

export type { RendererIpcListener, RendererIpcTransport };

export type RendererEventBridge = Pick<RendererIpcTransport, "on" | "off">;

export function createRendererBridge<T>(
    transport: RendererIpcTransport = getDefaultRendererTransport(),
): T {
    return createBridgeNode(transport, []) as T;
}

export function createRendererEvents(
    transport: RendererIpcTransport = getDefaultRendererTransport(),
): RendererEventBridge {
    return {
        on(channel: string, listener: RendererIpcListener): void {
            transport.on(channel, listener);
        },
        off(channel: string, listener: RendererIpcListener): void {
            transport.off(channel, listener);
        },
    };
}

/** Return the native filesystem path for a renderer File object. */
export function getPathForFile(
    file: File,
    transport: RendererIpcTransport = getDefaultRendererTransport(),
): string {
    if (!transport.getPathForFile) {
        throw new Error(
            "The DI Electron preload bridge does not support native file paths",
        );
    }

    return transport.getPathForFile(file);
}

export function getDefaultRendererTransport(): RendererIpcTransport {
    if (typeof window === "undefined") {
        throw new Error(
            "The DI Electron renderer bridge is only available in a browser window",
        );
    }

    const transport = window[DI_ELECTRON_IPC_GLOBAL];
    if (!transport) {
        throw new Error(
            "The DI Electron preload bridge is not available on this window",
        );
    }

    return transport;
}

function createBridgeNode(
    transport: RendererIpcTransport,
    path: string[],
): unknown {
    return new Proxy(() => undefined, {
        get(_target, property) {
            if (property === "then") {
                return undefined;
            }

            if (typeof property !== "string") {
                return undefined;
            }

            return createBridgeNode(transport, [...path, property]);
        },
        apply(_target, _thisArg, argumentsList) {
            if (!path.length) {
                throw new Error(
                    "The DI Electron renderer bridge root is not callable",
                );
            }

            return transport
                .invoke(path.join("."), ...argumentsList)
                .then((value) => unwrapIpcResponse(value));
        },
    });
}

declare global {
    interface Window {
        [DI_ELECTRON_IPC_GLOBAL]?: RendererIpcTransport;
    }
}
