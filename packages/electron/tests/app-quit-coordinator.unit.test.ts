/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Event } from "electron";
import { describe, expect, it, vi } from "vitest";
import { createAppQuitCoordinator } from "../src/app-quit-coordinator.js";

describe("app quit coordinator", () => {
    it("clears resumption approval when an earlier native listener has cancelled the event", async () => {
        const check = vi.fn().mockResolvedValue(true);
        const notify = vi.fn().mockResolvedValue(undefined);
        const quit = vi.fn(() => coordinator.beforeQuit(nativeEvent(true)));
        const coordinator = createAppQuitCoordinator({
            guarded: true,
            check,
            notify,
            quit,
            waitForClose: () => undefined,
            logger: {},
        });
        await coordinator.beforeQuit(nativeEvent());
        expect(coordinator.isQuitting()).toBe(false);
        check.mockResolvedValue(false);
        await coordinator.beforeQuit(nativeEvent());
        expect(check).toHaveBeenCalledTimes(2);
        expect(notify).toHaveBeenCalledOnce();
        expect(quit).toHaveBeenCalledOnce();
    });

    it("coalesces reentrant Quit requests from guards and notification callbacks", async () => {
        const events: Event[] = [];
        const reenter = () => {
            const event = nativeEvent();
            events.push(event);
            void coordinator.beforeQuit(event);
        };
        const check = vi.fn(async () => {
            reenter();
            return true;
        });
        const notify = vi.fn(async () => reenter());
        const quit = vi.fn(() => coordinator.beforeQuit(nativeEvent()));
        const coordinator = createAppQuitCoordinator({
            guarded: true,
            check,
            notify,
            quit,
            waitForClose: () => undefined,
            logger: {},
        });
        await coordinator.beforeQuit(nativeEvent());
        expect(events).toHaveLength(2);
        expect(events.every((event) => event.defaultPrevented)).toBe(true);
        expect(check).toHaveBeenCalledOnce();
        expect(notify).toHaveBeenCalledOnce();
        expect(quit).toHaveBeenCalledOnce();
        expect(coordinator.isQuitting()).toBe(true);
    });

    it("waits for a pending window-close attempt before checking quit permission", async () => {
        let finishClose!: () => void;
        const close = new Promise<void>((resolve) => {
            finishClose = resolve;
        });
        const check = vi.fn().mockResolvedValue(false);
        const coordinator = createAppQuitCoordinator({
            guarded: true,
            check,
            notify: vi.fn(),
            quit: vi.fn(),
            waitForClose: () => close,
            logger: {},
        });
        const event = nativeEvent();
        const attempt = coordinator.beforeQuit(event);
        await Promise.resolve();
        expect(event.defaultPrevented).toBe(true);
        expect(check).not.toHaveBeenCalled();
        finishClose();
        await attempt;
        expect(check).toHaveBeenCalledOnce();
        expect(coordinator.isPending()).toBe(false);
    });

    it("logs an unexpected callback failure and permits a fresh attempt", async () => {
        const error = vi.fn();
        const check = vi
            .fn()
            .mockRejectedValueOnce(new Error("failed"))
            .mockResolvedValue(true);
        const quit = vi.fn(() => coordinator.beforeQuit(nativeEvent()));
        const coordinator = createAppQuitCoordinator({
            guarded: true,
            check,
            notify: vi.fn(),
            quit,
            waitForClose: () => undefined,
            logger: { error },
        });
        await coordinator.beforeQuit(nativeEvent());
        expect(error).toHaveBeenCalledWith(
            "Application quit attempt failed",
            expect.any(Error),
        );
        expect(coordinator.isPending()).toBe(false);
        expect(quit).not.toHaveBeenCalled();
        await coordinator.beforeQuit(nativeEvent());
        expect(quit).toHaveBeenCalledOnce();
    });
});

/**
 * Creates a native-style cancellable event.
 *
 * @param cancelled - Whether an earlier listener has cancelled the event.
 */
function nativeEvent(cancelled = false): Event {
    return {
        defaultPrevented: cancelled,
        preventDefault() {
            this.defaultPrevented = true;
        },
    } as Event;
}
