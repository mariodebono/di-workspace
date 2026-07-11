/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import "reflect-metadata";
import { CONFIG_ROOT_DATA_TOKEN } from "../src/config.constants.js";
import { ConfigService } from "../src/config.service.js";
import { CONFIG_OPTIONS_TOKEN } from "../src/index.js";

type ProviderLike = {
    provide: unknown;
    inject?: unknown[];
    useFactory?: (...args: unknown[]) => unknown;
    useValue?: unknown;
};

export function setCtorParamTypes(target: object, types: unknown[]): void {
    Reflect.defineMetadata("design:paramtypes", types, target);
}

export function getProvider(
    moduleDef: {
        providers?: unknown[];
    },
    token: unknown,
): ProviderLike {
    const provider = (moduleDef.providers ?? []).find((entry) => {
        if (!entry || typeof entry !== "object" || !("provide" in entry)) {
            return false;
        }

        return (
            (
                entry as {
                    provide: unknown;
                }
            ).provide === token
        );
    });

    if (!provider || typeof provider !== "object") {
        throw new Error(`Provider not found for token: ${String(token)}`);
    }

    return provider as ProviderLike;
}

export function createConfigService<
    TConfig extends Record<string, unknown>,
>(moduleDef: { providers?: unknown[] }): ConfigService<TConfig> {
    const serviceProvider = getProvider(moduleDef, ConfigService);
    const optionsProvider = getProvider(moduleDef, CONFIG_OPTIONS_TOKEN);
    const rootConfigProvider = getProvider(moduleDef, CONFIG_ROOT_DATA_TOKEN);

    if (!serviceProvider.useFactory) {
        throw new Error("ConfigService provider does not expose useFactory.");
    }

    if (!rootConfigProvider.useFactory) {
        throw new Error("Root config provider does not expose useFactory.");
    }

    const rootConfig = rootConfigProvider.useFactory(optionsProvider.useValue);
    return serviceProvider.useFactory(
        rootConfig,
        optionsProvider.useValue,
    ) as ConfigService<TConfig>;
}
