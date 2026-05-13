/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import {
    createInternalContainer,
    type IContainer,
    ModuleRef,
} from "../src/container.js";
import {
    forwardRef,
    Inject,
    Injectable,
    Optional,
    REQUEST_CONTEXT,
} from "../src/index.js";

function setCtorParamTypes(target: object, types: unknown[]): void {
    Reflect.defineMetadata("design:paramtypes", types, target);
}

describe("@mariodebono/di container internals", () => {
    it("indexes provider tags and finds providers by tag", () => {
        const container = createInternalContainer();

        class TaggedProvider {}
        Injectable({ tags: ["alpha"] })(TaggedProvider);

        container.register(TaggedProvider);

        expect(container.findByTag("alpha")).toEqual([TaggedProvider]);
        expect(container.findByTag("missing")).toEqual([]);
    });

    it("allows visibility through global exports in module contexts", () => {
        const container = createInternalContainer();

        const SHARED = Symbol("SHARED");
        const CONSUMER = Symbol("CONSUMER");

        class GlobalModule {}
        class ConsumerModule {}

        container.register({ provide: SHARED, useValue: 10 });
        container.register({
            provide: CONSUMER,
            useFactory: (shared: number) => shared + 5,
            inject: [SHARED],
        });

        container.setProviderOwner(SHARED, GlobalModule);
        container.setProviderOwner(CONSUMER, ConsumerModule);
        container.setModuleContexts(
            new Map([
                [
                    GlobalModule,
                    {
                        imports: new Set(),
                        exports: new Set([SHARED]),
                        global: true,
                    },
                ],
                [
                    ConsumerModule,
                    {
                        imports: new Set(),
                        exports: new Set(),
                        global: false,
                    },
                ],
            ]) as unknown as Parameters<typeof container.setModuleContexts>[0],
        );

        expect(container.resolve<number>(CONSUMER)).toBe(15);
    });

    it("handles missing providers in sync and async paths", async () => {
        const container = createInternalContainer();

        expect(() => container.resolve("")).toThrow(/No provider for/);
        await expect(container.resolveAsync(Symbol("missing"))).rejects.toThrow(
            /No provider for/,
        );
    });

    it("throws on sync resolve while async singleton is pending and reuses pending async resolution", async () => {
        const container = createInternalContainer();
        const ASYNC = Symbol("ASYNC");
        let calls = 0;

        container.register({
            provide: ASYNC,
            useFactory: async () => {
                calls += 1;
                await new Promise((resolve) => setTimeout(resolve, 10));
                return 123;
            },
        });

        const pending = container.resolveAsync<number>(ASYNC);
        expect(() => container.resolve(ASYNC)).toThrow(
            /requires async resolution/,
        );

        const pending2 = container.resolveAsync<number>(ASYNC);
        await expect(pending).resolves.toBe(123);
        await expect(pending2).resolves.toBe(123);
        expect(calls).toBe(1);
    });

    it("supports optional injection fallbacks in sync and async dependency resolution", async () => {
        const container = createInternalContainer();

        const MISSING = Symbol("MISSING");
        const BROKEN = Symbol("BROKEN");

        class OptionalSyncMissing {
            constructor(public readonly dep: unknown) {}
        }
        Inject(MISSING)(OptionalSyncMissing, undefined, 0);
        Optional()(OptionalSyncMissing, undefined, 0);
        Injectable()(OptionalSyncMissing);
        setCtorParamTypes(OptionalSyncMissing, [Object]);

        class OptionalSyncBroken {
            constructor(public readonly dep: unknown) {}
        }
        Inject(BROKEN)(OptionalSyncBroken, undefined, 0);
        Optional()(OptionalSyncBroken, undefined, 0);
        Injectable()(OptionalSyncBroken);
        setCtorParamTypes(OptionalSyncBroken, [Object]);

        class OptionalAsyncMissing {
            constructor(public readonly dep: unknown) {}
        }
        Inject(MISSING)(OptionalAsyncMissing, undefined, 0);
        Optional()(OptionalAsyncMissing, undefined, 0);
        Injectable()(OptionalAsyncMissing);
        setCtorParamTypes(OptionalAsyncMissing, [Object]);

        class OptionalAsyncBroken {
            constructor(public readonly dep: unknown) {}
        }
        Inject(BROKEN)(OptionalAsyncBroken, undefined, 0);
        Optional()(OptionalAsyncBroken, undefined, 0);
        Injectable()(OptionalAsyncBroken);
        setCtorParamTypes(OptionalAsyncBroken, [Object]);

        container.register({
            provide: BROKEN,
            useFactory: (_value: unknown) => "broken",
            inject: [MISSING],
        });
        container.register(OptionalSyncMissing);
        container.register(OptionalSyncBroken);
        container.register(OptionalAsyncMissing);
        container.register(OptionalAsyncBroken);

        expect(container.resolve(OptionalSyncMissing).dep).toBeUndefined();
        expect(container.resolve(OptionalSyncBroken).dep).toBeUndefined();
        await expect(
            container.resolveAsync(OptionalAsyncMissing),
        ).resolves.toMatchObject({
            dep: undefined,
        });
        await expect(
            container.resolveAsync(OptionalAsyncBroken),
        ).resolves.toMatchObject({
            dep: undefined,
        });
    });

    it("handles builtin token injection for optional and non-optional parameters", async () => {
        const container = createInternalContainer();

        class RequiredBuiltinSync {
            constructor(public readonly dep: unknown) {}
        }
        Inject(Object)(RequiredBuiltinSync, undefined, 0);
        Injectable()(RequiredBuiltinSync);
        setCtorParamTypes(RequiredBuiltinSync, [Object]);

        class OptionalBuiltinSync {
            constructor(public readonly dep: unknown) {}
        }
        Inject(Object)(OptionalBuiltinSync, undefined, 0);
        Optional()(OptionalBuiltinSync, undefined, 0);
        Injectable()(OptionalBuiltinSync);
        setCtorParamTypes(OptionalBuiltinSync, [Object]);

        class RequiredBuiltinAsync {
            constructor(public readonly dep: unknown) {}
        }
        Inject(Object)(RequiredBuiltinAsync, undefined, 0);
        Injectable()(RequiredBuiltinAsync);
        setCtorParamTypes(RequiredBuiltinAsync, [Object]);

        class OptionalBuiltinAsync {
            constructor(public readonly dep: unknown) {}
        }
        Inject(Object)(OptionalBuiltinAsync, undefined, 0);
        Optional()(OptionalBuiltinAsync, undefined, 0);
        Injectable()(OptionalBuiltinAsync);
        setCtorParamTypes(OptionalBuiltinAsync, [Object]);

        container.register(RequiredBuiltinSync);
        container.register(OptionalBuiltinSync);
        container.register(RequiredBuiltinAsync);
        container.register(OptionalBuiltinAsync);

        expect(() => container.resolve(RequiredBuiltinSync)).toThrow(
            /No provider for dependency/,
        );
        expect(container.resolve(OptionalBuiltinSync).dep).toBeUndefined();
        await expect(
            container.resolveAsync(RequiredBuiltinAsync),
        ).rejects.toThrow(/No provider for dependency/);
        await expect(
            container.resolveAsync(OptionalBuiltinAsync),
        ).resolves.toMatchObject({
            dep: undefined,
        });
    });

    it("handles undefined constructor param metadata in sync and async resolution", async () => {
        const container = createInternalContainer();

        class RequiredUndefinedSync {
            constructor(public readonly dep: unknown) {}
        }
        Injectable()(RequiredUndefinedSync);
        setCtorParamTypes(RequiredUndefinedSync, [undefined]);

        class OptionalUndefinedSync {
            constructor(public readonly dep: unknown) {}
        }
        Optional()(OptionalUndefinedSync, undefined, 0);
        Injectable()(OptionalUndefinedSync);
        setCtorParamTypes(OptionalUndefinedSync, [undefined]);

        class RequiredUndefinedAsync {
            constructor(public readonly dep: unknown) {}
        }
        Injectable()(RequiredUndefinedAsync);
        setCtorParamTypes(RequiredUndefinedAsync, [undefined]);

        class OptionalUndefinedAsync {
            constructor(public readonly dep: unknown) {}
        }
        Optional()(OptionalUndefinedAsync, undefined, 0);
        Injectable()(OptionalUndefinedAsync);
        setCtorParamTypes(OptionalUndefinedAsync, [undefined]);

        container.register(RequiredUndefinedSync);
        container.register(OptionalUndefinedSync);
        container.register(RequiredUndefinedAsync);
        container.register(OptionalUndefinedAsync);

        expect(() => container.resolve(RequiredUndefinedSync)).toThrow(
            /No provider for dependency/,
        );
        expect(container.resolve(OptionalUndefinedSync).dep).toBeUndefined();
        await expect(
            container.resolveAsync(RequiredUndefinedAsync),
        ).rejects.toThrow(/No provider for dependency/);
        await expect(
            container.resolveAsync(OptionalUndefinedAsync),
        ).resolves.toMatchObject({
            dep: undefined,
        });
    });

    it("throws when forwardRef resolves to an empty token", () => {
        const container = createInternalContainer();

        class BadForwardRefConsumer {
            constructor(public readonly dep: unknown) {}
        }
        Inject(forwardRef(() => undefined as unknown as symbol))(
            BadForwardRefConsumer,
            undefined,
            0,
        );
        Injectable()(BadForwardRefConsumer);
        setCtorParamTypes(BadForwardRefConsumer, [Object]);

        container.register(BadForwardRefConsumer);

        expect(() => container.resolve(BadForwardRefConsumer)).toThrow(
            /forwardRef returned an empty token/,
        );
    });

    it("throws async lifecycle errors for sync resolve/destroy and supports async REQUEST_CONTEXT", async () => {
        const container = createInternalContainer();
        const CTX_ASYNC = Symbol("CTX_ASYNC");

        class AsyncOnInitService {
            async onModuleInit(): Promise<void> {
                await Promise.resolve();
            }
        }
        Injectable()(AsyncOnInitService);
        setCtorParamTypes(AsyncOnInitService, []);

        class AsyncOnDestroyService {
            async onModuleDestroy(): Promise<void> {
                await Promise.resolve();
            }
        }
        Injectable()(AsyncOnDestroyService);
        setCtorParamTypes(AsyncOnDestroyService, []);

        container.register(AsyncOnInitService);
        container.register(AsyncOnDestroyService);
        container.register({
            provide: CTX_ASYNC,
            useFactory: async (ctx: unknown) => ctx,
            inject: [REQUEST_CONTEXT],
        });

        expect(() => container.resolve(AsyncOnInitService)).toThrow(
            /async onModuleInit/,
        );

        await container.resolveAsync(AsyncOnDestroyService);
        expect(() => container.destroy()).toThrow(/destroyAsync/);
        await expect(container.resolveAsync(CTX_ASYNC)).resolves.toBe(
            CTX_ASYNC,
        );
    });

    it("covers duplicate provider descriptions and ModuleRef wrappers", async () => {
        const container = createInternalContainer();

        class ClassImpl {}
        Injectable()(ClassImpl);

        const TOKEN = "DUPLICATE";
        container.register({ provide: TOKEN, useClass: ClassImpl });

        expect(() =>
            container.register({
                provide: TOKEN,
                useFactory: () => 1,
            }),
        ).toThrow(/class\(ClassImpl\).*factory\(DUPLICATE\)/);

        const mockedContainer: IContainer = {
            resolve: vi.fn((): unknown => 1) as IContainer["resolve"],
            resolveAsync: vi.fn(
                async (): Promise<unknown> => 2,
            ) as IContainer["resolveAsync"],
            findByTag: vi.fn(() => [TOKEN]),
            destroy: vi.fn(),
            destroyAsync: vi.fn(async () => {}),
        };
        const moduleRef = new ModuleRef(mockedContainer);

        expect(moduleRef.get("A")).toBe(1);
        await expect(moduleRef.resolve("B")).resolves.toBe(2);
        expect(moduleRef.findByTag("x")).toEqual([TOKEN]);
    });

    it("handles constructor returning a promise-like object and destroy continue paths", async () => {
        const container = createInternalContainer();

        class PromiseCtorProvider {
            constructor() {
                // biome-ignore lint/correctness/noConstructorReturn: intentional test for promise-like constructor return path
                return Promise.resolve({}) as unknown as PromiseCtorProvider;
            }
        }
        Injectable()(PromiseCtorProvider);
        setCtorParamTypes(PromiseCtorProvider, []);

        container.register(PromiseCtorProvider);
        expect(() => container.resolve(PromiseCtorProvider)).toThrow(
            /requires async resolution/,
        );

        const raw = container as unknown as {
            lifecycleOrder: Array<string | symbol>;
            instances: Map<string | symbol, unknown>;
        };
        raw.lifecycleOrder.push("ghost-sync");
        raw.lifecycleOrder.push("ghost-async");
        raw.instances.delete("ghost-sync");
        raw.instances.delete("ghost-async");

        expect(() => container.destroy()).not.toThrow();
        await expect(container.destroyAsync()).resolves.toBeUndefined();
    });
});
