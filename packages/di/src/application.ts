/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
    initializeModulesAsync,
    initializeProvidersAsync,
} from "./application-internals/bootstrap.js";
import {
    registerApplicationLogger,
    withLoggerContext,
} from "./application-internals/logger.js";
import {
    buildModuleContexts,
    collectModules,
    registerModuleGraph,
} from "./application-internals/module-graph.js";
import {
    createInternalContainer,
    type IContainerInternal,
    ModuleRef,
} from "./container.js";
import type {
    Constructor,
    LoggerService as LoggerContract,
    LogLevel,
    ModuleImport,
    ProviderToken,
} from "./types.js";

export interface CreateApplicationOptions {
    logger?:
        | true
        | false
        | LogLevel[]
        | Constructor<LoggerContract>
        | LoggerContract;
}

export interface Application {
    /**
     * Resolves a provider token synchronously from the application container.
     * @param {ProviderToken<T>} token Provider token to resolve.
     * @returns {T} Resolved provider instance.
     */
    get<T>(token: ProviderToken<T>): T;
    /**
     * Resolves a provider token asynchronously from the application container.
     * @param {ProviderToken<T>} token Provider token to resolve.
     * @returns {Promise<T>} Promise of the resolved provider instance.
     */
    resolve<T>(token: ProviderToken<T>): Promise<T>;
    /**
     * Returns all provider tokens registered with the specified discovery tag.
     * @param {string | symbol} tag Discovery tag to search for.
     * @returns {ProviderToken[]} Matching provider tokens.
     */
    findByTag(tag: string | symbol): ProviderToken[];
    /**
     * Returns the underlying internal container instance.
     * @returns {IContainerInternal} Internal container used by the application facade.
     */
    getContainer(): IContainerInternal;
    /**
     * Tears down the application synchronously.
     * @returns {void}
     */
    destroy(): void;
    /**
     * Tears down the application asynchronously.
     * @returns {Promise<void>} Promise that resolves after async teardown completes.
     */
    destroyAsync(): Promise<void>;
}

/**
 * Bootstraps the DI container for the provided module (static or dynamic) and returns an
 * application facade to resolve providers, discover tagged tokens, or destroy the container.
 * @param {ModuleImport} entryModule Root module or dynamic module definition to bootstrap.
 * @param {CreateApplicationOptions | undefined} options Optional application bootstrap settings.
 * @returns {Promise<Application>} Bootstrapped application facade backed by an internal container.
 */
export async function createApplication(
    entryModule: ModuleImport,
    options?: CreateApplicationOptions,
): Promise<Application> {
    const container: IContainerInternal = createInternalContainer();
    const appLogger = registerApplicationLogger(container, options?.logger);
    const logger = withLoggerContext(appLogger, "Bootstrap");
    const entryLabel =
        typeof entryModule === "object" && entryModule !== null
            ? entryModule.module.name
            : entryModule.name;
    logger?.log?.(`Bootstrapping entry module: ${entryLabel}`);

    container.register({
        provide: ModuleRef,
        useValue: new ModuleRef(container),
        scope: "singleton",
    });

    const { modules, dynamicMetadata } = collectModules(entryModule);
    logger?.log?.(
        `Loaded modules (${modules.length}): ${modules.map((module) => module.name).join(", ")}`,
    );

    container.setModuleContexts(buildModuleContexts(modules, dynamicMetadata));
    const providerTokens = registerModuleGraph(
        container,
        modules,
        dynamicMetadata,
    );

    await initializeProvidersAsync(container, providerTokens);
    await initializeModulesAsync(container, modules, logger);

    return {
        get: <T>(token: ProviderToken<T>): T => container.resolve(token),
        resolve: async <T>(token: ProviderToken<T>): Promise<T> =>
            await container.resolveAsync(token),
        findByTag: (tag: string | symbol) => container.findByTag(tag),
        getContainer: () => container,
        destroy: (): void => {
            container.destroy();
        },
        destroyAsync: async (): Promise<void> => {
            await container.destroyAsync();
        },
    };
}
