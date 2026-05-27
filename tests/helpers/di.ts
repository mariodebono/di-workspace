/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import "reflect-metadata";
import { type InjectableOptions, metadataKeys } from "@mariodebono/di";

export type TestFactoryProvider<T = unknown> = {
    provide: unknown;
    useFactory: (...args: unknown[]) => T;
    inject?: unknown[];
};

export type TestValueProvider<T = unknown> = {
    provide: unknown;
    useValue: T;
};

export function findProvider<TProvider extends { provide: unknown }>(
    providers: readonly unknown[] | undefined,
    token: unknown,
): TProvider {
    const provider = providers?.find(
        (candidate): candidate is TProvider =>
            typeof candidate === "object" &&
            candidate !== null &&
            "provide" in candidate &&
            candidate.provide === token,
    );

    if (!provider) {
        throw new Error(`Provider not found: ${String(token)}`);
    }

    return provider;
}

export function getInjectableOptions(
    target: object,
): InjectableOptions | undefined {
    return Reflect.getMetadata(metadataKeys.injectableOptions, target) as
        | InjectableOptions
        | undefined;
}
