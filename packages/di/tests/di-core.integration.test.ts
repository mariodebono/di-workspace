/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import {
    createApplication,
    forwardRef,
    Inject,
    Injectable,
    Logger,
    Module,
    Optional,
} from "../src/index.js";

function setCtorParamTypes(target: object, types: unknown[]): void {
    Reflect.defineMetadata("design:paramtypes", types, target);
}

describe("@mariodebono/di DI", () => {
    it("isolates singleton instances across separate applications", async () => {
        class CounterService {
            value = 0;

            inc(): number {
                this.value += 1;
                return this.value;
            }
        }
        Injectable()(CounterService);

        class RootModule {}
        Module({ providers: [CounterService], exports: [CounterService] })(
            RootModule,
        );

        const appA = await createApplication(RootModule);
        const appB = await createApplication(RootModule);

        try {
            const a = appA.get(CounterService);
            const b = appB.get(CounterService);

            expect(a).not.toBe(b);
            a.inc();
            expect(b.value).toBe(0);
        } finally {
            appA.destroy();
            appB.destroy();
        }
    });

    it("destroying one application does not affect a second application", async () => {
        class CounterService {
            value = 0;

            inc(): number {
                this.value += 1;
                return this.value;
            }
        }
        Injectable()(CounterService);

        class RootModule {}
        Module({ providers: [CounterService], exports: [CounterService] })(
            RootModule,
        );

        const appA = await createApplication(RootModule);
        const appB = await createApplication(RootModule);

        try {
            appA.get(CounterService).inc();
            expect(appB.get(CounterService).inc()).toBe(1);

            appA.destroy();

            expect(appB.get(CounterService).inc()).toBe(2);
        } finally {
            appB.destroy();
        }
    });

    it("enforces module visibility for constructor dependencies", async () => {
        class HiddenService {}
        Injectable()(HiddenService);

        class ConsumerService {
            constructor(public readonly hiddenService: HiddenService) {}
        }
        Injectable()(ConsumerService);
        setCtorParamTypes(ConsumerService, [HiddenService]);

        class HiddenModule {}
        Module({ providers: [HiddenService] })(HiddenModule);

        class ConsumerModule {}
        Module({ providers: [ConsumerService], exports: [ConsumerService] })(
            ConsumerModule,
        );

        class RootModule {}
        Module({ imports: [HiddenModule, ConsumerModule] })(RootModule);

        await expect(() => createApplication(RootModule)).rejects.toThrow(
            /is not exported by .* for consumer/,
        );
    });

    it("resolves constructor dependencies when module exports/imports are correct", async () => {
        class PublicService {}
        Injectable()(PublicService);

        class ConsumerService {
            constructor(public readonly publicService: PublicService) {}
        }
        Injectable()(ConsumerService);
        setCtorParamTypes(ConsumerService, [PublicService]);

        class PublicModule {}
        Module({ providers: [PublicService], exports: [PublicService] })(
            PublicModule,
        );

        class ConsumerModule {}
        Module({ imports: [PublicModule], providers: [ConsumerService] })(
            ConsumerModule,
        );

        class RootModule {}
        Module({ imports: [ConsumerModule] })(RootModule);

        const app = await createApplication(RootModule);

        try {
            const consumer = app.get(ConsumerService);
            expect(consumer.publicService).toBeInstanceOf(PublicService);
        } finally {
            app.destroy();
        }
    });

    it("@Inject resolves symbol-backed value, factory, and class providers", async () => {
        const VALUE_TOKEN = Symbol("VALUE_TOKEN");
        const FACTORY_TOKEN = Symbol("FACTORY_TOKEN");
        const CLASS_TOKEN = Symbol("CLASS_TOKEN");

        class ClassTokenImpl {
            marker = "class-token";
        }
        Injectable()(ClassTokenImpl);

        class ConsumerService {
            constructor(
                public readonly value: number,
                public readonly factoryValue: number,
                public readonly classInstance: ClassTokenImpl,
            ) {}
        }
        Inject(VALUE_TOKEN)(ConsumerService, undefined, 0);
        Inject(FACTORY_TOKEN)(ConsumerService, undefined, 1);
        Inject(CLASS_TOKEN)(ConsumerService, undefined, 2);
        Injectable()(ConsumerService);
        setCtorParamTypes(ConsumerService, [Object, Object, Object]);

        class RootModule {}
        Module({
            providers: [
                { provide: VALUE_TOKEN, useValue: 123 },
                { provide: FACTORY_TOKEN, useFactory: () => 456 },
                { provide: CLASS_TOKEN, useClass: ClassTokenImpl },
                ConsumerService,
            ],
        })(RootModule);

        const app = await createApplication(RootModule);

        try {
            const consumer = app.get(ConsumerService);
            expect(consumer.value).toBe(123);
            expect(consumer.factoryValue).toBe(456);
            expect(consumer.classInstance).toBeInstanceOf(ClassTokenImpl);
        } finally {
            app.destroy();
        }
    });

    it("@Optional injects undefined for missing provider", async () => {
        const OPTIONAL_TOKEN = Symbol("OPTIONAL_TOKEN");

        class OptionalConsumer {
            constructor(public readonly optionalValue: unknown) {}
        }
        Inject(OPTIONAL_TOKEN)(OptionalConsumer, undefined, 0);
        Optional()(OptionalConsumer, undefined, 0);
        Injectable()(OptionalConsumer);
        setCtorParamTypes(OptionalConsumer, [Object]);

        class RootModule {}
        Module({ providers: [OptionalConsumer] })(RootModule);

        const app = await createApplication(RootModule);

        try {
            expect(app.get(OptionalConsumer).optionalValue).toBeUndefined();
        } finally {
            app.destroy();
        }
    });

    it("forwardRef resolves declaration-order dependency tokens", async () => {
        class ForwardConsumer {
            constructor(public readonly lateDependency: LateDependency) {}
        }

        Inject(forwardRef(() => LateDependency))(ForwardConsumer, undefined, 0);
        Injectable()(ForwardConsumer);
        setCtorParamTypes(ForwardConsumer, [Object]);

        class LateDependency {}
        Injectable()(LateDependency);

        class RootModule {}
        Module({ providers: [LateDependency, ForwardConsumer] })(RootModule);

        const app = await createApplication(RootModule);

        try {
            const consumer = app.get(ForwardConsumer);
            expect(consumer.lateDependency).toBeInstanceOf(LateDependency);
        } finally {
            app.destroy();
        }
    });

    it("resolves async constructor sibling dependencies that share a dependency", async () => {
        class UserPrefsService {
            constructor(public readonly logger: Logger) {}
        }
        Injectable()(UserPrefsService);
        setCtorParamTypes(UserPrefsService, [Logger]);

        class ImportLegacyUserPrefsMigration {
            constructor(
                public readonly logger: Logger,
                public readonly userPrefs: UserPrefsService,
            ) {}
        }
        Injectable()(ImportLegacyUserPrefsMigration);
        setCtorParamTypes(ImportLegacyUserPrefsMigration, [
            Logger,
            UserPrefsService,
        ]);

        class RootModule {}
        Module({
            providers: [ImportLegacyUserPrefsMigration, UserPrefsService],
        })(RootModule);

        const app = await createApplication(RootModule);

        try {
            const migration = app.get(ImportLegacyUserPrefsMigration);
            expect(migration.logger).toBeInstanceOf(Logger);
            expect(migration.userPrefs).toBeInstanceOf(UserPrefsService);
            expect(migration.userPrefs.logger).toBeInstanceOf(Logger);
        } finally {
            app.destroy();
        }
    });

    it("resolves async factory sibling dependencies that share a dependency", async () => {
        const FACTORY_CONSUMER = Symbol("FACTORY_CONSUMER");

        class UserPrefsService {
            constructor(public readonly logger: Logger) {}
        }
        Injectable()(UserPrefsService);
        setCtorParamTypes(UserPrefsService, [Logger]);

        class RootModule {}
        Module({
            providers: [
                {
                    provide: FACTORY_CONSUMER,
                    useFactory: (
                        logger: Logger,
                        userPrefs: UserPrefsService,
                    ) => ({
                        logger,
                        userPrefs,
                    }),
                    inject: [Logger, UserPrefsService],
                },
                UserPrefsService,
            ],
        })(RootModule);

        const app = await createApplication(RootModule);

        try {
            const consumer = app.get<{
                logger: Logger;
                userPrefs: UserPrefsService;
            }>(FACTORY_CONSUMER);
            expect(consumer.logger).toBeInstanceOf(Logger);
            expect(consumer.userPrefs).toBeInstanceOf(UserPrefsService);
            expect(consumer.userPrefs.logger).toBeInstanceOf(Logger);
        } finally {
            app.destroy();
        }
    });

    it("throws explicit circular dependency errors", async () => {
        class ServiceA {
            constructor(public readonly serviceB: ServiceB) {}
        }

        class ServiceB {
            constructor(public readonly serviceA: ServiceA) {}
        }

        Injectable()(ServiceA);
        Injectable()(ServiceB);
        setCtorParamTypes(ServiceA, [ServiceB]);
        setCtorParamTypes(ServiceB, [ServiceA]);

        class RootModule {}
        Module({ providers: [ServiceA, ServiceB] })(RootModule);

        await expect(() => createApplication(RootModule)).rejects.toThrow(
            /Circular dependency detected:/,
        );
    });

    it("throws on duplicate provider token registration", async () => {
        const DUPLICATE_TOKEN = Symbol("DUPLICATE_TOKEN");

        class RootModule {}
        Module({
            providers: [
                { provide: DUPLICATE_TOKEN, useValue: 1 },
                { provide: DUPLICATE_TOKEN, useValue: 2 },
            ],
        })(RootModule);

        await expect(() => createApplication(RootModule)).rejects.toThrow(
            /Duplicate provider registration for token/,
        );
    });

    it("deduplicates repeated module imports within one app graph", async () => {
        class SharedModule {
            static initCount = 0;

            onModuleInit(): void {
                SharedModule.initCount += 1;
            }
        }
        Module({})(SharedModule);

        class FeatureOneModule {}
        Module({ imports: [SharedModule] })(FeatureOneModule);

        class FeatureTwoModule {}
        Module({ imports: [SharedModule] })(FeatureTwoModule);

        class RootModule {}
        Module({ imports: [FeatureOneModule, FeatureTwoModule, SharedModule] })(
            RootModule,
        );

        SharedModule.initCount = 0;

        const app = await createApplication(RootModule);

        try {
            expect(SharedModule.initCount).toBe(1);
        } finally {
            app.destroy();
        }
    });

    it("initializes async singleton factories during bootstrap so get works", async () => {
        const ASYNC_TOKEN = Symbol("ASYNC_TOKEN");

        class RootModule {}
        Module({
            providers: [
                {
                    provide: ASYNC_TOKEN,
                    useFactory: async () => 456,
                },
            ],
        })(RootModule);

        const app = await createApplication(RootModule);

        try {
            expect(app.get<number>(ASYNC_TOKEN)).toBe(456);
        } finally {
            await app.destroyAsync();
        }
    });

    it("throws a clear error when sync get is used for async transient providers", async () => {
        const ASYNC_TOKEN = Symbol("ASYNC_TOKEN");

        class RootModule {}
        Module({
            providers: [
                {
                    provide: ASYNC_TOKEN,
                    useFactory: async () => 456,
                    scope: "transient",
                },
            ],
        })(RootModule);

        const app = await createApplication(RootModule);

        try {
            expect(() => app.get(ASYNC_TOKEN)).toThrow(
                /requires async resolution\. Use resolveAsync\/resolve/,
            );
        } finally {
            await app.destroyAsync();
        }
    });

    it("awaits async onModuleInit during application bootstrap", async () => {
        class AsyncInitModule {
            static initialized = false;

            async onModuleInit(): Promise<void> {
                await Promise.resolve();
                AsyncInitModule.initialized = true;
            }
        }
        Module({})(AsyncInitModule);

        AsyncInitModule.initialized = false;
        const app = await createApplication(AsyncInitModule);

        try {
            expect(AsyncInitModule.initialized).toBe(true);
        } finally {
            await app.destroyAsync();
        }
    });

    it("runs async onModuleDestroy hooks in reverse order via destroyAsync", async () => {
        const destroyed: string[] = [];

        class FirstModule {
            async onModuleDestroy(): Promise<void> {
                await Promise.resolve();
                destroyed.push("first");
            }
        }
        Module({})(FirstModule);

        class SecondModule {
            async onModuleDestroy(): Promise<void> {
                await Promise.resolve();
                destroyed.push("second");
            }
        }
        Module({})(SecondModule);

        class RootModule {}
        Module({ imports: [FirstModule, SecondModule] })(RootModule);

        const app = await createApplication(RootModule);
        await app.destroyAsync();

        expect(destroyed).toEqual(["second", "first"]);
    });

    it("supports resolve for async transient providers", async () => {
        const ASYNC_TOKEN = Symbol("ASYNC_TOKEN");

        class RootModule {}
        Module({
            providers: [
                {
                    provide: ASYNC_TOKEN,
                    useFactory: async () => {
                        await new Promise((resolve) => setTimeout(resolve, 10));
                        return { id: "singleton" };
                    },
                    scope: "transient",
                },
            ],
        })(RootModule);

        const app = await createApplication(RootModule);

        try {
            const value = await app.resolve<{ id: string }>(ASYNC_TOKEN);
            expect(value).toEqual({ id: "singleton" });
        } finally {
            await app.destroyAsync();
        }
    });

    it("allows disabling logger output with logger: false", async () => {
        class RootModule {}
        Module({})(RootModule);

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const debugSpy = vi
            .spyOn(console, "debug")
            .mockImplementation(() => {});

        const app = await createApplication(RootModule, { logger: false });

        try {
            const logger = app.get(Logger);
            logger.log("hidden");
            logger.warn("hidden");
            logger.error("hidden");
            logger.debug("hidden");

            expect(logSpy).not.toHaveBeenCalled();
            expect(warnSpy).not.toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
            expect(debugSpy).not.toHaveBeenCalled();
        } finally {
            app.destroy();
            logSpy.mockRestore();
            warnSpy.mockRestore();
            errorSpy.mockRestore();
            debugSpy.mockRestore();
        }
    });

    it("supports log level overrides in createApplication options", async () => {
        class RootModule {}
        Module({})(RootModule);

        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const app = await createApplication(RootModule, {
            logger: ["error"],
        });

        try {
            const logger = app.get(Logger);
            logger.log("suppressed");
            logger.error("visible");

            expect(logSpy).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledOnce();
        } finally {
            app.destroy();
            logSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});
