# dsh-emacs-key-binding

A DSH dynamic Cordis plugin that **takes over the DSH Web keyboard shortcuts** and reconfigures them with Emacs-style bindings. When active, the plugin intercepts almost every Ctrl/Alt combination — including the browser's own defaults (print/save/find/history/zoom/clipboard) — so the browser never runs its default action.

## 配置文件（v5 起）

快捷键**不再写在代码里**，而是配置在工作区的 `emacs-keybindings.json`：

- **功能树结构**：`categories[]`，每个分类含 `name`（显示名）、`context`（分发层）和 `bindings`（`功能ID → { key, label }`）
- **Emacs 记法**：`C`=Ctrl、`M`=Alt、`S`=Shift、`SPC`=空格；序列用空格分隔（如 `"C-x k"`）
- **context 分发层**：`region`=任何焦点生效、`global`=仅输入框外、`editing`=仅输入框内、`prefix:C-x`=前缀序列、`prefix-start`=前缀启动键
- Host 半通过 `fs` 服务读取该文件，经 Package 私有 RPC 交给 Client 半；文件缺失或非法时回退到内置默认树
- **`C-x C-r` 热重载**配置（同时刷新设置页表格）；设置页显示当前生效的配置来源
- 修改 `label` 或增删分类无需改代码；新增动作需在 Client 半的 `IMPL` 注册表中登记实现

## 接管范围（interception policy）

| 类别 | 处理 |
|------|------|
| 剪贴板 / 撤销 / 重做 | **全部接管**，由插件 kill-ring / undo 实现 |
| 区域操作（C-w / M-w / C-y / M-y） | **任何焦点上下文都生效**：作用于当前文档选区；C-y 无选区时自动聚焦输入框粘贴 |
| 历史导航（Alt+←/→） | **接管**，映射为上一个/下一个会话 |
| 缩放（Ctrl+=/-/0） | **接管**，映射为字号增大/减小/重置 |
| 打印/保存/查找/地址栏/书签/源码视图 | **接管**，命中 Emacs 映射或显示"未绑定"提示 |
| 标签管理（Ctrl+T、Ctrl+Tab、Ctrl+1-9）、F 键、DevTools | 放行（页面脚本无法阻止） |
| IME 输入法组合 | 放行（绝不劫持中文输入法） |

> 注意：若在普通浏览器标签页中使用，Ctrl+N（新窗口）/ Ctrl+T（新标签）由浏览器在页面之前处理，
> 任何页面脚本都无法拦截；在 DSH 桌面（Electron）窗口中这些键可正常接管。

## Features

- **Global navigation**: `C-p`/`C-n` message navigation, `C-v`/`M-v` scrolling, `M-<`/`M->` conversation edges
- **Full input editing**: kill-ring (剪切环), mark/region, undo, char/word/line motion — works on the Lexical composer via `Selection.modify` + `execCommand`
- **Prefix keys**: `C-x` prefix, `M-x` command palette
- **i-search**: `C-s`/`C-r`
- **Cancel**: `C-g` universal quit

## Emacs Keybindings Reference

### 全局（输入框外）
| Key | Action |
|-----|--------|
| `C-p` | 上一条消息 |
| `C-n` | 下一条消息 |
| `C-v` | 向下翻页 |
| `M-v` | 向上翻页 |
| `M-<` | 对话开头 |
| `M->` | 对话末尾 |
| `C-s` | 向前搜索 |
| `C-r` | 向后搜索 |
| `C-g` | 取消 / 退出 |
| `M-x` | 命令面板 |
| `M-←` / `M-→` | 上一个 / 下一个会话 |
| `C-=` / `C--` / `C-0` | 字号增大 / 减小 / 重置 |
| `C-x C-b` | 切换会话 |
| `C-x k` | 关闭当前会话 |
| `C-x o` | 切换面板 |
| `C-x 0` | 关闭右侧面板 |
| `C-x 1` | 最大化主区域 |

### 输入框编辑（输入框内）
| Key | Action |
|-----|--------|
| `C-a` / `C-e` | 行首 / 行尾 |
| `C-f` / `C-b` | 前移 / 后移一字符 |
| `M-f` / `M-b` | 前移 / 后移一词 |
| `C-p` / `C-n` | 上一行 / 下一行 |
| `C-d` / `C-h` | 前删 / 后删 |
| `M-d` / `M-BS` | 删词（进 kill-ring） |
| `C-k` | 删除到行尾（进 kill-ring） |
| `C-w` / `M-w` | 剪切 / 复制区域（进 kill-ring） |
| `C-y` / `M-y` | Yank / yank-pop（粘贴切换） |
| `C-c` | 复制区域（浏览器 Ctrl+C 被接管） |
| `C-v` | Yank 粘贴（浏览器 Ctrl+V 被接管） |
| `C-z` / `C-Shift-Z` | 撤销 / 重做（浏览器默认接管） |
| `C-/` / `C-x u` | 撤销 |
| `C-SPC` | 设置标记 (mark) |
| `C-x C-x` | 交换点与标记 |
| `C-t` / `M-t` | 交换字符 / 词 |
| `C-s` / `C-r` | isearch |

## Settings Page

设置页侧边栏 → **"Emacs 快捷键"**：完整中文快捷键表格（含图例 C=Ctrl, M=Alt, S=Shift）。

## Installation

This plugin is defined and activated dynamically via Cordis tools. It lives in the current DSH process — call `cordis_define` then `cordis_run` with the code in `plugin.js`.