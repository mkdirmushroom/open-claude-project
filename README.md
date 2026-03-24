# Open Claude Code Project

English | [中文](README.zh-CN.md)

A [Raycast](https://raycast.com) extension to quickly open recent [Claude Code](https://claude.ai/code) projects in your favorite terminal.

## Features

- **Quick Access** - Browse and open recent Claude Code projects with a single keystroke
- **Multiple Terminals** - Support for iTerm, Terminal.app, Warp, Alacritty, Kitty, and Ghostty
- **Favorites** - Pin frequently used projects to the top
- **Time Grouping** - Projects organized by Today, This Week, and Earlier
- **Quick Shortcuts** - `Cmd+1/2/3` to instantly open top 3 projects
- **Permission Management** - Per-project Claude Code permission presets and a visual rule editor
- **IDE Integration** - Open projects directly in VS Code, Cursor, Zed, or WebStorm
- **Session Picker** - Browse and resume specific sessions with AI-generated titles
- **Project Cleanup** - Remove stale project entries with one click
- **Batch Permissions** - Apply a permission preset to all projects at once
- **Bilingual** - English and Chinese interface

## Installation

### From Raycast Store (Recommended)

Search for "Open Claude Code Project" in Raycast Store.

### Manual Installation

```bash
git clone https://github.com/mkdirmushroom/open-claude-project.git
cd open-claude-project
npm install
npm run build
```

Then import in Raycast: Search "Import Extension" and select this folder.

## Usage

1. Open Raycast and search for "Open Claude Code Project"
2. Select a project from the list
3. Press `Enter` to continue last session, or `Cmd+N` for a new session

## Permission Management

Manage Claude Code's `settings.local.json` per project directly from Raycast.

**Quick Presets** (`Cmd+Shift+P`):

| Preset | Description |
|--------|-------------|
| Strict | Read-only + sensitive file protection |
| Standard | Auto-accept edits + common commands (git, npm, etc.) |
| Permissive | Auto-accept edits + all commands |
| Dangerously Skip Permissions | Bypass all permission checks (containers/VMs only) |

All presets include deny rules for dangerous operations (`rm -rf`, `sudo`, `git push --force`, `.env` files, private keys).

**Custom Editor** — Select "Custom Permissions" from the preset menu to open a visual rule editor with 40+ categorized rules. You can also add arbitrary custom rules via `Cmd+N`.

**Default Preset** — Set a default preset in preferences to auto-apply to new projects.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Continue last session (`claude -c`) |
| `Cmd+N` | New session (`claude`) |
| `Cmd+D` | Toggle favorite |
| `Cmd+1/2/3` | Quick open top 3 projects |
| `Cmd+Shift+S` | Select session to resume |
| `Cmd+Shift+I` | Open in IDE |
| `Cmd+Shift+P` | Permission settings |
| `Cmd+Shift+F` | Show in Finder |
| `Cmd+Shift+C` | Copy path |
| `Cmd+R` | Refresh list |
| `Cmd+,` | Open preferences |

## Preferences

| Setting | Description | Default |
|---------|-------------|---------|
| Terminal App | Choose your preferred terminal (iTerm, Terminal, Warp, Alacritty, Kitty, Ghostty) | iTerm |
| Group by Time | Organize projects by time periods | Enabled |
| Favorites First | Show favorited projects at the top | Enabled |
| Language | Interface language (English/中文) | English |
| Default Permission Preset | Auto-apply to new projects | None |
| IDE App | IDE for opening projects (VS Code, Cursor, Zed, WebStorm) | None |

## How It Works

This extension reads Claude Code's project data from `~/.claude/projects/` directory. It parses session files to determine the actual project paths and displays them sorted by last modification time.

## Requirements

- [Raycast](https://raycast.com)
- [Claude Code](https://claude.ai/code) installed and used at least once
- A supported terminal app (iTerm, Terminal, Warp, Alacritty, Kitty, or Ghostty)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Raycast API](https://developers.raycast.com)
- For use with [Claude Code](https://claude.ai/code) by Anthropic
