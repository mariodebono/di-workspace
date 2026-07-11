/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { contextBridge, ipcRenderer, webUtils } from "electron";
import {
    DI_ELECTRON_IPC_GLOBAL,
    type RendererIpcListener,
    type RendererIpcTransport,
} from "./ipc-transport.js";

type IpcRendererListener = (
    event: Electron.IpcRendererEvent,
    ...args: unknown[]
) => void;

const listenerMap = new Map<
    string,
    WeakMap<RendererIpcListener, IpcRendererListener>
>();

const transport: RendererIpcTransport = {
    invoke(channel, ...args) {
        return ipcRenderer.invoke(channel, ...args);
    },
    on(channel, listener) {
        const channelListeners = getChannelListeners(channel);
        const existingListener = channelListeners.get(listener);

        if (existingListener) {
            return;
        }

        const wrappedListener: IpcRendererListener = (_event, ...args) => {
            listener(...args);
        };

        channelListeners.set(listener, wrappedListener);
        ipcRenderer.on(channel, wrappedListener);
    },
    off(channel, listener) {
        const channelListeners = listenerMap.get(channel);
        const wrappedListener = channelListeners?.get(listener);

        if (!wrappedListener) {
            return;
        }

        ipcRenderer.removeListener(channel, wrappedListener);
        channelListeners?.delete(listener);
    },
    getPathForFile(file) {
        return webUtils.getPathForFile(file);
    },
};

contextBridge.exposeInMainWorld(DI_ELECTRON_IPC_GLOBAL, transport);

function getChannelListeners(
    channel: string,
): WeakMap<RendererIpcListener, IpcRendererListener> {
    const existingListeners = listenerMap.get(channel);
    if (existingListeners) {
        return existingListeners;
    }

    const createdListeners = new WeakMap<
        RendererIpcListener,
        IpcRendererListener
    >();
    listenerMap.set(channel, createdListeners);
    return createdListeners;
}
