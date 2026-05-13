/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
/** Default message used when an IPC error does not provide one. */
export const DEFAULT_IPC_ERROR_MESSAGE = "IPC communication failed";
/** Default type used when an IPC error does not provide one. */
export const DEFAULT_IPC_ERROR_TYPE = "Error";

/** Serialized shape sent across the IPC bridge. */
export type SerializedIpcError = {
    type: string;
    message: string;
} & Record<string, unknown>;

/** Base error type for IPC-safe errors. */
export abstract class IpcError extends Error {
    readonly type: string;

    protected constructor(type: string, message: string) {
        super(normalizeIpcErrorMessage(message));

        this.type = normalizeIpcErrorType(type);
        this.name = this.type;
    }

    /** Serialize the error into a bridge-safe payload. */
    toJson(): SerializedIpcError {
        return {
            type: this.type,
            message: this.message,
        };
    }
}

class GenericIpcError extends IpcError {
    constructor(error: SerializedIpcError) {
        super(error.type, error.message);

        for (const [key, value] of Object.entries(error)) {
            if (key === "type" || key === "message") {
                continue;
            }

            Object.defineProperty(this, key, {
                value,
                enumerable: true,
                configurable: true,
                writable: true,
            });
        }
    }
}

/** Check whether a value looks like a serialized IPC error. */
export function isSerializedIpcError(
    value: unknown,
): value is SerializedIpcError {
    return (
        isRecord(value) &&
        typeof value.type === "string" &&
        value.type.length > 0 &&
        typeof value.message === "string" &&
        value.message.length > 0
    );
}

/** Check whether a value is an IPC error instance. */
export function isIpcError(value: unknown): value is IpcError {
    return value instanceof IpcError;
}

/** Normalize any thrown value into a serialized IPC error payload. */
export function serializeIpcError(error: unknown): SerializedIpcError {
    if (isIpcError(error)) {
        const serialized = error.toJson();

        return {
            ...serialized,
            type: normalizeIpcErrorType(serialized.type),
            message: normalizeIpcErrorMessage(serialized.message),
        };
    }

    if (isSerializedIpcError(error)) {
        return {
            ...error,
            type: normalizeIpcErrorType(error.type),
            message: normalizeIpcErrorMessage(error.message),
        };
    }

    if (isRecord(error)) {
        return {
            type: normalizeIpcErrorType(
                typeof error.name === "string" ? error.name : undefined,
            ),
            message: normalizeIpcErrorMessage(
                typeof error.message === "string"
                    ? error.message
                    : String(error),
            ),
        };
    }

    return {
        type: DEFAULT_IPC_ERROR_TYPE,
        message: normalizeIpcErrorMessage(
            error instanceof Error ? error.message : String(error),
        ),
    };
}

/** Recreate a client-side IPC error instance from serialized data. */
export function toClientIpcError(error: SerializedIpcError): IpcError {
    return new GenericIpcError({
        ...error,
        type: normalizeIpcErrorType(error.type),
        message: normalizeIpcErrorMessage(error.message),
    });
}

/** Normalize an IPC error type value. */
function normalizeIpcErrorType(type: string | undefined): string {
    return typeof type === "string" && type.length > 0
        ? type
        : DEFAULT_IPC_ERROR_TYPE;
}

/** Normalize an IPC error message value. */
function normalizeIpcErrorMessage(message: string): string {
    return message.length > 0 ? message : DEFAULT_IPC_ERROR_MESSAGE;
}

/** Return true when the input is a plain object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
