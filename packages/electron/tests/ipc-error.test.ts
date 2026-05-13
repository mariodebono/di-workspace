/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import {
    DEFAULT_IPC_ERROR_MESSAGE,
    IpcError,
    isIpcError,
    isSerializedIpcError,
    serializeIpcError,
    toClientIpcError,
} from "../src/ipc-error.js";

class TestIpcError extends IpcError {
    constructor(
        message: string,
        private readonly key?: string,
    ) {
        super("TestIpcError", message);
    }

    override toJson() {
        return {
            ...super.toJson(),
            key: this.key,
        };
    }
}

describe("ipc-error helpers", () => {
    it("preserves type and message on IpcError instances", () => {
        const error = new TestIpcError("Translated failure");

        expect(error).toBeInstanceOf(Error);
        expect(error.type).toBe("TestIpcError");
        expect(error.name).toBe("TestIpcError");
        expect(error.message).toBe("Translated failure");
        expect(isIpcError(error)).toBe(true);
    });

    it("serializes custom IpcError payloads through toJson", () => {
        const error = new TestIpcError("Translated failure", "projects.list");

        expect(serializeIpcError(error)).toEqual({
            type: "TestIpcError",
            message: "Translated failure",
            key: "projects.list",
        });
    });

    it("normalizes plain Error instances into serialized ipc errors", () => {
        expect(serializeIpcError(new TypeError("Invalid input"))).toEqual({
            type: "TypeError",
            message: "Invalid input",
        });
    });

    it("normalizes serialized error payloads with extra fields", () => {
        expect(
            serializeIpcError({
                type: "BridgeError",
                message: "Translated failure",
                key: "projects.list_failed",
            }),
        ).toEqual({
            type: "BridgeError",
            message: "Translated failure",
            key: "projects.list_failed",
        });
    });

    it("normalizes plain records using fallback name and default message", () => {
        expect(
            serializeIpcError({
                name: "CustomError",
                message: "",
                details: { id: 1 },
            }),
        ).toEqual({
            type: "CustomError",
            message: DEFAULT_IPC_ERROR_MESSAGE,
        });
    });

    it("normalizes non-error values into fallback serialized ipc errors", () => {
        expect(serializeIpcError("bad request")).toEqual({
            type: "Error",
            message: "bad request",
        });
    });

    it("normalizes empty messages to the default ipc error message", () => {
        class EmptyMessageError extends IpcError {
            constructor() {
                super("EmptyMessageError", "");
            }
        }

        expect(serializeIpcError(new EmptyMessageError())).toEqual({
            type: "EmptyMessageError",
            message: DEFAULT_IPC_ERROR_MESSAGE,
        });
    });

    it("rebuilds client errors without app-specific subclasses", () => {
        const error = toClientIpcError({
            type: "projects.list_failed",
            message: "Translated failure",
            key: "projects.list_failed",
        });

        expect(error).toBeInstanceOf(IpcError);
        expect(error.type).toBe("projects.list_failed");
        expect(error.message).toBe("Translated failure");
        expect((error as { key?: string }).key).toBe("projects.list_failed");
    });

    it("detects serialized ipc error payloads", () => {
        expect(
            isSerializedIpcError({
                type: "BridgeUserFacingError",
                message: "Translated failure",
                key: "projects.list_failed",
            }),
        ).toBe(true);
        expect(isSerializedIpcError({ message: "missing type" })).toBe(false);
        expect(
            isSerializedIpcError({ type: "", message: "missing type" }),
        ).toBe(false);
    });
});
