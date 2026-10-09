/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Logger } from "@mariodebono/di";
import type { Event } from "electron";

interface AppQuitCoordinatorOptions {
    guarded: boolean;
    check: () => Promise<boolean>;
    notify: () => Promise<void>;
    quit: () => void;
    waitForClose: () => Promise<void> | undefined;
    logger: Logger;
}

/**
 * Holds native quit requests while permission checks run.
 *
 * @param options - Permission checks and native lifecycle callbacks.
 */
export function createAppQuitCoordinator(options: AppQuitCoordinatorOptions) {
    let pending: Promise<void> | undefined;
    let resuming = false;
    let quitting = false;
    let notified = false;
    let disposed = false;

    /** Resets approval after another native listener cancels quitting. */
    const cancel = (): void => {
        quitting = false;
        resuming = false;
        notified = false;
    };

    /**
     * Intercepts before-quit synchronously; Electron does not await listeners.
     *
     * @param event - The cancellable native quit event.
     */
    const beforeQuit = (event: Event): void | Promise<void> => {
        if (disposed) return;
        if (event.defaultPrevented) {
            if (options.guarded && (resuming || quitting)) cancel();
            return;
        }

        if (!options.guarded) {
            quitting = true;
            if (!notified) {
                notified = true;
                void options.notify();
            }
            return;
        }

        if (resuming || quitting) {
            resuming = false;
            quitting = true;
            queueMicrotask(() => {
                if (event.defaultPrevented) cancel();
            });
            return;
        }

        event.preventDefault();
        if (pending) return pending;

        // Assign the pending attempt before user code can request Quit again.
        pending = Promise.resolve()
            .then(async () => {
                await options.waitForClose();
                if (disposed || !(await options.check()) || disposed) return;
                notified = true;
                await options.notify();
                if (disposed) return;
                resuming = true;
                options.quit();
            })
            .catch((error: unknown) => {
                cancel();
                options.logger.error?.(
                    "Application quit attempt failed",
                    error,
                );
            })
            .finally(() => {
                pending = undefined;
            });
        return pending;
    };

    return {
        beforeQuit,
        isQuitting: (): boolean => quitting,
        isPending: (): boolean => pending !== undefined,
        cancel,
        /** Prevents an outstanding permission check from resuming after disposal. */
        dispose(): void {
            disposed = true;
            cancel();
        },
    };
}
