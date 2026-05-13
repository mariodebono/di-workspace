/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import "reflect-metadata";

import {
    createInternalContainer,
    type IContainerInternal,
    ModuleRef,
} from "./container.js";
import type { Provider, ProviderToken } from "./types.js";

export interface TestingApp {
    /**
     * Resolves a provider token synchronously from the testing container.
     * @param {ProviderToken<T>} token Provider token to resolve.
     * @returns {T} Resolved provider instance.
     */
    get<T>(token: ProviderToken<T>): T;
    /**
     * Resolves a provider token asynchronously from the testing container.
     * @param {ProviderToken<T>} token Provider token to resolve.
     * @returns {Promise<T>} Promise of the resolved provider instance.
     */
    resolve<T>(token: ProviderToken<T>): Promise<T>;
    /**
     * Tears down the testing container synchronously.
     * @returns {void}
     */
    teardown: () => void;
    /**
     * Tears down the testing container asynchronously.
     * @returns {Promise<void>} Promise that resolves after async teardown completes.
     */
    teardownAsync: () => Promise<void>;
}

/**
 * Lightweight testing harness that registers the provided providers into an isolated container
 * and returns accessors to resolve tokens and tear down the container.
 * @param {Provider[]} providers Provider definitions to register in the isolated container.
 * @returns {TestingApp} Testing facade with sync and async resolution helpers.
 */
export function createTestingApp(providers: Provider[]): TestingApp {
    const container: IContainerInternal = createInternalContainer();
    container.register({
        provide: ModuleRef,
        useValue: new ModuleRef(container),
        scope: "singleton",
    });

    for (const provider of providers) {
        container.register(provider);
    }

    /**
     * Resolves a provider token synchronously from the isolated testing container.
     * @param {ProviderToken<T>} token Provider token to resolve.
     * @returns {T} Resolved provider instance.
     */
    function get<T>(token: ProviderToken<T>): T {
        return container.resolve(token);
    }

    /**
     * Resolves a provider token asynchronously from the isolated testing container.
     * @param {ProviderToken<T>} token Provider token to resolve.
     * @returns {Promise<T>} Promise of the resolved provider instance.
     */
    async function resolve<T>(token: ProviderToken<T>): Promise<T> {
        return await container.resolveAsync(token);
    }

    return {
        get,
        resolve,
        teardown: () => container.destroy(),
        teardownAsync: async () => {
            await container.destroyAsync();
        },
    };
}
