/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export { I18nBridgeController } from "./i18n.bridge.js";
/**
 * Public exports for the shared i18n package.
 */
export {
    I18N_BRIDGE_NAMESPACE,
    I18N_LOCALE_CHANGED_EVENT,
} from "./i18n.constants.js";
export {
    createI18nLocaleChangedHookRunner,
    getLocaleChangedHandlers,
    type I18nLocaleChangedHandlerMetadata,
    type I18nLocaleChangedHookOptions,
    type I18nLocaleChangedHookRunner,
    type I18nLocaleChangedInvocation,
    OnLocaleChanged,
} from "./i18n.hooks.js";
export { I18nModule } from "./i18n.module.js";
export type {
    I18nModuleAsyncOptions,
    I18nModuleOptions,
} from "./i18n.options.js";
export { I18nService } from "./i18n.service.js";
export type {
    I18nBridgeApi,
    I18nBridgeState,
    I18nLocaleChangedEvent,
    I18nLocalePreference,
    I18nRendererEvents,
    I18nResourcesByNamespace,
    I18nTranslateOptions,
    I18nTranslations,
} from "./i18n.types.js";
