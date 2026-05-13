/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { IContainerInternal } from "../container.js";
import { type ModuleMetadata, metadataKeys } from "../decorators.js";
import type {
    Constructor,
    DynamicModule,
    ModuleImport,
    Provider,
    ProviderToken,
} from "../types.js";

type DynamicModuleExtras = {
    imports?: ModuleImport[];
    providers?: Provider[];
    exports?: (Constructor | string | symbol)[];
    global?: boolean;
};

type ModuleContext = {
    imports: Set<Constructor>;
    exports: Set<ProviderToken>;
    global: boolean;
};

/**
 * Registers all providers and module classes discovered in the application graph.
 * @param {IContainerInternal} container Container receiving provider registrations.
 * @param {Constructor[]} modules Ordered list of discovered module classes.
 * @param {Map<Constructor, DynamicModuleExtras>} dynamicMetadata Extra metadata collected from dynamic modules.
 * @returns {Set<ProviderToken>} Set of provider tokens registered from module metadata.
 */
export function registerModuleGraph(
    container: IContainerInternal,
    modules: Constructor[],
    dynamicMetadata: Map<Constructor, DynamicModuleExtras>,
): Set<ProviderToken> {
    const providerTokens = new Set<ProviderToken>();

    for (const module of modules) {
        const moduleProviderTokens = registerModuleProviders(
            container,
            module,
            dynamicMetadata,
        );
        for (const token of moduleProviderTokens) {
            providerTokens.add(token);
        }
        container.register(module);
        container.setProviderOwner(module, module);
    }

    return providerTokens;
}

/**
 * Walks a static or dynamic module graph and returns modules in dependency order.
 * @param {ModuleImport} entryModule Root module or dynamic module definition to visit.
 * @param {Set<Constructor>} visited Internal set used to avoid revisiting modules.
 * @param {Constructor[]} ordered Internal ordered module accumulator.
 * @param {Map<Constructor, DynamicModuleExtras>} dynamicMetadata Accumulator for merged dynamic module metadata.
 * @returns {{ modules: Constructor[]; dynamicMetadata: Map<Constructor, DynamicModuleExtras> }} Ordered modules and merged dynamic metadata.
 */
export function collectModules(
    entryModule: ModuleImport,
    visited = new Set<Constructor>(),
    ordered: Constructor[] = [],
    dynamicMetadata = new Map<Constructor, DynamicModuleExtras>(),
): {
    modules: Constructor[];
    dynamicMetadata: Map<Constructor, DynamicModuleExtras>;
} {
    if (isDynamicModule(entryModule)) {
        if (entryModule.imports?.length) {
            for (const imported of entryModule.imports) {
                collectModules(imported, visited, ordered, dynamicMetadata);
            }
        }

        const existing = dynamicMetadata.get(entryModule.module) ?? {};
        dynamicMetadata.set(entryModule.module, {
            imports: [
                ...(existing.imports ?? []),
                ...(entryModule.imports ?? []),
            ],
            providers: [
                ...(existing.providers ?? []),
                ...(entryModule.providers ?? []),
            ],
            exports: [
                ...(existing.exports ?? []),
                ...(entryModule.exports ?? []),
            ],
            global: entryModule.global ?? existing.global ?? false,
        });

        return collectModules(
            entryModule.module,
            visited,
            ordered,
            dynamicMetadata,
        );
    }

    if (visited.has(entryModule)) {
        return { modules: ordered, dynamicMetadata };
    }

    visited.add(entryModule);
    const metadata = getModuleMetadata(entryModule);

    for (const importedModule of metadata?.imports ?? []) {
        collectModules(importedModule, visited, ordered, dynamicMetadata);
    }

    ordered.push(entryModule);
    return { modules: ordered, dynamicMetadata };
}

/**
 * Builds visibility/export metadata for every discovered module.
 * @param {Constructor[]} modules Ordered list of discovered modules.
 * @param {Map<Constructor, DynamicModuleExtras>} dynamicMetadata Extra metadata collected from dynamic modules.
 * @returns {Map<Constructor, ModuleContext>} Module context map used for visibility checks.
 */
export function buildModuleContexts(
    modules: Constructor[],
    dynamicMetadata: Map<Constructor, DynamicModuleExtras>,
): Map<Constructor, ModuleContext> {
    const contexts = new Map<Constructor, ModuleContext>();

    for (const module of modules) {
        const metadata = getModuleMetadata(module);
        const dynamicExtras = dynamicMetadata.get(module);
        const imports = new Set<Constructor>();

        for (const imported of metadata?.imports ?? []) {
            imports.add(resolveModuleImport(imported));
        }
        for (const imported of dynamicExtras?.imports ?? []) {
            imports.add(resolveModuleImport(imported));
        }

        contexts.set(module, {
            imports,
            exports: new Set<ProviderToken>([
                ...(metadata?.exports ?? []),
                ...(dynamicExtras?.exports ?? []),
            ]),
            global: metadata?.global ?? dynamicExtras?.global ?? false,
        });
    }

    return contexts;
}

/**
 * Registers providers declared by a specific module and tracks their owning module.
 * @param {IContainerInternal} container Container receiving provider registrations.
 * @param {Constructor} module Module class whose providers should be registered.
 * @param {Map<Constructor, DynamicModuleExtras>} dynamicMetadata Extra metadata collected from dynamic modules.
 * @returns {ProviderToken[]} Registered provider tokens for the module.
 */
function registerModuleProviders(
    container: IContainerInternal,
    module: Constructor,
    dynamicMetadata: Map<Constructor, DynamicModuleExtras>,
): ProviderToken[] {
    const metadata = getModuleMetadata(module);
    const dynamicExtras = dynamicMetadata.get(module);
    const providers = [
        ...(metadata?.providers ?? []),
        ...(dynamicExtras?.providers ?? []),
    ];

    if (!providers.length) {
        return [];
    }

    const providerTokens: ProviderToken[] = [];
    for (const provider of providers) {
        container.register(provider);
        const token =
            typeof provider === "function" ? provider : provider.provide;
        providerTokens.push(token);
        container.setProviderOwner(token, module);
    }

    return providerTokens;
}

/**
 * Reads module metadata attached by the `@Module()` decorator.
 * @param {Constructor} entryModule Module class to inspect.
 * @returns {ModuleMetadata | undefined} Decorator metadata when present.
 */
function getModuleMetadata(
    entryModule: Constructor,
): ModuleMetadata | undefined {
    return Reflect.getMetadata(metadataKeys.module, entryModule) as
        | ModuleMetadata
        | undefined;
}

/**
 * Determines whether an import value is a dynamic module descriptor.
 * @param {ModuleImport} value Value to test.
 * @returns {value is DynamicModule} True when the value is a dynamic module descriptor.
 */
function isDynamicModule(value: ModuleImport): value is DynamicModule {
    return (
        typeof value === "object" &&
        value !== null &&
        "module" in value &&
        typeof value.module === "function"
    );
}

/**
 * Resolves a module import to its backing module class.
 * @param {ModuleImport} imported Imported module entry from metadata.
 * @returns {Constructor} Module class represented by the import.
 */
function resolveModuleImport(imported: ModuleImport): Constructor {
    return isDynamicModule(imported) ? imported.module : imported;
}
