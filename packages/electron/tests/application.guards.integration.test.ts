/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Injectable, Module } from "@mariodebono/di";
import type { BrowserWindow, Event } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    app: {
        on: vi.fn(),
        removeListener: vi.fn(),
        quit: vi.fn(),
        setName: vi.fn(),
        whenReady: vi.fn().mockResolvedValue(undefined),
        getAppPath: vi.fn(() => "/app"),
        releaseSingleInstanceLock: vi.fn(),
        requestSingleInstanceLock: vi.fn(() => true),
    },
    Menu: { setApplicationMenu: vi.fn(), buildFromTemplate: vi.fn() },
}));
vi.mock("electron/main", () => ({ ...mocks, BrowserWindow: class {} }));
vi.mock("electron", () => ({ ...mocks, BrowserWindow: class {} }));
vi.mock("electron-log", () => ({ default: { create: vi.fn() } }));

import {
    AppReady,
    AppReadyOrder,
    BeforeAppQuit,
    BeforeMainWindowClose,
    createElectronApplication,
    type LifecycleGuardResult,
    LifecycleHookOrder,
    OnAppQuit,
    OnMainWindowClose,
    WindowManagerService,
} from "../src/index.js";

beforeEach(() => vi.clearAllMocks());

describe("application exit guards", () => {
    it("vetoes Quit without cleanup, then checks again when the application is no longer busy", async () => {
        let busy = true;
        const check = vi.fn(() => !busy);
        const fixture = await start({ quitGuard: check });
        const first = fixture.emitQuit();
        expect(first.event.defaultPrevented).toBe(true);
        await first.done;
        expect(fixture.destroyed()).toBe(false);
        expect(fixture.quitHooks).not.toHaveBeenCalled();
        busy = false;
        const second = fixture.emitQuit();
        await second.done;
        expect(check).toHaveBeenCalledTimes(2);
        expect(fixture.quitHooks).toHaveBeenCalledOnce();
        expect(fixture.destroyed()).toBe(true);
        await fixture.application.destroyAsync();
    });

    it("holds native Quit immediately, coalesces repeated requests and skips close guards on resumption", async () => {
        let allow!: (allowed: boolean) => void;
        const check = vi.fn(
            () =>
                new Promise<boolean>((resolve) => {
                    allow = resolve;
                }),
        );
        const closeCheck = vi.fn(() => false);
        const fixture = await start({
            quitGuard: check,
            closeGuard: closeCheck,
        });
        const first = fixture.emitQuit();
        const repeated = fixture.emitQuit();
        const close = fixture.emitClose();
        expect(first.event.defaultPrevented).toBe(true);
        expect(repeated.event.defaultPrevented).toBe(true);
        expect(close.event.defaultPrevented).toBe(true);
        await vi.waitFor(() => expect(check).toHaveBeenCalledOnce());
        expect(fixture.destroyed()).toBe(false);
        expect(fixture.quitHooks).not.toHaveBeenCalled();
        allow(true);
        await Promise.all([first.done, repeated.done, close.done]);
        expect(mocks.app.quit).toHaveBeenCalledOnce();
        expect(fixture.destroyed()).toBe(true);
        expect(closeCheck).not.toHaveBeenCalled();
        expect(fixture.closeHooks).toHaveBeenCalledOnce();
        await fixture.application.destroyAsync();
    });

    it.each([false, true])(
        "vetoes Close with hideOnClose=%s, then retries normally",
        async (hideOnClose) => {
            let busy = true;
            const fixture = await start({
                hideOnClose,
                closeGuard: () => !busy,
            });
            const first = fixture.emitClose();
            expect(first.event.defaultPrevented).toBe(true);
            await first.done;
            expect(fixture.hide).not.toHaveBeenCalled();
            expect(fixture.closeHooks).not.toHaveBeenCalled();
            expect(mocks.app.quit).not.toHaveBeenCalled();
            busy = false;
            await fixture.emitClose().done;
            await vi.waitFor(() => {
                if (hideOnClose) expect(fixture.hide).toHaveBeenCalledOnce();
                else expect(fixture.destroyed()).toBe(true);
            });
            expect(fixture.closeHooks).toHaveBeenCalledOnce();
            expect(fixture.quitHooks).toHaveBeenCalledTimes(
                hideOnClose ? 0 : 1,
            );
            await fixture.application.destroyAsync();
        },
    );

    it("also checks quit permission when an allowed window close requests Quit", async () => {
        const fixture = await start({
            closeGuard: () => true,
            quitGuard: () => false,
        });
        await fixture.emitClose().done;
        await vi.waitFor(() =>
            expect(fixture.quitGuard).toHaveBeenCalledOnce(),
        );
        expect(fixture.destroyed()).toBe(false);
        expect(fixture.quitHooks).not.toHaveBeenCalled();
        await fixture.application.destroyAsync();
    });

    it("does not queue a rejected Quit for when work finishes", async () => {
        let allow = false;
        const fixture = await start({ quitGuard: () => allow });
        await fixture.emitQuit().done;
        allow = true;
        await Promise.resolve();
        expect(mocks.app.quit).not.toHaveBeenCalled();
        expect(fixture.destroyed()).toBe(false);
        await fixture.application.destroyAsync();
    });

    it("rechecks permission if another native close listener cancels an approved quit", async () => {
        const fixture = await start();
        const cancel = (event: Event) => event.preventDefault();
        fixture.window.on("close", cancel);
        await fixture.emitQuit().done;
        expect(fixture.destroyed()).toBe(false);
        fixture.window.removeListener("close", cancel);
        await fixture.emitQuit().done;
        expect(fixture.quitGuard).toHaveBeenCalledTimes(2);
        expect(fixture.destroyed()).toBe(true);
        await fixture.application.destroyAsync();
    });

    it("registers Quit guards before app-ready callbacks and without a main window", async () => {
        const fixture = await start({
            withoutWindow: true,
            quitGuard: () => false,
        });
        await fixture.emitQuit().done;
        expect(fixture.quitGuard).toHaveBeenCalledOnce();
        expect(fixture.quitHooks).not.toHaveBeenCalled();
        await fixture.application.destroyAsync();
    });

    it("protects the main window during after-window app-ready work", async () => {
        const fixture = await start({
            closeDuringReady: true,
            closeGuard: () => false,
        });
        expect(fixture.closeGuard).toHaveBeenCalledOnce();
        expect(fixture.closeHooks).not.toHaveBeenCalled();
        expect(fixture.destroyed()).toBe(false);
        await fixture.application.destroyAsync();
    });

    it("does not resume pending permission checks after application disposal", async () => {
        let allow!: (allowed: boolean) => void;
        const fixture = await start({
            quitGuard: () =>
                new Promise<boolean>((resolve) => {
                    allow = resolve;
                }),
        });
        const attempt = fixture.emitQuit();
        await vi.waitFor(() => expect(allow).toBeTypeOf("function"));
        await fixture.application.destroyAsync();
        allow(true);
        await attempt.done;
        expect(mocks.app.quit).not.toHaveBeenCalled();
        expect(fixture.quitHooks).not.toHaveBeenCalled();
        expect(mocks.app.removeListener).toHaveBeenCalledWith(
            "before-quit",
            expect.any(Function),
        );
    });

    it("coalesces repeated close requests during an async permission check", async () => {
        let allow!: (allowed: boolean) => void;
        const fixture = await start({
            hideOnClose: true,
            closeGuard: () =>
                new Promise<boolean>((resolve) => {
                    allow = resolve;
                }),
        });
        const first = fixture.emitClose();
        const second = fixture.emitClose();
        await vi.waitFor(() =>
            expect(fixture.closeGuard).toHaveBeenCalledOnce(),
        );
        allow(true);
        await Promise.all([first.done, second.done]);
        expect(fixture.hide).toHaveBeenCalledOnce();
        expect(fixture.closeHooks).toHaveBeenCalledOnce();
        await fixture.application.destroyAsync();
    });

    it("logs a rejected permission promise and leaves the app usable for another attempt", async () => {
        const fixture = await start({
            quitGuard: vi
                .fn()
                .mockRejectedValueOnce(new Error("check failed"))
                .mockResolvedValue(true),
        });
        await fixture.emitQuit().done;
        expect(fixture.error).toHaveBeenCalledWith(
            "@BeforeAppQuit handler failed: ExitPolicy.canQuit",
            expect.any(Error),
        );
        expect(fixture.quitHooks).not.toHaveBeenCalled();
        await fixture.emitQuit().done;
        expect(fixture.destroyed()).toBe(true);
        await fixture.application.destroyAsync();
    });
});

/**
 * Builds the real DI application with a synchronous, cancellable native event model.
 *
 * @param options - Application-owned permission policies and window behaviour.
 */
async function start(
    options: {
        quitGuard?: () => LifecycleGuardResult;
        closeGuard?: () => LifecycleGuardResult;
        hideOnClose?: boolean;
        withoutWindow?: boolean;
        closeDuringReady?: boolean;
    } = {},
) {
    const appEvents = createEmitter();
    const windowEvents = createEmitter();
    const contentEvents = createEmitter();
    const quitGuard = vi.fn(options.quitGuard ?? (() => true));
    const closeGuard = vi.fn(options.closeGuard ?? (() => true));
    const quitHooks = vi.fn();
    const closeHooks = vi.fn();
    const error = vi.fn();
    const hide = vi.fn();
    let destroyed = false;
    const window = {
        ...windowEvents,
        webContents: contentEvents,
        hide,
        isDestroyed: () => destroyed,
    } as unknown as BrowserWindow;
    mocks.app.on.mockImplementation(appEvents.on);
    mocks.app.removeListener.mockImplementation(appEvents.removeListener);
    mocks.app.quit.mockImplementation(() => {
        const quit = appEvents.emit("before-quit");
        if (quit.event.defaultPrevented) return;
        if (!options.withoutWindow) {
            const close = windowEvents.emit("close");
            if (close.event.defaultPrevented) return;
        }
        destroyed = true;
        appEvents.emit("will-quit");
    });
    vi.spyOn(
        WindowManagerService.prototype,
        "createMainWindow",
    ).mockImplementation(async () => {
        expect(
            mocks.app.on.mock.calls.some(([name]) => name === "before-quit"),
        ).toBe(true);
        return options.withoutWindow ? (null as never) : window;
    });

    @Injectable()
    class ExitPolicy {
        @AppReady({ order: AppReadyOrder.AfterWindow })
        async ready(): Promise<void> {
            if (options.closeDuringReady) {
                const attempt = windowEvents.emit("close");
                expect(attempt.event.defaultPrevented).toBe(true);
                await attempt.done;
            }
        }
        @BeforeAppQuit()
        canQuit(): LifecycleGuardResult {
            return quitGuard();
        }
        @BeforeMainWindowClose()
        canClose(): LifecycleGuardResult {
            return closeGuard();
        }
        @OnAppQuit({ order: LifecycleHookOrder.Before })
        quitting(): void {
            quitHooks();
        }
        @OnMainWindowClose({ order: LifecycleHookOrder.Before })
        closing(): void {
            closeHooks();
        }
    }
    @Module({ providers: [ExitPolicy] })
    class EntryModule {}
    const logger = {
        error,
        debug: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
        withContext: vi.fn(),
    };
    logger.withContext.mockReturnValue(logger);
    const result = await createElectronApplication(EntryModule, {
        hideOnClose: options.hideOnClose,
        logger,
    });
    if (result.status !== "started")
        throw new Error("Expected application to start");
    return {
        application: result.application,
        window,
        hide,
        error,
        quitHooks,
        closeHooks,
        quitGuard,
        closeGuard,
        destroyed: () => destroyed,
        emitQuit: () => appEvents.emit("before-quit"),
        emitClose: () => windowEvents.emit("close"),
    };
}

/** Provides native-style events that do not await asynchronous listeners. */
function createEmitter() {
    const listeners = new Map<string, Array<(event: Event) => unknown>>();
    return {
        on: (name: string, listener: (event: Event) => unknown) => {
            const handlers = listeners.get(name) ?? [];
            handlers.push(listener);
            listeners.set(name, handlers);
        },
        removeListener: (name: string, listener: (event: Event) => unknown) => {
            listeners.set(
                name,
                (listeners.get(name) ?? []).filter(
                    (handler) => handler !== listener,
                ),
            );
        },
        emit: (name: string) => {
            const event = {
                defaultPrevented: false,
                preventDefault() {
                    this.defaultPrevented = true;
                },
            } as Event;
            const results = (listeners.get(name) ?? []).map((listener) =>
                listener(event),
            );
            return { event, done: Promise.all(results) };
        },
    };
}
