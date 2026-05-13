/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// biome-ignore lint/style/useImportType: Used for runtime DI resolution.
import { Injectable, Logger } from "@mariodebono/di";
import {
    app,
    BrowserWindow,
    type BrowserWindowConstructorOptions,
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

        if (this.isAbsoluteUrl(resolvedUrl)) {
            this.logger.debug(`Loading URL: ${resolvedUrl}`);
            await window.loadURL(resolvedUrl);
        } else {
            this.logger.debug(`Loading local file: ${resolvedUrl}`);
            await window.loadFile(resolvedUrl);
        }
        this.trackWindow(window);

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

    /** Track a window so it can be cleaned up when closed. */
    private trackWindow(window: BrowserWindow): void {
        this.windows.add(window);
        window.once("closed", () => {
            this.windows.delete(window);
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
