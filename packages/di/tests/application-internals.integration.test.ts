/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import {
    createApplication,
    Injectable,
    Logger,
    type LoggerService,
    Module,
} from "../src/index.js";

describe("@mariodebono/di application internals", () => {
    it("exposes findByTag and getContainer from the application facade", async () => {
        class TaggedService {}
        Injectable({ tags: ["core:tag"] })(TaggedService);

        class RootModule {}
        Module({ providers: [TaggedService], exports: [TaggedService] })(
            RootModule,
        );

        const app = await createApplication(RootModule);

        try {
            expect(app.findByTag("core:tag")).toEqual([TaggedService]);
            expect(app.getContainer().getProviderScope(TaggedService)).toBe(
                "singleton",
            );
        } finally {
            app.destroy();
        }
    });

    it("supports class-based custom logger injection in createApplication options", async () => {
        class CustomLogger implements LoggerService {
            context = "";

            withContext(context: string): LoggerService {
                this.context = context;
                return this;
            }

            log(): void {}
            error(): void {}
            warn(): void {}
            debug(): void {}
            verbose(): void {}
            fatal(): void {}
            setLogLevels(): void {}
        }

        class RootModule {}
        Module({})(RootModule);

        const app = await createApplication(RootModule, {
            logger: CustomLogger,
        });

        try {
            const injectedLogger = app.get(Logger);
            expect(injectedLogger).toBeInstanceOf(CustomLogger);
        } finally {
            app.destroy();
        }
    });

    it("merges dynamic module metadata for repeated dynamic module imports", async () => {
        const TOKEN_A = Symbol("TOKEN_A");
        const TOKEN_B = Symbol("TOKEN_B");
        const TOKEN_C = Symbol("TOKEN_C");

        class FeatureModule {}
        Module({})(FeatureModule);

        class RootModule {}
        Module({})(RootModule);

        const app = await createApplication({
            module: RootModule,
            imports: [
                {
                    module: FeatureModule,
                    providers: [{ provide: TOKEN_A, useValue: 1 }],
                    exports: [TOKEN_A],
                },
                {
                    module: FeatureModule,
                    providers: [
                        {
                            provide: TOKEN_B,
                            useFactory: (a: number) => a + 1,
                            inject: [TOKEN_A],
                        },
                    ],
                    exports: [TOKEN_B],
                },
            ],
            providers: [
                {
                    provide: TOKEN_C,
                    useFactory: (b: number) => b + 1,
                    inject: [TOKEN_B],
                },
            ],
        });

        try {
            expect(app.get<number>(TOKEN_C)).toBe(3);
        } finally {
            app.destroy();
        }
    });
});
