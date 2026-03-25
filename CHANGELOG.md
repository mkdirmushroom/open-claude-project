# Changelog

## [1.3.2] - 2026-03-25

### Added
- **Auto Mode** preset — AI classifier automatically allows safe operations and blocks risky ones (`defaultMode: "auto"`)
- Auto mode option in PermissionEditor mode dropdown

### Fixed
- Ghostty: use native AppleScript API (1.3+) with `command` property instead of keystroke simulation
- Ghostty: cold start reuses default window instead of creating an extra empty window
- Warp: cold start reuses default window to avoid double-window
- Temp scripts: secure permissions (0o700) + self-delete after execution
- Alacritty: use `spawnSync("pbcopy", [], {input})` to eliminate shell injection
- Cleanup confirm dialog: use future-tense message instead of past-tense

### Improved
- Confirm dialog when switching presets with user-added rules (keep or discard)
- `writeTempScript()` helper shared by Warp
- `openInIde()` simplified with `KNOWN_IDES` Set
- `getQuickShortcut()` simplified with `QUICK_KEYS` array lookup

## [1.3.1] - 2026-03-24

### Added
- **Dangerously Skip Permissions** preset — bypasses all permission checks (`defaultMode: "bypassPermissions"`), shown in red, for containers/VMs only

## [1.3.0] - 2026-03-23

### Added
- Session titles: show AI-generated conversation summaries (like `claude --resume`) instead of plain timestamps
- Filter out ghost sessions (file-history-snapshot only files) from session picker
- Async session loading with `useCachedPromise` and loading indicator
- `_preset` metadata for stable preset detection across sessions
- `readSettings()` / `resolveDefaultMode()` shared helpers

### Fixed
- **Ghostty/Warp cascade bug**: AppleScript keystroke leaked to Raycast when terminal lost focus, causing multiple projects to open simultaneously. Replaced with temp script + CLI launch
- **Kitty PATH issue**: `bash -c` couldn't find `claude`; switched to `zsh -lc` with `source ~/.zshrc`
- **Ghostty PATH issue**: `#!/bin/zsh -l` is non-interactive and doesn't source `~/.zshrc` where `~/.local/bin` is added to PATH
- **`defaultMode` placement**: was written at JSON top level instead of inside `permissions` object, causing Claude Code to ignore permission modes
- **Preset detection instability**: "don't ask again" rules from Claude Code caused presets to show as "custom"; now uses `_preset` metadata instead of rule matching
- **PermissionEditor clears `_preset`**: manually editing rules correctly transitions to "custom"
- Removed duplicate `configureApi` action (identical to `openPreferences`)
- Removed redundant `claudeProjectsDir` aliases
- TOCTOU: removed `existsSync` before idempotent `saveSettings`

### Improved
- Extracted `grepJsonl()` helper for session file scanning
- `writePermissionPreset` / `saveSettings` / `resetPermissions` all use `getSettingsPath()` and `readSettings()`
- Replaced stringly-typed i18n key construction with `getPresetDisplay()`
- All 6 terminals now use reliable launch methods (no more `keystroke` for command input)

## [1.2.0] - 2026-03-17

### Added
- Ghostty terminal support
- IDE integration: open projects in VS Code, Cursor, Zed, or WebStorm (`Cmd+Shift+I`)
- Session picker: browse and resume specific sessions (`Cmd+Shift+S`)
- Stale project cleanup with confirmation dialog
- Batch permission apply across all projects
- Path-based search in project list

### Fixed
- Missing credentials/secret deny rules in presets
- Session ID command injection vulnerability
- Default terminal case using unescaped AppleScript string
- Kitty terminal not injecting API environment variables
- Hardcoded English "(latest)" label in session picker

### Improved
- Extracted `shellEscape()` helper to deduplicate shell escaping logic
- Pre-computed preset comparison data for faster detection
- Converted favorites to Set for O(1) lookup
- Unified preset action blocks with `.map()` to reduce duplication
- Added `TerminalApp` union type for type-safe terminal handling

## [1.1.0] - 2026-03-16

### Added
- Per-project permission management (`Cmd+Shift+P`)
- Three built-in presets: Strict, Standard, Permissive
- Visual rule editor with 40+ categorized rules
- Custom rule add/delete support
- Default preset preference for auto-applying to new projects
- Deny rules for dangerous operations (rm -rf, sudo, git push --force, .env, private keys)
- Custom Anthropic Base URL and API Key preferences

## [Initial Version] - 2025-01-14

- Quick access to recent Claude Code projects
- Support for multiple terminals (iTerm, Terminal, Warp, Alacritty, Kitty)
- Favorites feature to pin frequently used projects
- Time-based grouping (Today, This Week, Earlier)
- Quick shortcuts (Cmd+1/2/3) for top 3 projects
- Bilingual interface (English/Chinese)
