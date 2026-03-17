# Changelog

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
