/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    BridgeController,
    createIpcHandleTyped,
} from "@mariodebono/di-electron";

import { I18N_BRIDGE_NAMESPACE } from "./i18n.constants.js";
// biome-ignore lint/style/useImportType: Used for runtime DI resolution.
import { I18nService } from "./i18n.service.js";
import type {
    I18nBridgeApi,
    I18nBridgeState,
    I18nResourcesByNamespace,
} from "./i18n.types.js";

const I18NHandler = createIpcHandleTyped<I18nBridgeApi>();

/**
 * IPC controller that exposes i18n state and commands to the renderer.
 */
@BridgeController({ namespace: I18N_BRIDGE_NAMESPACE })
export class I18nBridgeController {
    constructor(private readonly i18nService: I18nService) {}

    @I18NHandler("getState")
    async getState(): Promise<I18nBridgeState> {
        return await this.i18nService.getState();
    }

    @I18NHandler("setLocale")
    async setLocale(locale: string): Promise<I18nBridgeState> {
        await this.i18nService.setLocale(locale);
        return await this.i18nService.getState();
    }

    @I18NHandler("getResources")
    async getResources(locale?: string): Promise<I18nResourcesByNamespace> {
        return await this.i18nService.getResources(locale);
    }
}
