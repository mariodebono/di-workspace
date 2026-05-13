/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { SerializedIpcError } from "./ipc-error.js";
import {
    DEFAULT_IPC_ERROR_MESSAGE,
    isSerializedIpcError,
    toClientIpcError,
} from "./ipc-error.js";

export type IpcSuccessResponse<T> = {
    success: true;
    data: T;
};

export type IpcErrorResponse = {
    success: false;
    error: SerializedIpcError;
};

export type IpcResponse<T> = IpcSuccessResponse<T> | IpcErrorResponse;

export function createIpcSuccessResponse<T>(data: T): IpcSuccessResponse<T> {
    return { success: true, data };
}

export function createIpcErrorResponse(
    error: SerializedIpcError,
): IpcErrorResponse {
    return { success: false, error };
}

export function unwrapIpcResponse<T>(value: unknown): T {
    if (!isIpcResponse(value)) {
        throw new Error(DEFAULT_IPC_ERROR_MESSAGE);
    }

    if (value.success) {
        return value.data as T;
    }

    if (!isSerializedIpcError(value.error)) {
        throw new Error(DEFAULT_IPC_ERROR_MESSAGE);
    }

    throw toClientIpcError(value.error);
}

function isIpcResponse(value: unknown): value is IpcResponse<unknown> {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    if (!("success" in value) || typeof value.success !== "boolean") {
        return false;
    }

    return value.success ? "data" in value : "error" in value;
}
