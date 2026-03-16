# Open Claude Code Project

[English](README.md) | 中文

一个 [Raycast](https://raycast.com) 扩展，用于快速打开最近使用的 [Claude Code](https://claude.ai/code) 项目。

## 功能特性

- **快速访问** - 一键浏览和打开最近的 Claude Code 项目
- **多终端支持** - 支持 iTerm、Terminal.app、Warp、Alacritty 和 Kitty
- **收藏功能** - 将常用项目置顶显示
- **时间分组** - 按今天、本周、更早分组显示项目
- **快捷键** - `Cmd+1/2/3` 快速打开前 3 个项目
- **权限管理** - 按项目设置 Claude Code 权限预设，内置可视化规则编辑器
- **双语界面** - 支持中英文切换

## 安装方法

### 从 Raycast Store 安装（推荐）

在 Raycast Store 中搜索 "Open Claude Code Project"。

### 手动安装

```bash
git clone https://github.com/mkdirmushroom/open-claude-project.git
cd open-claude-project
npm install
npm run build
```

然后在 Raycast 中导入：搜索 "Import Extension" 并选择此文件夹。

## 使用方法

1. 打开 Raycast 并搜索 "Open Claude Code Project"
2. 从列表中选择一个项目
3. 按 `Enter` 继续上次会话，或按 `Cmd+N` 新建会话

## 权限管理

直接在 Raycast 中管理各项目的 Claude Code `settings.local.json`。

**快速预设** (`Cmd+Shift+P`)：

| 预设 | 说明 |
|------|------|
| 严格 | 只读 + 敏感文件保护 |
| 标准 | 自动接受编辑 + 常用命令（git、npm 等） |
| 宽松 | 自动接受编辑 + 所有命令 |

所有预设均包含危险操作的拒绝规则（`rm -rf`、`sudo`、`git push --force`、`.env` 文件、私钥等）。

**自定义编辑器** — 在预设菜单中选择「自定义权限」打开可视化规则编辑器，内含 40+ 条分类规则。也可通过 `Cmd+N` 添加任意自定义规则。

**默认预设** — 在偏好设置中设定默认预设，自动应用到新项目。

## 快捷键

| 快捷键 | 操作 |
|--------|------|
| `Enter` | 继续上次会话 (`claude -c`) |
| `Cmd+N` | 新建会话 (`claude`) |
| `Cmd+D` | 收藏/取消收藏 |
| `Cmd+1/2/3` | 快速打开前 3 个项目 |
| `Cmd+Shift+P` | 权限设置 |
| `Cmd+Shift+F` | 在 Finder 中显示 |
| `Cmd+Shift+C` | 复制路径 |
| `Cmd+R` | 刷新列表 |
| `Cmd+,` | 打开偏好设置 |

## 偏好设置

| 设置 | 说明 | 默认值 |
|------|------|--------|
| 终端应用 | 选择你喜欢的终端 | iTerm |
| 按时间分组 | 按时间段组织项目 | 开启 |
| 收藏优先 | 将收藏的项目显示在顶部 | 开启 |
| 语言 | 界面语言（English/中文） | English |
| 默认权限预设 | 自动应用到新项目 | 无 |

## 工作原理

此扩展从 `~/.claude/projects/` 目录读取 Claude Code 的项目数据，解析会话文件以确定实际项目路径，并按最后修改时间排序显示。

## 系统要求

- [Raycast](https://raycast.com)
- [Claude Code](https://claude.ai/code) 已安装并至少使用过一次
- 支持的终端应用（iTerm、Terminal、Warp、Alacritty 或 Kitty）
