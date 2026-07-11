/*
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { platform } from "node:os";
import { Injectable } from "@mariodebono/di";
import {
    app,
    type BrowserWindow,
    dialog,
    Menu,
    type MessageBoxOptions,
    type MessageBoxReturnValue,
    type NativeImage,
    type OpenDialogOptions,
    type OpenDialogReturnValue,
    shell,
} from "electron";
// biome-ignore lint/style/useImportType: Used for runtime DI resolution.
import { CloseBehaviorService } from "./close-behavior.service.js";
// biome-ignore lint/style/useImportType: Used for runtime DI resolution.
import { WindowManagerService } from "./window-manager.js";

type AppPathName =
    | "home"
    | "appData"
    | "assets"
    | "userData"
    | "sessionData"
    | "temp"
    | "exe"
    | "module"
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos"
    | "recent"
    | "logs"
    | "crashDumps";

/** Thin facade around Electron app-level APIs used by application services/modules. */
@Injectable()
export class ElectronAppService {
    constructor(
        private readonly windowManager: WindowManagerService,
        private readonly closeBehaviorService: CloseBehaviorService,
    ) {}

    /** Return the current main window if one is tracked. */
    get MainWindow() {
        return this.windowManager.getMainWindow();
    }

    /**
     * Return the current application path.
     *
     * @returns The current Electron application path.
     */
    getAppPath(): string {
        return app.getAppPath();
    }

    /**
     * Return the preferred system language order.
     *
     * @returns The preferred system language list.
     */
    getPreferredSystemLanguages(): string[] {
        return app.getPreferredSystemLanguages();
    }

    /**
     * Return the current application locale.
     *
     * @returns The current locale.
     */
    getLocale(): string {
        return app.getLocale();
    }

    /**
     * Read a platform-specific application path.
     *
     * @param {AppPathName} name - Application path name to resolve.
     * @returns The resolved application path.
     */
    getPath(name: AppPathName): string {
        return app.getPath(name);
    }

    /**
     * Exit the application immediately with an optional code.
     *
     * @param {number} [code] - Exit code to use when terminating the app.
     */
    exit(code?: number): void {
        app.exit(code);
    }

    /** Request a normal application quit. */
    quit(): void {
        app.quit();
    }

    /**
     * Persist the hide-on-close preference.
     *
     * @param {boolean} value - True to hide on close, false to quit normally.
     */
    setHideOnClose(value: boolean): void {
        this.closeBehaviorService.setHideOnClose(value);
    }

    /**
     * Return the current hide-on-close preference.
     *
     * @returns Whether the app hides instead of quitting on close.
     */
    getHideOnClose(): boolean {
        return this.closeBehaviorService.getHideOnClose();
    }

    /**
     * Set the native application menu.
     *
     * @param {Menu | null} menu - Menu to install, or null to clear it.
     */
    setApplicationMenu(menu: Menu | null): void {
        Menu.setApplicationMenu(menu);
    }

    /** Clear the native application menu. */
    clearApplicationMenu(): void {
        Menu.setApplicationMenu(null);
    }

    /**
     * Open a path with the operating system.
     *
     * @param {string} path - Path to open.
     * @returns A promise that resolves to an empty string on success or an error message.
     */
    openPath(path: string): Promise<string> {
        return shell.openPath(path);
    }

    /**
     * Reveal a path in the operating system file manager.
     *
     * @param {string} path - Path to reveal.
     */
    revealPath(path: string): void {
        shell.showItemInFolder(path);
    }

    /**
     * Open an external URL in the default browser.
     *
     * @param {string} url - URL to open.
     */
    openExternal(url: string): Promise<void> {
        return shell.openExternal(url);
    }

    /**
     * Show a message box, using the main window when one is available.
     *
     * @param {MessageBoxOptions} options - Message box configuration.
     * @returns The message box result.
     */
    async showMessageBox(
        options: MessageBoxOptions,
    ): Promise<MessageBoxReturnValue> {
        const mainWindow = this.windowManager.getMainWindow();

        return mainWindow
            ? await dialog.showMessageBox(mainWindow, options)
            : await dialog.showMessageBox(options);
    }

    /**
     * Show an open-file dialog, using the main window when one is available.
     *
     * @param {OpenDialogOptions} options - Open dialog configuration.
     * @returns The open dialog result.
     */
    async showOpenDialog(
        options: OpenDialogOptions,
    ): Promise<OpenDialogReturnValue> {
        const mainWindow = this.windowManager.getMainWindow();

        return mainWindow
            ? await dialog.showOpenDialog(mainWindow, options)
            : await dialog.showOpenDialog(options);
    }

    /** Hide the dock on macOS. */
    hideDock(): void {
        app.dock?.hide();
    }

    /** Show the dock on macOS. */
    async showDock(): Promise<void> {
        await app.dock?.show();
    }

    /**
     * Set the dock icon on macOS.
     *
     * @param {NativeImage | string} icon - Icon image or path to apply.
     */
    setDockIcon(icon: NativeImage | string): void {
        app.dock?.setIcon(icon);
    }

    /**
     * Register a listener for the app activate event.
     *
     * @param {() => void} listener - Listener to invoke on activate.
     */
    onActivate(listener: () => void): void {
        app.on("activate", listener);
    }

    /**
     * Remove a listener for the app activate event.
     *
     * @param {() => void} listener - Listener to remove.
     */
    offActivate(listener: () => void): void {
        app.removeListener("activate", listener);
    }

    /**
     * Show a popup menu in the given window.
     *
     * @param {BrowserWindow} window - Window used to anchor the popup.
     * @param {Menu} menu - Menu to display.
     * @param {number | undefined} x - Optional popup x-coordinate.
     * @param {number | undefined} y - Optional popup y-coordinate.
     */
    showMenu(
        window: BrowserWindow,
        menu: Menu,
        x: number | undefined,
        y: number | undefined,
    ) {
        menu.popup({
            window,
            x,
            y,
        });
    }

    /**
     * Set the application display name.
     *
     * @param {string} name - Application name to set.
     */
    setName(name: string) {
        app.setName(name);
    }

    /**
     * Sets the theme for window controls on supported platforms (windows & linux).
     *
     * @param {string} symbolColor - The color of the window control symbol, #RRGGBBAA.
     * @param {string} color - The color of the window control background, #RRGGBBAA.
     */
    setTheme(symbolColor: string, color: string): void {
        if (platform() === "darwin") {
            return;
        }
        // const symbolColor = {
        //     light: "#000000b3",
        //     dark: "#fcfcfcb3",
        // };
        // const colors = {
        //     light: {
        //         symbolColor: "#000000b3",
        //         color: "#ffffff00",
        //     },
        //     dark: {
        //         symbolColor: "#fcfcfcb3",
        //         color: "#00000000",
        //     },
        // };

        this.MainWindow?.setTitleBarOverlay?.({
            color,
            symbolColor,
        });
    }
}
