/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { IContainerInternal } from "../container.js";
import type { Constructor, LoggerService, ProviderToken } from "../types.js";

/**
 * Eagerly resolves all non-transient providers so async factories and module init hooks
 * run during application bootstrap.
 * @param {IContainerInternal} container Container used to resolve registered providers.
 * @param {Set<ProviderToken>} providerTokens Provider tokens discovered from the module graph.
 * @returns {Promise<void>} Promise that resolves once all non-transient providers are initialized.
 */
export async function initializeProvidersAsync(
    container: IContainerInternal,
    providerTokens: Set<ProviderToken>,
): Promise<void> {
    for (const token of providerTokens) {
        if (container.getProviderScope(token) === "transient") {
            continue;
        }
        await container.resolveAsync(token);
    }
}

/**
 * Resolves module classes themselves so constructor injection and module lifecycle hooks run.
 * @param {IContainerInternal} container Container used to resolve module classes.
 * @param {Constructor[]} modules Ordered module list collected from the application graph.
 * @param {LoggerService | undefined} logger Optional bootstrap logger for debug output.
 * @returns {Promise<void>} Promise that resolves once all modules have been initialized.
 */
export async function initializeModulesAsync(
    container: IContainerInternal,
    modules: Constructor[],
    logger?: LoggerService,
): Promise<void> {
    for (const module of modules) {
        await container.resolveAsync(module);
        logger?.debug?.(`Initialized module: ${module.name}`);
    }
}
