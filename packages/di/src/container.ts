/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import "reflect-metadata";

import type { InjectToken } from "./decorators.js";
import { isForwardReference, metadataKeys } from "./decorators.js";
import type {
    ClassProvider,
    Constructor,
    FactoryProvider,
    OnModuleDestroy,
    OnModuleInit,
    Provider,
    ProviderScope,
    ProviderToken,
    ValueProvider,
} from "./types.js";
import { REQUEST_CONTEXT } from "./types.js";

export interface IContainer {
    /**
     * Resolve a provider token to an instance, honoring scope and visibility.
     * @param {ProviderToken<T>} target - Token to resolve.
     * @returns Resolved instance.
     */
    resolve<T>(target: ProviderToken<T>): T;
    /**
     * Resolve a provider token asynchronously.
     * @param {ProviderToken<T>} target - Token to resolve.
     * @returns Promise of resolved instance.
     */
    resolveAsync<T>(target: ProviderToken<T>): Promise<T>;
    /**
     * Return all provider tokens tagged with the given label.
     * @param {string | symbol} tag - Tag to search for.
     * @returns Matching provider tokens.
     */
    findByTag(tag: string | symbol): ProviderToken[];
    /**
     * Invoke lifecycle teardown hooks and clear all cached instances.
     */
    destroy(): void;
    /**
     * Invoke lifecycle teardown hooks asynchronously and clear all cached instances.
     */
    destroyAsync(): Promise<void>;
}

export interface IContainerInternal extends IContainer {
    /**
     * Register a provider definition with the container.
     * @param {Provider<T>} provider - Provider to register.
     */
    register<T>(provider: Provider<T>): void;
    /**
     * Set module contexts for export/visibility enforcement.
     * @param {Map<Constructor, ModuleContext>} contexts - Map of module metadata.
     */
    setModuleContexts(contexts: Map<Constructor, ModuleContext>): void;
    /**
     * Associate a provider token with its owning module for visibility checks.
     * @param {ProviderToken} token - Provider token.
     * @param {Constructor} owner - Owning module constructor.
     */
    setProviderOwner(token: ProviderToken, owner: Constructor): void;
    /**
     * Read the registered provider scope for a token.
     * @param {ProviderToken} token - Provider token.
     * @returns Scope if token is registered.
     */
    getProviderScope(token: ProviderToken): ProviderScope | undefined;
}

class MissingProviderError extends Error {}
class CircularDependencyError extends Error {}
class DuplicateProviderError extends Error {}
class AsyncResolutionError extends Error {}
class AsyncLifecycleError extends Error {}

/**
 * Internal DI container implementation with scope handling, visibility checks, and lifecycle hooks.
 */
class Container implements IContainer, IContainerInternal {
    private readonly instances = new Map<ProviderToken, unknown>();
    private readonly pendingInstances = new Map<
        ProviderToken,
        Promise<unknown>
    >();
    private readonly providers = new Map<ProviderToken, NormalizedProvider>();
    private readonly lifecycleOrder: ProviderToken[] = [];
    private moduleContexts = new Map<Constructor, ModuleContext>();
    private providerOwners = new Map<ProviderToken, Constructor>();
    private globalExports = new Set<ProviderToken>();
    private providerTagIndex = new Map<string | symbol, Set<ProviderToken>>();

    /**
     * Resolve a token, instantiating if needed, and enforce visibility/scope.
     * @param {ProviderToken<T>} target - Provider token to resolve.
     * @returns Resolved instance.
     */
    resolve<T>(target: ProviderToken<T>): T {
        return this.resolveSync(target, []);
    }

    /**
     * Resolve a token asynchronously.
     * @param {ProviderToken<T>} target - Provider token to resolve.
     * @returns Resolved instance.
     */
    async resolveAsync<T>(target: ProviderToken<T>): Promise<T> {
        return this.resolveAsyncInternal(target, []);
    }

    /**
     * Return all provider tokens tagged with the given label.
     * @param {string | symbol} tag - Tag to search for.
     * @returns Matching provider tokens.
     */
    findByTag(tag: string | symbol): ProviderToken[] {
        const result: ProviderToken[] = [];
        const tokens = this.providerTagIndex.get(tag);
        if (tokens) {
            result.push(...tokens);
        }
        return result;
    }

    /**
     * Normalize and store a provider definition.
     * @param {Provider<T>} provider - Provider to register.
     */
    register<T>(provider: Provider<T>): void {
        const normalized = this.normalizeProvider(provider);
        const existing = this.providers.get(normalized.provide);
        if (existing) {
            this.throwDuplicateProvider(
                normalized.provide,
                existing,
                normalized,
            );
        }

        this.providers.set(normalized.provide, normalized);
        for (const tag of normalized.tags ?? []) {
            if (!this.providerTagIndex.has(tag)) {
                this.providerTagIndex.set(tag, new Set());
            }
            this.providerTagIndex.get(tag)?.add(normalized.provide);
        }
    }

    /**
     * Record module contexts and compute global exports for visibility checks.
     * @param {Map<Constructor, ModuleContext>} contexts - Module context map.
     */
    setModuleContexts(contexts: Map<Constructor, ModuleContext>): void {
        this.moduleContexts = contexts;
        this.globalExports.clear();
        for (const [module, ctx] of contexts) {
            if (ctx.global) {
                for (const token of ctx.exports) {
                    this.globalExports.add(token);
                    this.providerOwners.set(token, module);
                }
            }
        }
    }

    /**
     * Track which module owns a provider token (for visibility checks).
     * @param {ProviderToken} token - Provider token.
     * @param {Constructor} owner - Owning module.
     */
    setProviderOwner(token: ProviderToken, owner: Constructor): void {
        this.providerOwners.set(token, owner);
    }

    /**
     * Returns the registered provider scope for a token when present.
     * @param {ProviderToken} token Provider token to inspect.
     * @returns {ProviderScope | undefined} Registered scope for the token, if any.
     */
    getProviderScope(token: ProviderToken): ProviderScope | undefined {
        return this.providers.get(token)?.scope;
    }

    /**
     * Converts provider shorthand into a normalized internal representation.
     * @param {Provider<T>} provider Provider definition to normalize.
     * @returns {NormalizedProvider<T>} Normalized provider representation.
     */
    private normalizeProvider<T>(provider: Provider<T>): NormalizedProvider<T> {
        if (typeof provider === "function") {
            return {
                provide: provider,
                useClass: provider,
                scope: this.getScope(provider),
                tags: this.getTags(provider),
                kind: "class",
            };
        }

        if (this.isClassProvider(provider)) {
            return {
                provide: provider.provide,
                useClass: provider.useClass,
                scope: provider.scope ?? this.getScope(provider.useClass),
                tags: provider.tags ?? this.getTags(provider.useClass),
                kind: "class",
            };
        }

        if (this.isValueProvider(provider)) {
            return {
                provide: provider.provide,
                useValue: provider.useValue,
                scope: provider.scope ?? "singleton",
                tags: provider.tags ?? [],
                kind: "value",
            };
        }

        return {
            provide: provider.provide,
            useFactory: provider.useFactory,
            inject: provider.inject ?? [],
            scope: provider.scope ?? "singleton",
            tags: provider.tags ?? [],
            kind: "factory",
        };
    }

    /**
     * Reads the default scope for an injectable class from decorator metadata.
     * @param {Constructor} target Injectable class to inspect.
     * @returns {ProviderScope} Decorated provider scope or the singleton default.
     */
    private getScope(target: Constructor): ProviderScope {
        const options = Reflect.getMetadata?.(
            metadataKeys.injectableOptions,
            target,
        ) as { scope?: ProviderScope } | undefined;
        return options?.scope ?? "singleton";
    }

    /**
     * Reads discovery tags for an injectable class from decorator metadata.
     * @param {Constructor} target Injectable class to inspect.
     * @returns {(string | symbol)[]} Discovery tags defined on the class.
     */
    private getTags(target: Constructor): (string | symbol)[] {
        const options = Reflect.getMetadata?.(
            metadataKeys.injectableOptions,
            target,
        ) as { tags?: (string | symbol)[] } | undefined;
        return options?.tags ?? [];
    }

    /**
     * Resolves a provider token synchronously, caching singleton instances when needed.
     * @param {ProviderToken<T>} target Provider token to resolve.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {T} Resolved provider instance.
     */
    private resolveSync<T>(
        target: ProviderToken<T>,
        resolvingStack: ProviderToken[],
    ): T {
        if (resolvingStack.includes(target)) {
            this.throwCircularDependency(target, resolvingStack);
        }

        const provider = this.providers.get(target);
        if (!provider) {
            this.throwMissingProvider(
                target,
                undefined,
                undefined,
                undefined,
                resolvingStack,
            );
        }

        if (provider.scope !== "transient") {
            if (this.instances.has(target)) {
                return this.instances.get(target) as T;
            }
            if (this.pendingInstances.has(target)) {
                this.throwAsyncResolution(target);
            }
        }

        resolvingStack.push(target);
        try {
            const instance = this.resolveProviderSync(provider, resolvingStack);
            if (provider.scope !== "transient") {
                this.instances.set(target, instance);
                this.lifecycleOrder.push(target);
            }
            return instance as T;
        } finally {
            resolvingStack.pop();
        }
    }

    /**
     * Resolves a provider token asynchronously, reusing any pending singleton resolution.
     * @param {ProviderToken<T>} target Provider token to resolve.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {Promise<T>} Promise of the resolved provider instance.
     */
    private async resolveAsyncInternal<T>(
        target: ProviderToken<T>,
        resolvingStack: ProviderToken[],
    ): Promise<T> {
        if (resolvingStack.includes(target)) {
            this.throwCircularDependency(target, resolvingStack);
        }

        const provider = this.providers.get(target);
        if (!provider) {
            this.throwMissingProvider(
                target,
                undefined,
                undefined,
                undefined,
                resolvingStack,
            );
        }

        if (provider.scope !== "transient") {
            if (this.instances.has(target)) {
                return this.instances.get(target) as T;
            }

            const pendingInstance = this.pendingInstances.get(target);
            if (pendingInstance) {
                return (await pendingInstance) as T;
            }
        }

        resolvingStack.push(target);
        let createdPending = false;
        try {
            if (provider.scope !== "transient") {
                const pending = this.resolveProviderAsync(
                    provider,
                    resolvingStack,
                ).then((instance) => {
                    this.instances.set(target, instance);
                    this.lifecycleOrder.push(target);
                    return instance;
                });
                this.pendingInstances.set(target, pending);
                createdPending = true;
                return (await pending) as T;
            }

            return (await this.resolveProviderAsync(
                provider,
                resolvingStack,
            )) as T;
        } finally {
            resolvingStack.pop();
            if (createdPending) {
                this.pendingInstances.delete(target);
            }
        }
    }

    /**
     * Resolves a normalized provider synchronously based on its provider kind.
     * @param {NormalizedProvider} provider Normalized provider definition.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {unknown} Resolved provider value.
     */
    private resolveProviderSync(
        provider: NormalizedProvider,
        resolvingStack: ProviderToken[],
    ): unknown {
        switch (provider.kind) {
            case "class":
                return this.instantiateSync(
                    provider.useClass,
                    provider.provide,
                    resolvingStack,
                );
            case "value":
                return provider.useValue;
            case "factory": {
                const deps = provider.inject.map((token, index) =>
                    this.resolveDependencySync(
                        token,
                        provider.provide,
                        index,
                        false,
                        resolvingStack,
                    ),
                );
                const output = provider.useFactory(...deps);
                if (this.isPromiseLike(output)) {
                    this.throwAsyncResolution(provider.provide);
                }
                return output;
            }
        }
    }

    /**
     * Resolves a normalized provider asynchronously based on its provider kind.
     * @param {NormalizedProvider} provider Normalized provider definition.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {Promise<unknown>} Promise of the resolved provider value.
     */
    private async resolveProviderAsync(
        provider: NormalizedProvider,
        resolvingStack: ProviderToken[],
    ): Promise<unknown> {
        switch (provider.kind) {
            case "class":
                return this.instantiateAsync(
                    provider.useClass,
                    provider.provide,
                    resolvingStack,
                );
            case "value":
                return provider.useValue;
            case "factory": {
                const deps: unknown[] = [];
                for (const [index, token] of provider.inject.entries()) {
                    deps.push(
                        await this.resolveDependencyAsync(
                            token,
                            provider.provide,
                            index,
                            false,
                            resolvingStack,
                        ),
                    );
                }
                return provider.useFactory(...deps);
            }
        }
    }

    /**
     * Resolves a constructor or factory dependency synchronously.
     * @param {ProviderToken | InjectToken} token Dependency token or forward reference.
     * @param {ProviderToken} requesting Provider currently being instantiated.
     * @param {number} paramIndex Constructor or factory argument index.
     * @param {boolean} optional Whether the dependency is optional.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {unknown} Resolved dependency value or `undefined` for missing optional dependencies.
     */
    private resolveDependencySync(
        token: ProviderToken | InjectToken,
        requesting: ProviderToken,
        paramIndex: number,
        optional: boolean,
        resolvingStack: ProviderToken[],
    ): unknown {
        const resolvedToken = this.resolveInjectionToken(token);
        this.ensureVisibility(resolvedToken, requesting);

        if (resolvedToken === REQUEST_CONTEXT) {
            return this.resolveRequestContext(requesting, resolvingStack);
        }

        if (this.isBuiltinToken(resolvedToken)) {
            if (optional) {
                return undefined;
            }
            this.throwMissingProvider(
                requesting,
                resolvedToken,
                paramIndex,
                undefined,
                resolvingStack,
            );
        }

        if (optional && !this.providers.has(resolvedToken)) {
            return undefined;
        }

        try {
            return this.resolveSync(resolvedToken, resolvingStack);
        } catch (error) {
            if (optional && error instanceof MissingProviderError) {
                return undefined;
            }
            throw error;
        }
    }

    /**
     * Resolves a constructor or factory dependency asynchronously.
     * @param {ProviderToken | InjectToken} token Dependency token or forward reference.
     * @param {ProviderToken} requesting Provider currently being instantiated.
     * @param {number} paramIndex Constructor or factory argument index.
     * @param {boolean} optional Whether the dependency is optional.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {Promise<unknown>} Promise of the resolved dependency value.
     */
    private async resolveDependencyAsync(
        token: ProviderToken | InjectToken,
        requesting: ProviderToken,
        paramIndex: number,
        optional: boolean,
        resolvingStack: ProviderToken[],
    ): Promise<unknown> {
        const resolvedToken = this.resolveInjectionToken(token);
        this.ensureVisibility(resolvedToken, requesting);

        if (resolvedToken === REQUEST_CONTEXT) {
            return this.resolveRequestContext(requesting, resolvingStack);
        }

        if (this.isBuiltinToken(resolvedToken)) {
            if (optional) {
                return undefined;
            }
            this.throwMissingProvider(
                requesting,
                resolvedToken,
                paramIndex,
                undefined,
                resolvingStack,
            );
        }

        if (optional && !this.providers.has(resolvedToken)) {
            return undefined;
        }

        try {
            return await this.resolveAsyncInternal(
                resolvedToken,
                resolvingStack,
            );
        } catch (error) {
            if (optional && error instanceof MissingProviderError) {
                return undefined;
            }
            throw error;
        }
    }

    /**
     * Instantiates a class provider synchronously and runs any sync init hook.
     * @param {Constructor<T>} target Class provider to instantiate.
     * @param {ProviderToken} requesting Provider token being resolved.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {T} Instantiated provider instance.
     */
    private instantiateSync<T>(
        target: Constructor<T>,
        requesting: ProviderToken,
        resolvingStack: ProviderToken[],
    ): T {
        const { dependencies, paramTypes } =
            this.resolveConstructorDependenciesSync(
                target,
                requesting,
                resolvingStack,
            );

        const instance = new target(...dependencies);
        this.invokeModuleInitSync(instance, requesting);

        if (this.isPromiseLike(instance)) {
            this.throwAsyncResolution(requesting);
        }

        // paramTypes is consumed for error path consistency in resolver helper
        void paramTypes;

        return instance;
    }

    /**
     * Instantiates a class provider asynchronously and runs any async init hook.
     * @param {Constructor<T>} target Class provider to instantiate.
     * @param {ProviderToken} requesting Provider token being resolved.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {Promise<T>} Promise of the instantiated provider instance.
     */
    private async instantiateAsync<T>(
        target: Constructor<T>,
        requesting: ProviderToken,
        resolvingStack: ProviderToken[],
    ): Promise<T> {
        const dependencies = await this.resolveConstructorDependenciesAsync(
            target,
            requesting,
            resolvingStack,
        );

        const instance = new target(...dependencies);
        await this.invokeModuleInitAsync(instance);

        return instance;
    }

    /**
     * Resolves constructor dependencies synchronously from reflected metadata.
     * @param {Constructor<T>} target Class whose constructor dependencies should be resolved.
     * @param {ProviderToken} requesting Provider token being resolved.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {{ dependencies: unknown[]; paramTypes: Constructor[] }} Resolved constructor args and reflected param types.
     */
    private resolveConstructorDependenciesSync<T>(
        target: Constructor<T>,
        requesting: ProviderToken,
        resolvingStack: ProviderToken[],
    ): { dependencies: unknown[]; paramTypes: Constructor[] } {
        const paramTypes =
            (Reflect.getMetadata?.(
                "design:paramtypes",
                target,
            ) as Constructor[]) ?? [];

        const injectTokens =
            (Reflect.getMetadata(metadataKeys.injectTokens, target) as
                | Record<number, InjectToken>
                | undefined) ?? {};

        const optionalParams = new Set<number>(
            ((Reflect.getMetadata(metadataKeys.optionalParams, target) as
                | number[]
                | undefined) ?? []) as number[],
        );

        const dependencies = paramTypes.map((dependency, index) => {
            const injectedToken = injectTokens[index];
            const token = injectedToken ?? dependency;
            const isOptional = optionalParams.has(index);

            if (token === undefined) {
                if (isOptional) {
                    return undefined;
                }
                this.throwMissingProvider(
                    requesting,
                    undefined,
                    index,
                    paramTypes,
                    resolvingStack,
                );
            }

            if (
                injectedToken === undefined &&
                typeof token === "function" &&
                this.isBuiltin(token as Constructor)
            ) {
                if (isOptional) {
                    return undefined;
                }
                this.throwMissingProvider(
                    requesting,
                    token as ProviderToken,
                    index,
                    paramTypes,
                    resolvingStack,
                );
            }

            return this.resolveDependencySync(
                token,
                requesting,
                index,
                isOptional,
                resolvingStack,
            );
        });

        return { dependencies, paramTypes };
    }

    /**
     * Resolves constructor dependencies asynchronously from reflected metadata.
     * @param {Constructor<T>} target Class whose constructor dependencies should be resolved.
     * @param {ProviderToken} requesting Provider token being resolved.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {Promise<unknown[]>} Promise of resolved constructor arguments.
     */
    private async resolveConstructorDependenciesAsync<T>(
        target: Constructor<T>,
        requesting: ProviderToken,
        resolvingStack: ProviderToken[],
    ): Promise<unknown[]> {
        const paramTypes =
            (Reflect.getMetadata?.(
                "design:paramtypes",
                target,
            ) as Constructor[]) ?? [];

        const injectTokens =
            (Reflect.getMetadata(metadataKeys.injectTokens, target) as
                | Record<number, InjectToken>
                | undefined) ?? {};

        const optionalParams = new Set<number>(
            ((Reflect.getMetadata(metadataKeys.optionalParams, target) as
                | number[]
                | undefined) ?? []) as number[],
        );

        const dependencies: unknown[] = [];
        for (const [index, dependency] of paramTypes.entries()) {
            const injectedToken = injectTokens[index];
            const token = injectedToken ?? dependency;
            const isOptional = optionalParams.has(index);

            if (token === undefined) {
                if (isOptional) {
                    dependencies.push(undefined);
                    continue;
                }
                this.throwMissingProvider(
                    requesting,
                    undefined,
                    index,
                    paramTypes,
                    resolvingStack,
                );
            }

            if (
                injectedToken === undefined &&
                typeof token === "function" &&
                this.isBuiltin(token as Constructor)
            ) {
                if (isOptional) {
                    dependencies.push(undefined);
                    continue;
                }
                this.throwMissingProvider(
                    requesting,
                    token as ProviderToken,
                    index,
                    paramTypes,
                    resolvingStack,
                );
            }

            dependencies.push(
                await this.resolveDependencyAsync(
                    token,
                    requesting,
                    index,
                    isOptional,
                    resolvingStack,
                ),
            );
        }

        return dependencies;
    }

    /**
     * Resolves the implicit request context token for the current resolution chain.
     * @param {ProviderToken} requesting Provider currently being resolved.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {ProviderToken} Parent provider token when available, otherwise the requesting token.
     */
    private resolveRequestContext(
        requesting: ProviderToken,
        resolvingStack: ProviderToken[],
    ): ProviderToken {
        const parent =
            resolvingStack.length >= 2
                ? resolvingStack[resolvingStack.length - 2]
                : undefined;
        return parent ?? requesting;
    }

    /**
     * Resolves a raw injection token or forward reference to a concrete provider token.
     * @param {ProviderToken | InjectToken} token Raw injection token value.
     * @returns {ProviderToken} Concrete provider token.
     */
    private resolveInjectionToken(
        token: ProviderToken | InjectToken,
    ): ProviderToken {
        if (!isForwardReference(token)) {
            return token as ProviderToken;
        }

        const resolved = token.forwardRef();
        if (!resolved) {
            throw new Error("forwardRef returned an empty token");
        }

        return resolved as ProviderToken;
    }

    /**
     * Checks whether a constructor token is one of the built-in JavaScript types.
     * @param {Constructor} target Constructor token to test.
     * @returns {boolean} True when the constructor is a built-in primitive wrapper or array.
     */
    private isBuiltin(target: Constructor): boolean {
        return (
            target === Object ||
            target === String ||
            target === Number ||
            target === Boolean ||
            target === Array
        );
    }

    /**
     * Checks whether a provider definition is a class provider object.
     * @param {Provider} provider Provider definition to test.
     * @returns {provider is ClassProvider} True when the provider contains `useClass`.
     */
    private isClassProvider(provider: Provider): provider is ClassProvider {
        return typeof (provider as ClassProvider).useClass === "function";
    }

    /**
     * Checks whether a provider definition is a value provider object.
     * @param {Provider} provider Provider definition to test.
     * @returns {provider is ValueProvider} True when the provider contains `useValue`.
     */
    private isValueProvider(provider: Provider): provider is ValueProvider {
        return "useValue" in provider;
    }

    /**
     * Checks whether a provider token is one of the built-in JavaScript tokens.
     * @param {ProviderToken} token Provider token to test.
     * @returns {boolean} True when the token is a built-in primitive wrapper or array.
     */
    private isBuiltinToken(token: ProviderToken): boolean {
        return (
            token === Object ||
            token === String ||
            token === Number ||
            token === Boolean ||
            token === Array
        );
    }

    /**
     * Checks whether a value behaves like a promise.
     * @param {unknown} value Value to test.
     * @returns {value is PromiseLike<unknown>} True when the value exposes a callable `then`.
     */
    private isPromiseLike(value: unknown): value is PromiseLike<unknown> {
        return (
            value !== null &&
            typeof value === "object" &&
            "then" in value &&
            typeof (value as { then?: unknown }).then === "function"
        );
    }

    /**
     * Ensures a requested token is visible from the requesting provider's module.
     * @param {ProviderToken} token Dependency token being requested.
     * @param {ProviderToken} requesting Provider requesting the dependency.
     * @returns {void}
     */
    private ensureVisibility(
        token: ProviderToken,
        requesting: ProviderToken,
    ): void {
        const requesterModule = this.providerOwners.get(requesting);
        if (!requesterModule) return;
        const requesterCtx = this.moduleContexts.get(requesterModule);
        if (!requesterCtx) return;

        const ownerModule = this.providerOwners.get(token);
        if (!ownerModule) return;
        if (ownerModule === requesterModule) return;

        if (this.globalExports.has(token)) return;

        const ownerCtx = this.moduleContexts.get(ownerModule);
        const isExported = ownerCtx?.exports.has(token) ?? false;

        if (
            isExported &&
            (ownerCtx?.global || requesterCtx.imports.has(ownerModule))
        ) {
            return;
        }

        throw new Error(
            `Provider ${this.formatToken(token)} is not exported by ${this.formatToken(ownerModule)} for consumer ${this.formatToken(requesting)}`,
        );
    }

    /**
     * Invokes `onModuleInit()` on an instance and rejects async hooks in sync paths.
     * @param {unknown} instance Provider instance to inspect.
     * @param {ProviderToken} requesting Provider token being resolved.
     * @returns {void}
     */
    private invokeModuleInitSync(
        instance: unknown,
        requesting: ProviderToken,
    ): void {
        if (typeof (instance as OnModuleInit).onModuleInit === "function") {
            const result = (instance as OnModuleInit).onModuleInit();
            if (this.isPromiseLike(result)) {
                this.throwAsyncLifecycle(
                    `Provider ${this.formatToken(requesting)} has async onModuleInit; resolve it with resolveAsync/resolve.`,
                );
            }
        }
    }

    /**
     * Invokes `onModuleInit()` asynchronously when the instance implements it.
     * @param {unknown} instance Provider instance to inspect.
     * @returns {Promise<void>} Promise that resolves when initialization is complete.
     */
    private async invokeModuleInitAsync(instance: unknown): Promise<void> {
        if (typeof (instance as OnModuleInit).onModuleInit === "function") {
            await (instance as OnModuleInit).onModuleInit();
        }
    }

    /**
     * Invokes `onModuleDestroy()` on an instance and rejects async hooks in sync teardown.
     * @param {unknown} instance Provider instance to inspect.
     * @param {ProviderToken} token Provider token being destroyed.
     * @returns {void}
     */
    private invokeModuleDestroySync(
        instance: unknown,
        token: ProviderToken,
    ): void {
        if (
            typeof (instance as OnModuleDestroy).onModuleDestroy === "function"
        ) {
            const result = (instance as OnModuleDestroy).onModuleDestroy();
            if (this.isPromiseLike(result)) {
                this.throwAsyncLifecycle(
                    `Provider ${this.formatToken(token)} has async onModuleDestroy; call destroyAsync() instead of destroy().`,
                );
            }
        }
    }

    /**
     * Invokes `onModuleDestroy()` asynchronously when the instance implements it.
     * @param {unknown} instance Provider instance to inspect.
     * @returns {Promise<void>} Promise that resolves when teardown is complete.
     */
    private async invokeModuleDestroyAsync(instance: unknown): Promise<void> {
        if (
            typeof (instance as OnModuleDestroy).onModuleDestroy === "function"
        ) {
            await (instance as OnModuleDestroy).onModuleDestroy();
        }
    }

    /**
     * Tear down instances in reverse creation order, invoking destroy hooks.
     * @returns {void}
     */
    destroy(): void {
        for (let i = this.lifecycleOrder.length - 1; i >= 0; i -= 1) {
            const token = this.lifecycleOrder[i];
            if (!this.instances.has(token)) {
                continue;
            }
            const instance = this.instances.get(token);
            this.invokeModuleDestroySync(instance, token);
        }
        this.instances.clear();
        this.pendingInstances.clear();
        this.lifecycleOrder.length = 0;
    }

    /**
     * Tear down instances in reverse creation order, invoking async destroy hooks.
     * @returns {Promise<void>} Promise that resolves after all async destroy hooks complete.
     */
    async destroyAsync(): Promise<void> {
        for (let i = this.lifecycleOrder.length - 1; i >= 0; i -= 1) {
            const token = this.lifecycleOrder[i];
            if (!this.instances.has(token)) {
                continue;
            }
            const instance = this.instances.get(token);
            await this.invokeModuleDestroyAsync(instance);
        }
        this.instances.clear();
        this.pendingInstances.clear();
        this.lifecycleOrder.length = 0;
    }

    /**
     * Throws a detailed error for missing providers with the current resolution path.
     * @param {ProviderToken} requesting Provider token being resolved.
     * @param {ProviderToken | undefined} missing Missing dependency token when known.
     * @param {number | undefined} paramIndex Constructor or factory parameter index when known.
     * @param {Constructor[] | undefined} paramTypes Reflected constructor parameter types when available.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {never}
     */
    private throwMissingProvider(
        requesting: ProviderToken,
        missing?: ProviderToken,
        paramIndex?: number,
        paramTypes?: Constructor[],
        resolvingStack: ProviderToken[] = [],
    ): never {
        const dependencyLabel =
            missing !== undefined ? this.formatToken(missing) : "Unknown";
        const location =
            paramIndex !== undefined
                ? `dependency #${paramIndex + 1} (${dependencyLabel}) of ${this.formatToken(requesting)}`
                : this.formatToken(requesting);
        const path = this.formatResolutionPath(resolvingStack, requesting);
        const formattedParamTypes = paramTypes?.length
            ? paramTypes.map((type) => this.formatToken(type)).join(", ")
            : undefined;
        const paramTypesInfo = formattedParamTypes
            ? ` Constructor parameter types: [${formattedParamTypes}]`
            : "";
        const hint =
            paramIndex !== undefined
                ? " Ensure the dependency is decorated with @Injectable and provided in a module."
                : " Ensure the provider is registered.";
        throw new MissingProviderError(
            `No provider for ${location}. Resolution path: ${path}.${paramTypesInfo}${hint}`,
        );
    }

    /**
     * Throws an error for duplicate provider registrations.
     * @param {ProviderToken} token Provider token that was registered twice.
     * @param {NormalizedProvider} existing Existing provider definition.
     * @param {NormalizedProvider} next Incoming provider definition.
     * @returns {never}
     */
    private throwDuplicateProvider(
        token: ProviderToken,
        existing: NormalizedProvider,
        next: NormalizedProvider,
    ): never {
        throw new DuplicateProviderError(
            `Duplicate provider registration for token ${this.formatToken(token)}. Existing: ${this.describeProvider(existing)}. Next: ${this.describeProvider(next)}.`,
        );
    }

    /**
     * Throws an error describing a circular dependency path.
     * @param {ProviderToken} token Provider token that closed the dependency cycle.
     * @param {ProviderToken[]} resolvingStack Current resolution stack for circular detection.
     * @returns {never}
     */
    private throwCircularDependency(
        token: ProviderToken,
        resolvingStack: ProviderToken[],
    ): never {
        const cycle = [...resolvingStack, token]
            .map((item) => this.formatToken(item))
            .join(" -> ");

        throw new CircularDependencyError(
            `Circular dependency detected: ${cycle}. Consider using forwardRef(() => Token) to resolve declaration-order references.`,
        );
    }

    /**
     * Throws an error instructing callers to use async resolution.
     * @param {ProviderToken} token Provider token that requires async resolution.
     * @returns {never}
     */
    private throwAsyncResolution(token: ProviderToken): never {
        throw new AsyncResolutionError(
            `Provider ${this.formatToken(token)} requires async resolution. Use resolveAsync/resolve for this token.`,
        );
    }

    /**
     * Throws an error for async lifecycle hooks used in sync code paths.
     * @param {string} message Error message to throw.
     * @returns {never}
     */
    private throwAsyncLifecycle(message: string): never {
        throw new AsyncLifecycleError(message);
    }

    /**
     * Formats a normalized provider definition for error messages.
     * @param {NormalizedProvider} provider Provider definition to describe.
     * @returns {string} Human-readable provider description.
     */
    private describeProvider(provider: NormalizedProvider): string {
        switch (provider.kind) {
            case "class":
                return `class(${this.formatToken(provider.useClass)})`;
            case "factory":
                return `factory(${this.formatToken(provider.provide)})`;
            case "value":
                return `value(${this.formatToken(provider.provide)})`;
        }
    }

    /**
     * Formats a provider token for human-readable logs and errors.
     * @param {ProviderToken} token Provider token to format.
     * @returns {string} Human-readable token label.
     */
    private formatToken(token: ProviderToken): string {
        if (typeof token === "string") return token;
        if (typeof token === "symbol")
            return token.description ?? "SymbolToken";
        return token?.name ?? "AnonymousToken";
    }

    /**
     * Formats the current resolution path for diagnostic error messages.
     * @param {ProviderToken[]} resolvingStack Current resolution stack.
     * @param {ProviderToken} finalToken Final token being resolved.
     * @returns {string} Human-readable resolution path string.
     */
    private formatResolutionPath(
        resolvingStack: ProviderToken[],
        finalToken: ProviderToken,
    ): string {
        const path = [...resolvingStack, finalToken]
            .map((t) => this.formatToken(t))
            .join(" -> ");
        return path || this.formatToken(finalToken);
    }
}

/**
 * Creates a new internal DI container instance.
 * @returns {IContainerInternal} Fresh internal container implementation.
 */
export function createInternalContainer(): IContainerInternal {
    return new Container();
}

/**
 * Runtime accessor for resolving providers from the current container.
 */
export class ModuleRef {
    /**
     * Creates a module reference bound to a container.
     * @param {IContainer} container Container used to resolve providers.
     */
    constructor(private readonly container: IContainer) {}

    /**
     * Resolve a provider token from the current application container.
     * @param {ProviderToken<T>} token - Provider token to resolve.
     * @returns {T} Resolved provider instance.
     */
    get<T>(token: ProviderToken<T>): T {
        return this.container.resolve(token);
    }

    /**
     * Resolve a provider token asynchronously from the current application container.
     * @param {ProviderToken<T>} token - Provider token to resolve.
     * @returns {Promise<T>} Promise of the resolved provider instance.
     */
    async resolve<T>(token: ProviderToken<T>): Promise<T> {
        return this.container.resolveAsync(token);
    }

    /**
     * Return all provider tokens tagged with the given label.
     * @param {string | symbol} tag - Tag to search for.
     * @returns {ProviderToken[]} Matching provider tokens.
     */
    findByTag(tag: string | symbol): ProviderToken[] {
        return this.container.findByTag(tag);
    }
}

type NormalizedClassProvider<T = unknown> = ClassProvider<T> & {
    kind: "class";
};

type NormalizedValueProvider<T = unknown> = ValueProvider<T> & {
    kind: "value";
};

type NormalizedFactoryProvider<T = unknown> = FactoryProvider<T> & {
    kind: "factory";
    inject: ProviderToken[];
};

type NormalizedProvider<T = unknown> =
    | NormalizedClassProvider<T>
    | NormalizedValueProvider<T>
    | NormalizedFactoryProvider<T>;

type ModuleContext = {
    imports: Set<Constructor>;
    exports: Set<ProviderToken>;
    global: boolean;
};
