/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
// biome-ignore lint/style/useImportType: Used for runtime DI resolution.
import { Injectable, Logger } from "@mariodebono/di";
import {
    app,
    BrowserWindow,
    type BrowserWindowConstructorOptions,
    type WebContents,
    type WebFrameMain,
} from "electron";
import { getInternalPreloadPath } from "./internal/preload-path.js";
/** Base path used when resolving relative renderer URLs. */
export type WindowBasePath = string | (() => string | Promise<string>);

/** Options used to create an Electron BrowserWindow. */
export type CreateWindowOptions = Omit<
    BrowserWindowConstructorOptions,
    "webPreferences"
> & {
    webPreferences?: Omit<
        NonNullable<BrowserWindowConstructorOptions["webPreferences"]>,
        "preload"
    >;
    url?: string;
    basePath?: WindowBasePath;
    startMode?: "normal" | "minimized" | "hidden";
};

/** Platform service responsible for creating and tracking Electron BrowserWindows. */
@Injectable()
export class WindowManagerService {
    private readonly windows = new Set<BrowserWindow>();
    private readonly trustedRendererLocations = new Map<WebContents, string>();
    private mainWindow?: BrowserWindow;

    protected readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.withContext(WindowManagerService.name);
    }

    /**
     * Create a new BrowserWindow with the provided options and resolved URL.
     *
     * @param {CreateWindowOptions} options - BrowserWindow options plus URL/base-path settings.
     */
    async createWindow(options: CreateWindowOptions): Promise<BrowserWindow> {
        await app.whenReady();

        const { url = "/", basePath, ...browserWindowOptions } = options;
        const window = new BrowserWindow({
            ...browserWindowOptions,
            webPreferences: {
                ...browserWindowOptions.webPreferences,
                preload: getInternalPreloadPath(),
            },
        });
        const resolvedUrl = await this.resolveWindowUrl(url, basePath);
        const trustedRendererLocation = this.isAbsoluteUrl(resolvedUrl)
            ? resolvedUrl
            : pathToFileURL(path.resolve(resolvedUrl)).href;

        // Trust the configured destination before navigation starts because the
        // renderer can invoke IPC while loadURL/loadFile is still in progress.
        this.trackWindow(window, trustedRendererLocation);

        if (this.isAbsoluteUrl(resolvedUrl)) {
            this.logger.debug(`Loading URL: ${resolvedUrl}`);
            await window.loadURL(resolvedUrl);
        } else {
            this.logger.debug(`Loading local file: ${resolvedUrl}`);
            await window.loadFile(resolvedUrl);
        }

        const loadedRendererLocation = window.webContents.getURL();
        if (loadedRendererLocation) {
            this.trustedRendererLocations.set(
                window.webContents,
                loadedRendererLocation,
            );
        }

        return window;
    }

    /**
     * Create and track the main application window.
     *
     * @param {CreateWindowOptions} options - BrowserWindow options plus URL/base-path settings.
     */
    async createMainWindow(
        options: CreateWindowOptions,
    ): Promise<BrowserWindow> {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            return this.mainWindow;
        }

        this.mainWindow = await this.createWindow({ ...options, show: false });
        switch (options.startMode || "normal") {
            case "minimized":
                this.mainWindow.minimize();
                break;
            case "hidden":
                break;
            default:
                this.mainWindow.show();
                break;
        }

        return this.mainWindow;
    }

    /** Returns the tracked main window if it exists and is not destroyed. */
    getMainWindow(): BrowserWindow | undefined {
        if (this.mainWindow?.isDestroyed()) {
            this.mainWindow = undefined;
        }

        return this.mainWindow;
    }

    /** Reveal the main window and focus the application on supported platforms. */
    revealMainWindow(): BrowserWindow | undefined {
        const mainWindow = this.getMainWindow();
        if (!mainWindow) {
            return undefined;
        }

        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }

        // Mirror the legacy launcher behavior: always show the main window again
        // when explicitly revealing it, even if Electron still considers it visible.
        mainWindow.show();

        if (process.platform === "darwin") {
            app.dock?.show();
            app.show?.();
        }

        app.focus?.();
        mainWindow.focus();

        return mainWindow;
    }

    /** Closes all tracked windows. */
    closeAll(): void {
        for (const window of [...this.windows]) {
            if (!window.isDestroyed()) {
                window.close();
            }
        }
    }

    /** Returns true when an IPC sender is a managed main frame at its configured renderer location. */
    isTrustedIpcSender(
        sender: WebContents,
        senderFrame: WebFrameMain | null,
    ): boolean {
        if (!senderFrame || senderFrame !== sender.mainFrame) {
            return false;
        }

        const trustedLocation = this.trustedRendererLocations.get(sender);
        if (!trustedLocation) {
            return false;
        }

        return isSameRendererLocation(senderFrame.url, trustedLocation);
    }

    /** Track a window so it can be cleaned up when closed. */
    private trackWindow(window: BrowserWindow, rendererLocation: string): void {
        this.windows.add(window);
        this.trustedRendererLocations.set(window.webContents, rendererLocation);
        window.once("closed", () => {
            this.windows.delete(window);
            this.trustedRendererLocations.delete(window.webContents);
            if (window === this.mainWindow) {
                this.mainWindow = undefined;
            }
        });
    }

    /** Resolve the renderer URL against an optional base path. */
    private async resolveWindowUrl(
        url: string,
        basePath?: WindowBasePath,
    ): Promise<string> {
        if (this.isAbsoluteUrl(url)) {
            return url;
        }

        if (basePath) {
            const resolvedBasePath =
                typeof basePath === "function" ? await basePath() : basePath;

            return new URL(url, resolvedBasePath).href;
        }

        return url;
    }

    /** Return true when the provided value is an absolute http/file URL. */
    private isAbsoluteUrl(url: string): boolean {
        return /^(https?:|file:)/.test(url);
    }
}

function isSameRendererLocation(
    currentLocation: string,
    trustedLocation: string,
): boolean {
    try {
        const currentUrl = new URL(currentLocation);
        const trustedUrl = new URL(trustedLocation);

        if (trustedUrl.protocol === "file:") {
            return (
                currentUrl.protocol === "file:" &&
                currentUrl.host === trustedUrl.host &&
                currentUrl.pathname === trustedUrl.pathname
            );
        }

        return currentUrl.origin === trustedUrl.origin;
    } catch {
        return currentLocation === trustedLocation;
    }
}
