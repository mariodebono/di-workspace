/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    createRendererBridge,
    createRendererEvents,
    getDefaultRendererTransport,
    type RendererIpcListener,
    type RendererIpcTransport,
} from "@mariodebono/di-electron/renderer";

import {
    I18N_BRIDGE_NAMESPACE,
    I18N_LOCALE_CHANGED_EVENT,
} from "./i18n.constants.js";
import type {
    I18nBridgeApi,
    I18nLocaleChangedEvent,
    I18nRendererEvents,
} from "./i18n.types.js";

export type {
    I18nBridgeApi,
    I18nBridgeState,
    I18nLocaleChangedEvent,
    I18nNamespaceResource,
    I18nRendererEvents,
    I18nResourcesByNamespace,
} from "./i18n.types.js";

/**
 * Creates a typed renderer bridge for the i18n namespace.
 *
 * @param transport Optional transport override for tests.
 * @returns Renderer bridge for i18n state and commands.
 */
export function createI18nRendererBridge(
    transport: RendererIpcTransport = getDefaultRendererTransport(),
): I18nBridgeApi {
    return createRendererBridge<I18nBridgeApi>(
        createPrefixedTransport(I18N_BRIDGE_NAMESPACE, transport),
    );
}

/**
 * Creates typed renderer event helpers for i18n locale changes.
 *
 * @param transport Optional transport override for tests.
 * @returns Renderer event bridge for locale change notifications.
 */
export function createI18nRendererEvents(
    transport: RendererIpcTransport = getDefaultRendererTransport(),
): I18nRendererEvents {
    const namespacedTransport = createPrefixedTransport(
        I18N_BRIDGE_NAMESPACE,
        transport,
    );
    const events = createRendererEvents(namespacedTransport);

    return {
        onLocaleChanged(
            listener: (event: I18nLocaleChangedEvent) => void,
        ): void {
            events.on(
                I18N_LOCALE_CHANGED_EVENT,
                listener as RendererIpcListener,
            );
        },
        offLocaleChanged(
            listener: (event: I18nLocaleChangedEvent) => void,
        ): void {
            events.off(
                I18N_LOCALE_CHANGED_EVENT,
                listener as RendererIpcListener,
            );
        },
    };
}

function createPrefixedTransport(
    namespace: string,
    transport: RendererIpcTransport,
): RendererIpcTransport {
    return {
        invoke(channel: string, ...args: unknown[]): Promise<unknown> {
            return transport.invoke(`${namespace}.${channel}`, ...args);
        },
        on(channel: string, listener: RendererIpcListener): void {
            transport.on(`${namespace}.${channel}`, listener);
        },
        off(channel: string, listener: RendererIpcListener): void {
            transport.off(`${namespace}.${channel}`, listener);
        },
    };
}
