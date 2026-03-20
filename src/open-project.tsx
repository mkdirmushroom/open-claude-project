import {
  Action,
  ActionPanel,
  Alert,
  confirmAlert,
  Form,
  List,
  showToast,
  Toast,
  Icon,
  Color,
  getPreferenceValues,
  openExtensionPreferences,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise, useLocalStorage } from "@raycast/utils";
import { useState } from "react";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ============================================================================
// Constants
// ============================================================================

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

function shellEscape(str: string): string {
  return str.replace(/'/g, `'"'"'`);
}

const BUFFER_SIZE = 4096;
const MAX_SESSION_FILES_TO_CHECK = 3;
const MAX_LINES_TO_CHECK = 10;
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;
const DAYS_IN_WEEK = 7;

const DENY_DANGEROUS = [
  "Bash(rm -rf *)",
  "Bash(sudo *)",
  "Bash(git push --force*)",
  "Bash(git reset --hard*)",
  "Read(**/.env)",
  "Read(**/.env.*)",
  "Read(**/*.pem)",
  "Read(**/*.key)",
  "Read(**/*_rsa)",
  "Read(**/*credentials*)",
  "Read(**/*secret*)",
];

interface PresetConfig {
  defaultMode?: string;
  allow: string[];
  deny: string[];
}

const PERMISSION_PRESETS: Record<string, PresetConfig> = {
  strict: {
    allow: ["Glob", "Grep", "Read"],
    deny: DENY_DANGEROUS,
  },
  standard: {
    defaultMode: "acceptEdits",
    allow: [
      "Bash(echo:*)",
      "Bash(gh:*)",
      "Bash(git:*)",
      "Bash(ls:*)",
      "Bash(node:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(tree:*)",
      "Edit",
      "Glob",
      "Grep",
      "Read",
      "WebSearch",
      "Write",
    ],
    deny: DENY_DANGEROUS,
  },
  permissive: {
    defaultMode: "acceptEdits",
    allow: [
      "Bash",
      "Edit",
      "Glob",
      "Grep",
      "Read",
      "WebFetch",
      "WebSearch",
      "Write",
    ],
    deny: DENY_DANGEROUS,
  },
};

interface CatalogRule {
  pattern: string;
  type: "allow" | "deny";
  section: string;
  zh: string;
  en: string;
}

const CATALOG_SECTIONS = [
  { key: "fileOps", zh: "文件操作", en: "File Operations" },
  { key: "vcs", zh: "版本控制", en: "Version Control" },
  { key: "pkgMgmt", zh: "包管理", en: "Package Management" },
  { key: "runtime", zh: "运行时", en: "Runtimes" },
  { key: "system", zh: "系统工具", en: "System Tools" },
  { key: "bashAll", zh: "全部 Bash", en: "All Bash" },
  { key: "network", zh: "网络", en: "Network" },
  { key: "safety", zh: "安全防护 (Deny)", en: "Safety (Deny)" },
];

const MODE_OPTIONS = [
  {
    value: "default",
    zh: "默认 — 每次操作都需确认",
    en: "Default — confirm every operation",
  },
  {
    value: "acceptEdits",
    zh: "自动接受编辑 — 文件编辑自动通过",
    en: "Auto-accept edits — file changes auto-approved",
  },
  {
    value: "plan",
    zh: "计划模式 — 只分析不修改",
    en: "Plan mode — analyze only, no changes",
  },
  {
    value: "bypassPermissions",
    zh: "跳过权限 — 仅限容器/VM",
    en: "Bypass — containers/VMs only",
  },
];

const PERMISSION_CATALOG: CatalogRule[] = [
  // File Operations
  {
    pattern: "Read",
    type: "allow",
    section: "fileOps",
    zh: "读取文件",
    en: "Read files",
  },
  {
    pattern: "Write",
    type: "allow",
    section: "fileOps",
    zh: "写入文件",
    en: "Write files",
  },
  {
    pattern: "Edit",
    type: "allow",
    section: "fileOps",
    zh: "编辑文件",
    en: "Edit files",
  },
  {
    pattern: "Glob",
    type: "allow",
    section: "fileOps",
    zh: "按模式搜索文件",
    en: "Search files by pattern",
  },
  {
    pattern: "Grep",
    type: "allow",
    section: "fileOps",
    zh: "搜索文件内容",
    en: "Search file contents",
  },
  {
    pattern: "NotebookEdit",
    type: "allow",
    section: "fileOps",
    zh: "编辑 Jupyter Notebook",
    en: "Edit Jupyter Notebooks",
  },
  // Version Control
  {
    pattern: "Bash(git:*)",
    type: "allow",
    section: "vcs",
    zh: "Git 操作",
    en: "Git operations",
  },
  {
    pattern: "Bash(gh:*)",
    type: "allow",
    section: "vcs",
    zh: "GitHub CLI",
    en: "GitHub CLI",
  },
  // Package Management
  {
    pattern: "Bash(npm:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "npm 命令",
    en: "npm commands",
  },
  {
    pattern: "Bash(npx:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "npx 执行",
    en: "npx execution",
  },
  {
    pattern: "Bash(yarn:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "Yarn 命令",
    en: "Yarn commands",
  },
  {
    pattern: "Bash(pnpm:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "pnpm 命令",
    en: "pnpm commands",
  },
  {
    pattern: "Bash(bun:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "Bun 命令",
    en: "Bun commands",
  },
  {
    pattern: "Bash(pip:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "pip 包管理",
    en: "pip packages",
  },
  {
    pattern: "Bash(uv:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "uv (Python)",
    en: "uv (Python)",
  },
  {
    pattern: "Bash(cargo:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "Cargo (Rust)",
    en: "Cargo (Rust)",
  },
  {
    pattern: "Bash(brew:*)",
    type: "allow",
    section: "pkgMgmt",
    zh: "Homebrew",
    en: "Homebrew",
  },
  // Runtimes
  {
    pattern: "Bash(node:*)",
    type: "allow",
    section: "runtime",
    zh: "Node.js",
    en: "Node.js",
  },
  {
    pattern: "Bash(python:*)",
    type: "allow",
    section: "runtime",
    zh: "Python",
    en: "Python",
  },
  {
    pattern: "Bash(python3:*)",
    type: "allow",
    section: "runtime",
    zh: "Python 3",
    en: "Python 3",
  },
  {
    pattern: "Bash(swift:*)",
    type: "allow",
    section: "runtime",
    zh: "Swift",
    en: "Swift",
  },
  {
    pattern: "Bash(go:*)",
    type: "allow",
    section: "runtime",
    zh: "Go",
    en: "Go",
  },
  {
    pattern: "Bash(ruby:*)",
    type: "allow",
    section: "runtime",
    zh: "Ruby",
    en: "Ruby",
  },
  {
    pattern: "Bash(java:*)",
    type: "allow",
    section: "runtime",
    zh: "Java",
    en: "Java",
  },
  {
    pattern: "Bash(javac:*)",
    type: "allow",
    section: "runtime",
    zh: "Java 编译器",
    en: "Java compiler",
  },
  // System Tools
  {
    pattern: "Bash(ls:*)",
    type: "allow",
    section: "system",
    zh: "列出目录",
    en: "List directory",
  },
  {
    pattern: "Bash(tree:*)",
    type: "allow",
    section: "system",
    zh: "目录树",
    en: "Directory tree",
  },
  {
    pattern: "Bash(echo:*)",
    type: "allow",
    section: "system",
    zh: "echo 输出",
    en: "Echo output",
  },
  {
    pattern: "Bash(cat:*)",
    type: "allow",
    section: "system",
    zh: "查看文件内容",
    en: "View file content",
  },
  {
    pattern: "Bash(head:*)",
    type: "allow",
    section: "system",
    zh: "查看文件头部",
    en: "View file head",
  },
  {
    pattern: "Bash(tail:*)",
    type: "allow",
    section: "system",
    zh: "查看文件尾部",
    en: "View file tail",
  },
  {
    pattern: "Bash(wc:*)",
    type: "allow",
    section: "system",
    zh: "统计字数/行数",
    en: "Word/line count",
  },
  {
    pattern: "Bash(which:*)",
    type: "allow",
    section: "system",
    zh: "查找命令路径",
    en: "Find command path",
  },
  {
    pattern: "Bash(diff:*)",
    type: "allow",
    section: "system",
    zh: "文件差异比较",
    en: "File diff",
  },
  {
    pattern: "Bash(mkdir:*)",
    type: "allow",
    section: "system",
    zh: "创建目录",
    en: "Create directory",
  },
  {
    pattern: "Bash(cp:*)",
    type: "allow",
    section: "system",
    zh: "复制文件",
    en: "Copy files",
  },
  {
    pattern: "Bash(mv:*)",
    type: "allow",
    section: "system",
    zh: "移动/重命名文件",
    en: "Move/rename files",
  },
  {
    pattern: "Bash(date:*)",
    type: "allow",
    section: "system",
    zh: "日期时间",
    en: "Date/time",
  },
  {
    pattern: "Bash(make:*)",
    type: "allow",
    section: "system",
    zh: "Make 构建",
    en: "Make build",
  },
  {
    pattern: "Bash(docker:*)",
    type: "allow",
    section: "system",
    zh: "Docker 容器",
    en: "Docker containers",
  },
  {
    pattern: "Bash(kubectl:*)",
    type: "allow",
    section: "system",
    zh: "Kubernetes CLI",
    en: "Kubernetes CLI",
  },
  {
    pattern: "Bash(curl:*)",
    type: "allow",
    section: "system",
    zh: "cURL 请求",
    en: "cURL requests",
  },
  // All Bash
  {
    pattern: "Bash",
    type: "allow",
    section: "bashAll",
    zh: "全部 Bash 命令",
    en: "All Bash commands",
  },
  // Network
  {
    pattern: "WebSearch",
    type: "allow",
    section: "network",
    zh: "网络搜索",
    en: "Web search",
  },
  {
    pattern: "WebFetch",
    type: "allow",
    section: "network",
    zh: "网络请求",
    en: "Web fetch",
  },
  // Safety (Deny)
  {
    pattern: "Bash(rm -rf *)",
    type: "deny",
    section: "safety",
    zh: "禁止递归删除",
    en: "Block recursive delete",
  },
  {
    pattern: "Bash(sudo *)",
    type: "deny",
    section: "safety",
    zh: "禁止 sudo 提权",
    en: "Block sudo",
  },
  {
    pattern: "Bash(git push --force*)",
    type: "deny",
    section: "safety",
    zh: "禁止强制推送",
    en: "Block force push",
  },
  {
    pattern: "Bash(git reset --hard*)",
    type: "deny",
    section: "safety",
    zh: "禁止硬重置",
    en: "Block hard reset",
  },
  {
    pattern: "Read(**/.env)",
    type: "deny",
    section: "safety",
    zh: "禁止读取 .env",
    en: "Block reading .env",
  },
  {
    pattern: "Read(**/.env.*)",
    type: "deny",
    section: "safety",
    zh: "禁止读取 .env.*",
    en: "Block reading .env.*",
  },
  {
    pattern: "Read(**/*.pem)",
    type: "deny",
    section: "safety",
    zh: "禁止读取证书",
    en: "Block reading certs",
  },
  {
    pattern: "Read(**/*.key)",
    type: "deny",
    section: "safety",
    zh: "禁止读取私钥",
    en: "Block reading keys",
  },
  {
    pattern: "Read(**/*_rsa)",
    type: "deny",
    section: "safety",
    zh: "禁止读取 RSA 密钥",
    en: "Block reading RSA keys",
  },
  {
    pattern: "Read(**/*credentials*)",
    type: "deny",
    section: "safety",
    zh: "禁止读取凭证文件",
    en: "Block reading credentials",
  },
  {
    pattern: "Read(**/*secret*)",
    type: "deny",
    section: "safety",
    zh: "禁止读取密钥文件",
    en: "Block reading secrets",
  },
];

// ============================================================================
// i18n - Internationalization
// ============================================================================

const i18n = {
  zh: {
    // Time
    justNow: "刚刚",
    minutesAgo: (n: number) => `${n} 分钟前`,
    hoursAgo: (n: number) => `${n} 小时前`,
    daysAgo: (n: number) => `${n} 天前`,
    // Groups
    favorites: "收藏",
    today: "今天",
    thisWeek: "本周",
    earlier: "更早",
    // Sessions
    sessions: (n: number) => `${n} 个会话`,
    projects: (n: number) => `${n} 个项目`,
    // Actions
    continueSession: "继续上次会话",
    newSession: "新建会话",
    addFavorite: "收藏项目",
    removeFavorite: "取消收藏",
    showInFinder: "在 Finder 中显示",
    copyPath: "复制路径",
    refresh: "刷新列表",
    openPreferences: "打开偏好设置",
    configureApi: "配置 API 环境变量",
    // Section titles
    sectionOpen: "打开",
    sectionManage: "管理",
    sectionConfig: "配置",
    // Toast messages
    openedInTerminal: "已在终端中打开",
    openTerminalFailed: "打开终端失败",
    copiedToClipboard: "命令已复制到剪贴板",
    pasteInAlacritty: "请在 Alacritty 中粘贴执行",
    openedInKitty: "已在 Kitty 中打开",
    favorited: "已收藏",
    unfavorited: "已取消收藏",
    loadFailed: "加载项目失败",
    unknownError: "未知错误",
    // Empty view
    noProjects: "未找到 Claude Code 项目",
    noProjectsDesc: "开始使用 Claude Code 后项目会显示在这里",
    // Search
    searchPlaceholder: "搜索 Claude Code 项目...",
    // Permissions
    permManage: "权限设置",
    permStrict: "严格模式",
    permStandard: "标准模式",
    permPermissive: "宽松模式",
    permCustom: "自定义",
    permDefault: "默认",
    permStrictDesc: "只读 + 保护敏感文件",
    permStandardDesc: "自动接受编辑 + 常用命令",
    permPermissiveDesc: "自动接受编辑 + 全部命令",
    permApplied: "已应用权限模式",
    permOpenEditor: "在编辑器中编辑权限",
    permReset: "恢复默认",
    permResetDone: "已恢复默认权限",
    permCustomEdit: "自定义权限",
    permEnable: "启用",
    permDisable: "禁用",
    permSectionMode: "权限模式",
    permAddRule: "新增规则",
    permDeleteRule: "删除规则",
    permRulePattern: "规则模式",
    permRuleType: "规则类型",
    permCustomRules: "自定义规则",
    permRuleAdded: "规则已添加",
    permRuleDeleted: "规则已删除",
    permRulePlaceholder: "例如: Bash(command:*)",
    permRuleExists: "规则已存在",
    // IDE
    openInIde: "在 IDE 中打开",
    // Session
    selectSession: "选择会话",
    resumeSession: "恢复会话",
    noSessions: "没有可用的会话",
    noSessionsDesc: "此项目暂无会话记录",
    sessionId: "会话 ID",
    // Session
    latest: "最新",
    // Cleanup
    cleanupStale: "清理无效项目",
    cleanupDone: (n: number) => `已清理 ${n} 个无效项目`,
    cleanupNone: "没有需要清理的项目",
    cleanupConfirm: "确定要清理无效项目吗？",
    // Batch
    batchApply: "批量应用权限",
    batchApplyDone: (n: number) => `已应用到 ${n} 个项目`,
  },
  en: {
    // Time
    justNow: "Just now",
    minutesAgo: (n: number) => `${n} min ago`,
    hoursAgo: (n: number) => `${n} hour${n > 1 ? "s" : ""} ago`,
    daysAgo: (n: number) => `${n} day${n > 1 ? "s" : ""} ago`,
    // Groups
    favorites: "Favorites",
    today: "Today",
    thisWeek: "This Week",
    earlier: "Earlier",
    // Sessions
    sessions: (n: number) => `${n} session${n > 1 ? "s" : ""}`,
    projects: (n: number) => `${n} project${n > 1 ? "s" : ""}`,
    // Actions
    continueSession: "Continue Last Session",
    newSession: "New Session",
    addFavorite: "Add to Favorites",
    removeFavorite: "Remove from Favorites",
    showInFinder: "Show in Finder",
    copyPath: "Copy Path",
    refresh: "Refresh",
    openPreferences: "Open Preferences",
    configureApi: "Configure API Environment",
    // Section titles
    sectionOpen: "Open",
    sectionManage: "Manage",
    sectionConfig: "Configuration",
    // Toast messages
    openedInTerminal: "Opened in Terminal",
    openTerminalFailed: "Failed to open terminal",
    copiedToClipboard: "Command copied to clipboard",
    pasteInAlacritty: "Paste in Alacritty to execute",
    openedInKitty: "Opened in Kitty",
    favorited: "Added to favorites",
    unfavorited: "Removed from favorites",
    loadFailed: "Failed to load projects",
    unknownError: "Unknown error",
    // Empty view
    noProjects: "No Claude Code Projects Found",
    noProjectsDesc: "Projects will appear here after using Claude Code",
    // Search
    searchPlaceholder: "Search Claude Code projects...",
    // Permissions
    permManage: "Permissions",
    permStrict: "Strict",
    permStandard: "Standard",
    permPermissive: "Permissive",
    permCustom: "Custom",
    permDefault: "Default",
    permStrictDesc: "Read-only + protect sensitive files",
    permStandardDesc: "Auto-accept edits + common commands",
    permPermissiveDesc: "Auto-accept edits + all commands",
    permApplied: "Permission mode applied",
    permOpenEditor: "Edit Permissions in Editor",
    permReset: "Reset to Default",
    permResetDone: "Permissions reset to default",
    permCustomEdit: "Custom Permissions",
    permEnable: "Enable",
    permDisable: "Disable",
    permSectionMode: "Permission Mode",
    permAddRule: "Add Rule",
    permDeleteRule: "Delete Rule",
    permRulePattern: "Rule Pattern",
    permRuleType: "Rule Type",
    permCustomRules: "Custom Rules",
    permRuleAdded: "Rule added",
    permRuleDeleted: "Rule deleted",
    permRulePlaceholder: "e.g. Bash(command:*)",
    permRuleExists: "Rule already exists",
    // IDE
    openInIde: "Open in IDE",
    // Session
    selectSession: "Select Session",
    resumeSession: "Resume Session",
    noSessions: "No Sessions Available",
    noSessionsDesc: "No session history for this project",
    sessionId: "Session ID",
    latest: "latest",
    // Cleanup
    cleanupStale: "Clean Up Stale Projects",
    cleanupDone: (n: number) =>
      `Cleaned up ${n} stale project${n > 1 ? "s" : ""}`,
    cleanupNone: "No stale projects found",
    cleanupConfirm: "Clean up stale projects?",
    // Batch
    batchApply: "Batch Apply Permissions",
    batchApplyDone: (n: number) => `Applied to ${n} project${n > 1 ? "s" : ""}`,
  },
};

type Language = keyof typeof i18n;
type I18nStrings = typeof i18n.zh;

// ============================================================================
// Types
// ============================================================================

type TerminalApp =
  | "iterm"
  | "terminal"
  | "warp"
  | "alacritty"
  | "kitty"
  | "ghostty";

interface Preferences {
  terminal: TerminalApp;
  groupByTime: boolean;
  showFavoritesFirst: boolean;
  language: Language;
  defaultPreset?: "" | "strict" | "standard" | "permissive";
  ideApp?: "" | "code" | "cursor" | "zed" | "webstorm";
  anthropicBaseUrl?: string;
  anthropicApiKey?: string;
}

interface ClaudeProject {
  name: string;
  fullPath: string;
  encodedName: string;
  lastModified: Date;
  sessionCount: number;
  permissionPreset: PermissionPreset;
}

type TimeGroup = "favorites" | "today" | "thisWeek" | "earlier";
type PermissionPreset =
  | "strict"
  | "standard"
  | "permissive"
  | "custom"
  | "default";

// ============================================================================
// Data Loading Functions
// ============================================================================

function readCwdFromSessionFile(filePath: string): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(BUFFER_SIZE);
    const bytesRead = fs.readSync(fd, buffer, 0, BUFFER_SIZE, 0);
    const content = buffer.toString("utf-8", 0, bytesRead);
    const lines = content.split("\n").slice(0, MAX_LINES_TO_CHECK);

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.cwd && typeof json.cwd === "string") {
          return json.cwd;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch {
    // File read error
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
  return null;
}

interface ProjectPathResult {
  path: string | null;
  sessionFiles: string[];
}

function getProjectPathAndFiles(
  projectDir: string,
  encodedName: string,
): ProjectPathResult {
  let files: string[];
  try {
    files = fs
      .readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));
  } catch {
    return { path: null, sessionFiles: [] };
  }

  if (files.length === 0) {
    const decodedPath = "/" + encodedName.replace(/-/g, "/");
    if (fs.existsSync(decodedPath)) {
      return { path: decodedPath, sessionFiles: [] };
    }
    return { path: null, sessionFiles: [] };
  }

  const sortedFiles = files
    .map((f) => {
      try {
        return { name: f, mtime: fs.statSync(path.join(projectDir, f)).mtime };
      } catch {
        return null;
      }
    })
    .filter((f): f is { name: string; mtime: Date } => f !== null)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  for (const file of sortedFiles.slice(0, MAX_SESSION_FILES_TO_CHECK)) {
    const cwd = readCwdFromSessionFile(path.join(projectDir, file.name));
    if (cwd && fs.existsSync(cwd)) {
      return { path: cwd, sessionFiles: files };
    }
  }

  const decodedPath = "/" + encodedName.replace(/-/g, "/");
  if (fs.existsSync(decodedPath)) {
    return { path: decodedPath, sessionFiles: files };
  }

  return { path: null, sessionFiles: files };
}

async function loadClaudeProjects(
  defaultPreset?: string,
): Promise<ClaudeProject[]> {
  const claudeProjectsDir = CLAUDE_PROJECTS_DIR;

  if (!fs.existsSync(claudeProjectsDir)) {
    return [];
  }

  const entries = fs.readdirSync(claudeProjectsDir, { withFileTypes: true });
  const projects: ClaudeProject[] = [];
  const seenPaths = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const projectDir = path.join(claudeProjectsDir, entry.name);
    const { path: fullPath, sessionFiles } = getProjectPathAndFiles(
      projectDir,
      entry.name,
    );

    if (!fullPath || seenPaths.has(fullPath)) {
      continue;
    }

    seenPaths.add(fullPath);

    let stats: fs.Stats;
    try {
      stats = fs.statSync(projectDir);
    } catch {
      continue;
    }

    let preset = detectPreset(fullPath);
    if (
      preset === "default" &&
      defaultPreset &&
      defaultPreset in PERMISSION_PRESETS
    ) {
      writePermissionPreset(fullPath, defaultPreset);
      preset = defaultPreset as PermissionPreset;
    }

    projects.push({
      name: path.basename(fullPath),
      fullPath,
      encodedName: entry.name,
      lastModified: stats.mtime,
      sessionCount: sessionFiles.length,
      permissionPreset: preset,
    });
  }

  return projects.sort(
    (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
  );
}

// ============================================================================
// Time & Grouping Utilities
// ============================================================================

function formatRelativeTime(date: Date, t: I18nStrings): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / MS_PER_MINUTE);
  const diffHours = Math.floor(diffMs / MS_PER_HOUR);
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

  if (diffMins < 1) return t.justNow;
  if (diffMins < 60) return t.minutesAgo(diffMins);
  if (diffHours < 24) return t.hoursAgo(diffHours);
  if (diffDays < DAYS_IN_WEEK) return t.daysAgo(diffDays);
  return date.toLocaleDateString();
}

function getTimeGroup(date: Date): TimeGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - DAYS_IN_WEEK * MS_PER_DAY);

  if (date >= today) return "today";
  if (date >= weekAgo) return "thisWeek";
  return "earlier";
}

function getGroupTitle(group: TimeGroup, t: I18nStrings): string {
  switch (group) {
    case "favorites":
      return t.favorites;
    case "today":
      return t.today;
    case "thisWeek":
      return t.thisWeek;
    case "earlier":
      return t.earlier;
  }
}

// ============================================================================
// Permission Functions
// ============================================================================

function getSettingsPath(projectPath: string): string {
  return path.join(projectPath, ".claude", "settings.local.json");
}

function resolveDefaultMode(settings: Record<string, unknown>): string | undefined {
  const perms = (settings.permissions as Record<string, unknown>) || {};
  return (perms.defaultMode as string) || (settings.defaultMode as string) || undefined;
}

function detectPreset(projectPath: string): PermissionPreset {
  const settings = readSettings(projectPath);
  // Stored preset metadata (written by Raycast, not affected by "don't ask again")
  const stored = settings._preset as string | undefined;
  if (stored && stored in PERMISSION_PRESETS) return stored as PermissionPreset;
  // No metadata: check if any rules exist at all
  const permsObj = (settings.permissions as Record<string, unknown>) || {};
  const allow: string[] = (permsObj.allow as string[]) || [];
  const deny: string[] = (permsObj.deny as string[]) || [];
  const mode = resolveDefaultMode(settings);
  if (allow.length === 0 && deny.length === 0 && !mode) return "default";
  return "custom";
}

function readSettings(projectPath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(projectPath), "utf-8"));
  } catch {
    return {};
  }
}

function writePermissionPreset(projectPath: string, presetName: string): void {
  const settingsPath = getSettingsPath(projectPath);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const settings = readSettings(projectPath);
  const preset = PERMISSION_PRESETS[presetName];
  delete settings.defaultMode;
  const perms: Record<string, unknown> = { allow: preset.allow, deny: preset.deny };
  if (preset.defaultMode) {
    perms.defaultMode = preset.defaultMode;
  }
  settings.permissions = perms;
  settings._preset = presetName;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

function resetPermissions(projectPath: string): void {
  const settingsPath = getSettingsPath(projectPath);
  try {
    const settings = readSettings(projectPath);
    if (Object.keys(settings).length === 0) return;
    delete settings.defaultMode;
    delete settings.permissions;
    delete settings._preset;
    if (Object.keys(settings).length === 0) {
      fs.unlinkSync(settingsPath);
    } else {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    }
  } catch {
    // ignore
  }
}

function getPresetDisplay(
  preset: PermissionPreset,
  t: I18nStrings,
): { label: string; color: Color } {
  switch (preset) {
    case "strict":
      return { label: t.permStrict, color: Color.Blue };
    case "standard":
      return { label: t.permStandard, color: Color.Green };
    case "permissive":
      return { label: t.permPermissive, color: Color.Orange };
    case "custom":
      return { label: t.permCustom, color: Color.Purple };
    default:
      return { label: t.permDefault, color: Color.SecondaryText };
  }
}

function saveSettings(
  projectPath: string,
  settings: Record<string, unknown>,
): void {
  const settingsPath = getSettingsPath(projectPath);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  // Deep clone to avoid mutating React state
  const clean = JSON.parse(JSON.stringify(settings)) as Record<string, unknown>;
  // User manually edited rules — no longer a clean preset
  delete clean._preset;
  const perms = clean.permissions as Record<string, unknown> | undefined;
  if (perms) {
    if (Array.isArray(perms.allow) && perms.allow.length === 0)
      delete perms.allow;
    if (Array.isArray(perms.deny) && perms.deny.length === 0) delete perms.deny;
    if (Object.keys(perms).length === 0) delete clean.permissions;
  }
  if (Object.keys(clean).length === 0) {
    try { fs.unlinkSync(settingsPath); } catch { /* not exists */ }
    return;
  }
  fs.writeFileSync(settingsPath, JSON.stringify(clean, null, 2) + "\n");
}

// ============================================================================
// Permission Editor Components
// ============================================================================

function AddRuleForm({
  lang,
  onSubmit,
}: {
  lang: Language;
  onSubmit: (pattern: string, type: "allow" | "deny") => void;
}) {
  const { pop } = useNavigation();
  const t = i18n[lang];

  return (
    <Form
      navigationTitle={t.permAddRule}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={t.permAddRule}
            icon={Icon.Plus}
            onSubmit={(values: { pattern: string; type: string }) => {
              const pattern = values.pattern.trim();
              if (!pattern) return;
              onSubmit(pattern, values.type as "allow" | "deny");
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="pattern"
        title={t.permRulePattern}
        placeholder={t.permRulePlaceholder}
      />
      <Form.Dropdown id="type" title={t.permRuleType} defaultValue="allow">
        <Form.Dropdown.Item
          value="allow"
          title="Allow"
          icon={{ source: Icon.CheckCircle, tintColor: Color.Green }}
        />
        <Form.Dropdown.Item
          value="deny"
          title="Deny"
          icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }}
        />
      </Form.Dropdown>
    </Form>
  );
}

const CATALOG_ALLOW_PATTERNS = new Set(
  PERMISSION_CATALOG.filter((r) => r.type === "allow").map((r) => r.pattern),
);
const CATALOG_DENY_PATTERNS = new Set(
  PERMISSION_CATALOG.filter((r) => r.type === "deny").map((r) => r.pattern),
);

function PermissionEditor({
  projectPath,
  lang,
  onUpdate,
}: {
  projectPath: string;
  lang: Language;
  onUpdate: () => void;
}) {
  const t = i18n[lang];
  const [settings, setSettings] = useState<Record<string, unknown>>(() =>
    readSettings(projectPath),
  );

  const perms = (settings.permissions as Record<string, unknown>) || {};
  const allow: string[] = (perms.allow as string[]) || [];
  const deny: string[] = (perms.deny as string[]) || [];
  const currentMode = resolveDefaultMode(settings) || "default";

  // Find rules not in the catalog
  const customRules = [
    ...allow
      .filter((p) => !CATALOG_ALLOW_PATTERNS.has(p))
      .map((p) => ({ pattern: p, type: "allow" as const })),
    ...deny
      .filter((p) => !CATALOG_DENY_PATTERNS.has(p))
      .map((p) => ({ pattern: p, type: "deny" as const })),
  ];

  const update = (newSettings: Record<string, unknown>) => {
    setSettings(newSettings);
    saveSettings(projectPath, newSettings);
    onUpdate();
  };

  const toggleRule = (pattern: string, type: "allow" | "deny") => {
    const list = type === "allow" ? [...allow] : [...deny];
    const idx = list.indexOf(pattern);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(pattern);
    const newPerms = { ...perms, [type]: list };
    update({ ...settings, permissions: newPerms });
  };

  const addRule = (pattern: string, type: "allow" | "deny") => {
    const list = type === "allow" ? allow : deny;
    if (list.includes(pattern)) {
      showToast({ style: Toast.Style.Failure, title: t.permRuleExists });
      return;
    }
    toggleRule(pattern, type);
    showToast({
      style: Toast.Style.Success,
      title: t.permRuleAdded,
      message: pattern,
    });
  };

  const setMode = (value: string) => {
    const next = { ...settings };
    delete next.defaultMode; // clean up legacy top-level placement
    const nextPerms = { ...(next.permissions as Record<string, unknown> || {}) };
    if (value === "default") {
      delete nextPerms.defaultMode;
    } else {
      nextPerms.defaultMode = value;
    }
    next.permissions = nextPerms;
    update(next);
  };

  const commonActions = (
    <>
      <Action.Push
        title={t.permAddRule}
        icon={Icon.Plus}
        shortcut={{ modifiers: ["cmd"], key: "n" }}
        target={<AddRuleForm lang={lang} onSubmit={addRule} />}
      />
      <Action
        title={t.permOpenEditor}
        icon={Icon.CodeBlock}
        shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
        onAction={() => {
          const sp = getSettingsPath(projectPath);
          if (!fs.existsSync(sp)) saveSettings(projectPath, settings);
          spawnSync("open", ["-t", sp]);
        }}
      />
    </>
  );

  return (
    <List
      navigationTitle={`${t.permCustomEdit} — ${path.basename(projectPath)}`}
    >
      <List.Section title={t.permSectionMode}>
        {MODE_OPTIONS.map((option) => (
          <List.Item
            key={option.value}
            title={lang === "zh" ? option.zh : option.en}
            icon={
              currentMode === option.value
                ? { source: Icon.CheckCircle, tintColor: Color.Green }
                : Icon.Circle
            }
            actions={
              <ActionPanel>
                <Action
                  title={
                    currentMode === option.value ? t.permDisable : t.permEnable
                  }
                  icon={Icon.Switch}
                  onAction={() =>
                    setMode(
                      currentMode === option.value ? "default" : option.value,
                    )
                  }
                />
                {commonActions}
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {customRules.length > 0 && (
        <List.Section title={t.permCustomRules}>
          {customRules.map((rule) => (
            <List.Item
              key={`custom-${rule.type}-${rule.pattern}`}
              title={rule.pattern}
              icon={{
                source: Icon.CheckCircle,
                tintColor: rule.type === "allow" ? Color.Green : Color.Red,
              }}
              accessories={[
                {
                  tag: {
                    value: rule.type === "allow" ? "Allow" : "Deny",
                    color: rule.type === "allow" ? Color.Green : Color.Red,
                  },
                },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title={t.permDeleteRule}
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => {
                      toggleRule(rule.pattern, rule.type);
                      showToast({
                        style: Toast.Style.Success,
                        title: t.permRuleDeleted,
                        message: rule.pattern,
                      });
                    }}
                  />
                  {commonActions}
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
      {CATALOG_SECTIONS.map((section) => (
        <List.Section
          key={section.key}
          title={lang === "zh" ? section.zh : section.en}
        >
          {PERMISSION_CATALOG.filter((r) => r.section === section.key).map(
            (rule) => {
              const list = rule.type === "allow" ? allow : deny;
              const enabled = list.includes(rule.pattern);
              return (
                <List.Item
                  key={`${rule.type}-${rule.pattern}`}
                  title={rule.pattern}
                  subtitle={lang === "zh" ? rule.zh : rule.en}
                  icon={
                    enabled
                      ? {
                          source: Icon.CheckCircle,
                          tintColor:
                            rule.type === "allow" ? Color.Green : Color.Red,
                        }
                      : Icon.Circle
                  }
                  accessories={[
                    {
                      tag: {
                        value: rule.type === "allow" ? "Allow" : "Deny",
                        color: rule.type === "allow" ? Color.Green : Color.Red,
                      },
                    },
                  ]}
                  actions={
                    <ActionPanel>
                      <Action
                        title={enabled ? t.permDisable : t.permEnable}
                        icon={enabled ? Icon.Circle : Icon.CheckCircle}
                        onAction={() => toggleRule(rule.pattern, rule.type)}
                      />
                      {commonActions}
                    </ActionPanel>
                  }
                />
              );
            },
          )}
        </List.Section>
      ))}
    </List>
  );
}

// ============================================================================
// Session Picker Component
// ============================================================================

function SessionPicker({
  project,
  lang,
  terminal,
  anthropicBaseUrl,
  anthropicApiKey,
}: {
  project: ClaudeProject;
  lang: Language;
  terminal: TerminalApp;
  anthropicBaseUrl?: string;
  anthropicApiKey?: string;
}) {
  const t = i18n[lang];
  const { data: sessions = [], isLoading } = useCachedPromise(
    getProjectSessions,
    [project.encodedName],
  );

  if (!isLoading && sessions.length === 0) {
    return (
      <List navigationTitle={t.selectSession}>
        <List.EmptyView
          title={t.noSessions}
          description={t.noSessionsDesc}
          icon={Icon.Document}
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} navigationTitle={`${t.selectSession} — ${project.name}`}>
      {sessions.map((session, idx) => (
        <List.Item
          key={session.id}
          title={session.title}
          subtitle={formatRelativeTime(session.mtime, t)}
          icon={
            idx === 0
              ? { source: Icon.Clock, tintColor: Color.Green }
              : Icon.Clock
          }
          accessories={[
            ...(idx === 0 ? [{ tag: { value: t.latest, color: Color.Green } }] : []),
            { text: session.mtime.toLocaleString() },
          ]}
          actions={
            <ActionPanel>
              <Action
                title={t.resumeSession}
                icon={Icon.ArrowRight}
                onAction={() =>
                  openInTerminal(
                    project.fullPath,
                    false,
                    terminal,
                    t,
                    anthropicBaseUrl,
                    anthropicApiKey,
                    session.id,
                  )
                }
              />
              <Action.CopyToClipboard
                title={`${t.copyPath} (${t.sessionId})`}
                content={session.id}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

// ============================================================================
// Terminal Opening Functions
// ============================================================================

function getITermScript(cmd: string): string {
  return `
tell application "iTerm"
  activate
  set newWindow to (create window with default profile)
  tell current session of newWindow
    write text "${cmd}"
  end tell
end tell`;
}

// Escape string for AppleScript double-quoted strings
function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Build export commands for environment variables
function buildEnvExports(
  anthropicBaseUrl?: string,
  anthropicApiKey?: string,
): string {
  const exports: string[] = [];
  if (anthropicBaseUrl?.trim()) {
    exports.push(
      `export ANTHROPIC_BASE_URL='${shellEscape(anthropicBaseUrl)}'`,
    );
  }
  if (anthropicApiKey?.trim()) {
    exports.push(`export ANTHROPIC_API_KEY='${shellEscape(anthropicApiKey)}'`);
  }
  return exports.join(" && ");
}

function openInTerminal(
  projectPath: string,
  continueSession: boolean,
  terminal: TerminalApp,
  t: I18nStrings,
  anthropicBaseUrl?: string,
  anthropicApiKey?: string,
  sessionId?: string,
) {
  const claudeCmd = sessionId
    ? `claude --resume '${shellEscape(sessionId)}'`
    : continueSession
      ? "claude -c"
      : "claude";
  // Use single quotes for shell (only need to escape single quotes)
  const shellSafePath = shellEscape(projectPath);

  // Build environment variable exports
  const envExports = buildEnvExports(anthropicBaseUrl, anthropicApiKey);

  // Build full command with env vars
  const cdCmd = `cd '${shellSafePath}'`;
  const fullCmd = envExports
    ? `${envExports} && ${cdCmd} && ${claudeCmd}`
    : `${cdCmd} && ${claudeCmd}`;

  // Escape entire command for AppleScript embedding
  const appleScriptCmd = escapeForAppleScript(fullCmd);

  let script: string;

  switch (terminal) {
    case "iterm":
      script = getITermScript(appleScriptCmd);
      break;

    case "terminal":
      script = `
tell application "Terminal"
  activate
  do script "${appleScriptCmd}"
end tell`;
      break;

    case "warp":
      script = `
tell application "Warp"
  activate
end tell
delay 0.5
tell application "System Events"
  keystroke "t" using command down
  delay 0.3
  keystroke "${appleScriptCmd}"
  keystroke return
end tell`;
      break;

    case "alacritty":
      spawnSync("open", ["-a", "Alacritty"]);
      spawnSync("bash", ["-c", `echo '${fullCmd}' | pbcopy`]);
      showToast({
        style: Toast.Style.Success,
        title: t.copiedToClipboard,
        message: t.pasteInAlacritty,
      });
      return;

    case "kitty": {
      const kittyCmd = envExports ? `${envExports} && ${claudeCmd}` : claudeCmd;
      spawnSync("kitty", [
        "--single-instance",
        "--directory",
        projectPath,
        "bash",
        "-c",
        kittyCmd,
      ]);
      showToast({
        style: Toast.Style.Success,
        title: t.openedInKitty,
        message: path.basename(projectPath),
      });
      return;
    }

    case "ghostty": {
      const tmpScript = `/tmp/claude-ghostty-${Date.now()}.sh`;
      fs.writeFileSync(tmpScript, `#!/bin/zsh -l\n${fullCmd}\n`, { mode: 0o755 });
      spawnSync("open", ["-na", "Ghostty.app", "--args", "-e", tmpScript]);
      showToast({
        style: Toast.Style.Success,
        title: t.openedInTerminal,
        message: path.basename(projectPath),
      });
      return;
    }

    default:
      script = getITermScript(appleScriptCmd);
  }

  const result = spawnSync("osascript", ["-e", script], { encoding: "utf-8" });

  if (result.status === 0) {
    showToast({
      style: Toast.Style.Success,
      title: t.openedInTerminal,
      message: path.basename(projectPath),
    });
  } else {
    const errorMsg =
      result.stderr?.trim() || result.error?.message || t.unknownError;
    showToast({
      style: Toast.Style.Failure,
      title: t.openTerminalFailed,
      message: errorMsg,
    });
  }
}

function showInFinder(projectPath: string) {
  spawnSync("open", ["-R", projectPath]);
}

function openInIde(projectPath: string, ide: string, t: I18nStrings) {
  const cmds: Record<string, string[]> = {
    code: ["code", projectPath],
    cursor: ["cursor", projectPath],
    zed: ["zed", projectPath],
    webstorm: ["webstorm", projectPath],
  };
  const cmd = cmds[ide];
  if (!cmd) return;
  const result = spawnSync(cmd[0], cmd.slice(1));
  if (result.status === 0 || result.status === null) {
    showToast({
      style: Toast.Style.Success,
      title: t.openInIde,
      message: path.basename(projectPath),
    });
  } else {
    showToast({
      style: Toast.Style.Failure,
      title: t.openInIde,
      message: result.stderr?.toString().trim() || t.unknownError,
    });
  }
}

// ============================================================================
// Session Functions
// ============================================================================

interface SessionInfo {
  id: string;
  mtime: Date;
  title: string;
}

function grepJsonl(
  filePath: string,
  pattern: string,
  maxResults?: number,
): string[] {
  try {
    const args = maxResults ? ["-m", String(maxResults), pattern, filePath] : [pattern, filePath];
    const result = spawnSync("grep", args, {
      encoding: "utf-8",
      maxBuffer: 256 * 1024,
      timeout: 3000,
    });
    if (result.status === 0 && result.stdout) {
      return result.stdout.trim().split("\n");
    }
  } catch {
    /* ignore */
  }
  return [];
}

function getSessionTitle(filePath: string): string {
  // Last summary entry (AI-generated conversation title)
  const summaryLines = grepJsonl(filePath, '"type":"summary"');
  for (let i = summaryLines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(summaryLines[i]);
      if (obj.type === "summary" && obj.summary) return obj.summary;
    } catch {
      /* partial match */
    }
  }

  // Fallback: first user message
  const userLines = grepJsonl(filePath, '"type":"user"', 1);
  if (userLines.length > 0) {
    try {
      const obj = JSON.parse(userLines[0]);
      if (obj.type === "user") {
        const content = obj.message?.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === "text" && c.text) return c.text.slice(0, 80);
          }
        } else if (typeof content === "string") {
          return content.slice(0, 80);
        }
      }
    } catch {
      /* parse error */
    }
  }

  return "";
}

async function getProjectSessions(encodedName: string): Promise<SessionInfo[]> {
  const projectDir = path.join(CLAUDE_PROJECTS_DIR, encodedName);
  let files: string[];
  try {
    files = fs
      .readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));
  } catch {
    return [];
  }
  return files
    .map((f) => {
      try {
        const filePath = path.join(projectDir, f);
        const stat = fs.statSync(filePath);
        const title = getSessionTitle(filePath);
        if (!title) return null;
        return { id: f.replace(".jsonl", ""), mtime: stat.mtime, title };
      } catch {
        return null;
      }
    })
    .filter((s): s is SessionInfo => s !== null)
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

// ============================================================================
// Stale Project Cleanup
// ============================================================================

function findStaleProjects(): string[] {
  const claudeProjectsDir = CLAUDE_PROJECTS_DIR;
  if (!fs.existsSync(claudeProjectsDir)) return [];
  const entries = fs.readdirSync(claudeProjectsDir, { withFileTypes: true });
  const stale: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const projectDir = path.join(claudeProjectsDir, entry.name);
    const { path: fullPath } = getProjectPathAndFiles(projectDir, entry.name);
    if (!fullPath) stale.push(entry.name);
  }
  return stale;
}

function removeStaleProjects(staleNames: string[]): number {
  const claudeProjectsDir = CLAUDE_PROJECTS_DIR;
  let removed = 0;
  for (const name of staleNames) {
    try {
      fs.rmSync(path.join(claudeProjectsDir, name), { recursive: true });
      removed++;
    } catch {
      // ignore
    }
  }
  return removed;
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

function getQuickShortcut(idx: number) {
  if (idx === 0) return { modifiers: ["cmd"] as ["cmd"], key: "1" as const };
  if (idx === 1) return { modifiers: ["cmd"] as ["cmd"], key: "2" as const };
  if (idx === 2) return { modifiers: ["cmd"] as ["cmd"], key: "3" as const };
  return undefined;
}

// ============================================================================
// Main Component
// ============================================================================

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const t = i18n[preferences.language] || i18n.en;
  const { value: favorites = [], setValue: setFavorites } = useLocalStorage<
    string[]
  >("favorites", []);

  const {
    data: projects = [],
    isLoading,
    revalidate,
  } = useCachedPromise(
    loadClaudeProjects,
    [preferences.defaultPreset || undefined],
    {
      keepPreviousData: true,
    },
  );

  const favoritesSet = new Set(favorites);
  const isFavorite = (project: ClaudeProject) =>
    favoritesSet.has(project.fullPath);

  const toggleFavorite = async (project: ClaudeProject) => {
    const wasFavorite = isFavorite(project);
    const newFavorites = wasFavorite
      ? favorites.filter((p) => p !== project.fullPath)
      : [...favorites, project.fullPath];
    await setFavorites(newFavorites);
    showToast({
      style: Toast.Style.Success,
      title: wasFavorite ? t.unfavorited : t.favorited,
      message: project.name,
    });
  };

  // Sort and group projects
  const sortedProjects = [...projects].sort((a, b) => {
    if (preferences.showFavoritesFirst) {
      const aFav = isFavorite(a);
      const bFav = isFavorite(b);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
    }
    return b.lastModified.getTime() - a.lastModified.getTime();
  });

  // Group projects by time
  const groupedProjects = new Map<TimeGroup, ClaudeProject[]>();

  if (preferences.groupByTime) {
    for (const project of sortedProjects) {
      const group =
        preferences.showFavoritesFirst && isFavorite(project)
          ? "favorites"
          : getTimeGroup(project.lastModified);
      if (!groupedProjects.has(group)) groupedProjects.set(group, []);
      groupedProjects.get(group)!.push(project);
    }
  }

  // Pre-compute index map for O(1) lookup in grouped view
  const indexMap = new Map(sortedProjects.map((p, i) => [p.encodedName, i]));

  const renderProjectItem = (project: ClaudeProject, index: number) => {
    const favorite = isFavorite(project);
    const quickShortcut = getQuickShortcut(index);
    const presetDisplay = getPresetDisplay(project.permissionPreset, t);

    return (
      <List.Item
        key={project.encodedName}
        title={project.name}
        subtitle={project.fullPath}
        keywords={project.fullPath.split(/[/\\]/)}
        icon={{
          source: favorite ? Icon.StarCircle : Icon.Terminal,
          tintColor: favorite ? Color.Yellow : Color.Orange,
        }}
        accessories={[
          ...(project.permissionPreset !== "default"
            ? [
                {
                  tag: {
                    value: presetDisplay.label,
                    color: presetDisplay.color,
                  },
                },
              ]
            : []),
          { text: t.sessions(project.sessionCount), icon: Icon.Document },
          {
            text: formatRelativeTime(project.lastModified, t),
            icon: Icon.Clock,
          },
        ]}
        actions={
          <ActionPanel>
            <ActionPanel.Section title={t.sectionOpen}>
              <Action
                title={t.continueSession}
                icon={Icon.ArrowRight}
                shortcut={quickShortcut}
                onAction={() =>
                  openInTerminal(
                    project.fullPath,
                    true,
                    preferences.terminal,
                    t,
                    preferences.anthropicBaseUrl,
                    preferences.anthropicApiKey,
                  )
                }
              />
              <Action
                title={t.newSession}
                icon={Icon.Plus}
                shortcut={{ modifiers: ["cmd"], key: "n" }}
                onAction={() =>
                  openInTerminal(
                    project.fullPath,
                    false,
                    preferences.terminal,
                    t,
                    preferences.anthropicBaseUrl,
                    preferences.anthropicApiKey,
                  )
                }
              />
              <Action.Push
                title={t.selectSession}
                icon={Icon.List}
                shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
                target={
                  <SessionPicker
                    project={project}
                    lang={preferences.language}
                    terminal={preferences.terminal}
                    anthropicBaseUrl={preferences.anthropicBaseUrl}
                    anthropicApiKey={preferences.anthropicApiKey}
                  />
                }
              />
              {preferences.ideApp ? (
                <Action
                  title={t.openInIde}
                  icon={Icon.AppWindow}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
                  onAction={() =>
                    openInIde(project.fullPath, preferences.ideApp!, t)
                  }
                />
              ) : null}
            </ActionPanel.Section>
            <ActionPanel.Section title={t.sectionManage}>
              <Action
                title={favorite ? t.removeFavorite : t.addFavorite}
                icon={favorite ? Icon.StarDisabled : Icon.Star}
                shortcut={{ modifiers: ["cmd"], key: "d" }}
                onAction={() => toggleFavorite(project)}
              />
              <Action
                title={t.showInFinder}
                icon={Icon.Finder}
                shortcut={{ modifiers: ["cmd", "shift"], key: "f" }}
                onAction={() => showInFinder(project.fullPath)}
              />
              <Action.OpenWith
                path={project.fullPath}
                shortcut={{ modifiers: ["cmd"], key: "o" }}
              />
              <Action.CopyToClipboard
                title={t.copyPath}
                content={project.fullPath}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
            </ActionPanel.Section>
            <ActionPanel.Section title={t.sectionConfig}>
              <ActionPanel.Submenu
                title={t.permManage}
                icon={Icon.Lock}
                shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
              >
                {(
                  [
                    {
                      key: "strict",
                      label: t.permStrict,
                      desc: t.permStrictDesc,
                    },
                    {
                      key: "standard",
                      label: t.permStandard,
                      desc: t.permStandardDesc,
                    },
                    {
                      key: "permissive",
                      label: t.permPermissive,
                      desc: t.permPermissiveDesc,
                    },
                  ] as const
                ).map((p) => (
                  <Action
                    key={p.key}
                    title={`${p.label} — ${p.desc}`}
                    icon={
                      project.permissionPreset === p.key
                        ? Icon.CheckCircle
                        : Icon.Circle
                    }
                    onAction={() => {
                      writePermissionPreset(project.fullPath, p.key);
                      revalidate();
                      showToast({
                        style: Toast.Style.Success,
                        title: t.permApplied,
                        message: p.label,
                      });
                    }}
                  />
                ))}
                <Action
                  title={t.permReset}
                  icon={Icon.XMarkCircle}
                  onAction={() => {
                    resetPermissions(project.fullPath);
                    revalidate();
                    showToast({
                      style: Toast.Style.Success,
                      title: t.permResetDone,
                    });
                  }}
                />
                <Action.Push
                  title={t.permCustomEdit}
                  icon={Icon.List}
                  target={
                    <PermissionEditor
                      projectPath={project.fullPath}
                      lang={preferences.language}
                      onUpdate={revalidate}
                    />
                  }
                />
              </ActionPanel.Submenu>
              <ActionPanel.Submenu
                title={t.batchApply}
                icon={Icon.BulletPoints}
              >
                {(["strict", "standard", "permissive"] as const).map(
                  (preset) => (
                    <Action
                      key={preset}
                      title={
                        t[
                          `perm${preset.charAt(0).toUpperCase() + preset.slice(1)}` as keyof I18nStrings
                        ] as string
                      }
                      onAction={() => {
                        let count = 0;
                        for (const p of projects) {
                          if (p.permissionPreset !== preset) {
                            writePermissionPreset(p.fullPath, preset);
                            count++;
                          }
                        }
                        revalidate();
                        showToast({
                          style: Toast.Style.Success,
                          title: t.batchApplyDone(count),
                        });
                      }}
                    />
                  ),
                )}
              </ActionPanel.Submenu>
              <Action
                title={t.cleanupStale}
                icon={Icon.Trash}
                onAction={async () => {
                  const stale = findStaleProjects();
                  if (stale.length === 0) {
                    showToast({
                      style: Toast.Style.Success,
                      title: t.cleanupNone,
                    });
                    return;
                  }
                  const confirmed = await confirmAlert({
                    title: t.cleanupConfirm,
                    message: t.cleanupDone(stale.length),
                    primaryAction: {
                      title: t.cleanupStale,
                      style: Alert.ActionStyle.Destructive,
                    },
                  });
                  if (!confirmed) return;
                  const removed = removeStaleProjects(stale);
                  revalidate();
                  showToast({
                    style: Toast.Style.Success,
                    title: t.cleanupDone(removed),
                  });
                }}
              />
              <Action
                title={t.configureApi}
                icon={Icon.Key}
                shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
                onAction={openExtensionPreferences}
              />
              <Action
                title={t.refresh}
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={() => revalidate()}
              />
              <Action
                title={t.openPreferences}
                icon={Icon.Gear}
                shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
                onAction={openExtensionPreferences}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder={t.searchPlaceholder}>
      {projects.length === 0 && !isLoading ? (
        <List.EmptyView
          title={t.noProjects}
          description={t.noProjectsDesc}
          icon={Icon.Terminal}
        />
      ) : preferences.groupByTime ? (
        // Grouped view
        (["favorites", "today", "thisWeek", "earlier"] as TimeGroup[]).map(
          (group) => {
            const groupProjects = groupedProjects.get(group);
            if (!groupProjects || groupProjects.length === 0) return null;
            return (
              <List.Section
                key={group}
                title={getGroupTitle(group, t)}
                subtitle={t.projects(groupProjects.length)}
              >
                {groupProjects.map((project) =>
                  renderProjectItem(
                    project,
                    indexMap.get(project.encodedName) ?? -1,
                  ),
                )}
              </List.Section>
            );
          },
        )
      ) : (
        // Flat view
        sortedProjects.map((project, index) =>
          renderProjectItem(project, index),
        )
      )}
    </List>
  );
}
