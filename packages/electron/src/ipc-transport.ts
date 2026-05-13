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
export const DI_ELECTRON_IPC_GLOBAL = "__di_electron__";

export type RendererIpcListener = (...args: unknown[]) => void;

export type RendererIpcTransport = {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, listener: RendererIpcListener): void;
    off(channel: string, listener: RendererIpcListener): void;
};
