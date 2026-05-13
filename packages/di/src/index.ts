/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export type {
    Application,
    CreateApplicationOptions,
} from "./application.js";
export { createApplication } from "./application.js";
export type { IContainer } from "./container.js";
export { ModuleRef } from "./container.js";
export type {
    ForwardReference,
    InjectableOptions,
    InjectToken,
    ModuleMetadata,
} from "./decorators.js";
export {
    forwardRef,
    Global,
    Inject,
    Injectable,
    Module,
    metadataKeys,
    Optional,
} from "./decorators.js";

export { Logger } from "./logger.service.js";
export type { TestingApp } from "./testing.js";
export { createTestingApp } from "./testing.js";
export type {
    ClassProvider,
    Constructor,
    DynamicModule,
    FactoryProvider,
    LoggerService,
    LogLevel,
    ModuleImport,
    OnModuleDestroy,
    OnModuleInit,
    Provider,
    ProviderScope,
    ProviderToken,
    ValueProvider,
} from "./types.js";
export { REQUEST_CONTEXT } from "./types.js";
