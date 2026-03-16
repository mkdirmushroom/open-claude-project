/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Terminal App - Choose which terminal to use */
  "terminal": "iterm" | "terminal" | "warp" | "alacritty" | "kitty",
  /** Group by Time - Group projects by time (Today, This Week, Earlier) */
  "groupByTime": boolean,
  /** Favorites First - Always show favorited projects at the top */
  "showFavoritesFirst": boolean,
  /** Language / 语言 - Choose display language / 选择显示语言 */
  "language": "zh" | "en",
  /** Default Permission Preset - Auto-apply this preset to new projects without permissions */
  "defaultPreset": "" | "strict" | "standard" | "permissive",
  /** Anthropic Base URL - Custom API base URL (e.g., https://api.kimi.com/coding/) - Optional */
  "anthropicBaseUrl"?: string,
  /** Anthropic API Key - Custom API key - Optional (will be injected as ANTHROPIC_API_KEY) */
  "anthropicApiKey"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `open-project` command */
  export type OpenProject = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `open-project` command */
  export type OpenProject = {}
}

