# dsh-emacs-keys

[![dsh-plugin](https://img.shields.io/badge/DeepSeek%20Harness-dsh--plugin-blue)](https://github.com/topics/dsh-plugin)
[![dynamic cordis plugin](https://img.shields.io/badge/Cordis-dynamic%20plugin-green)](https://github.com/deepseek-ai/deepseek-harness)

**dsh-emacs-keys** 是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件，接管 DSH Web 的键盘快捷键并重构为 Emacs 风格绑定。激活后，插件在 `window` 捕获阶段拦截几乎所有 Ctrl/Alt 组合——包括浏览器默认行为（打印/保存/查找/历史/缩放/剪贴板）——改由插件的 Emacs 命令处理。

快捷键**不写在代码里**：全部配置在工作区的 [`emacs-keybindings.json`](./emacs-keybindings.json)，按功能树组织，遵循 Emacs 记法，改完按 `C-x C-r` 热重载即可生效。

## 功能

- **全局导航**：`C-p`/`C-n` 滚动对话（到边缘有"已到顶部/已到底部"提示），`C-v`/`M-v` 翻页，`M-<`/`M->` 跳到对话开头/末尾
- **区域操作（任何焦点上下文都生效）**：`C-w` 剪切、`M-w` 复制、`C-y` yank、`M-y` yank-pop —— 作用于当前文档选区；`C-y` 无选区时自动聚焦输入框粘贴；只读内容上的 `C-w` 降级为复制并提示
- **完整输入编辑**（Lexical 输入框）：kill-ring（剪切环）、mark/region、undo/redo、字符/单词/行移动，兼容 Lexical 的选区同步模型
- **前缀键**：`C-x` 前缀序列（`C-x k` 关会话、`C-x o` 切面板……），`C-u` 通用参数
- **i-search**：`C-s` / `C-r` 前向/后向搜索
- **配置热重载**：`C-x C-r` 重新读取配置文件，无需重启插件
- **设置页**：DSH 设置 → "Emacs 快捷键"，实时渲染当前生效的配置树与来源

## 安装

本插件是**动态 Cordis 插件**（Client + Host 双半，运行时定义），不走静态 bundle 安装。两种方式：

### 方式一：在 DSH 会话中用 cordis 工具定义（推荐）

在任意 DSH 会话里让 Agent 执行：

1. 读取 `_body_config_host.js` 与 `_body_config_client.js` 的内容；
2. 调用 `cordis_define`（`kind: "new"`，`idPrefix: "emacs"`，同时提供 `code.host` 与 `code.client`）；
3. 调用 `cordis_run` 激活返回的 package，并在 UI 上批准客户端包。

```sh
git clone https://github.com/renshuo/dsh-emacs-keys.git
cd dsh-emacs-keys   # 把该目录设为 DSH 会话工作区即可
```

### 方式二：引用本仓库源码

插件代码即本仓库的两个函数体文件，Agent 可直接 `github:renshuo/dsh-emacs-keys` 拉取后按上述流程定义。

## 使用

激活后无需配置即可使用。内置默认键位（节选）：

| 键 | 作用 | 上下文 |
|----|------|--------|
| `C-p` / `C-n` | 上/下滚动对话；输入框内为上/下一行 | 全局 / 输入框 |
| `C-b` / `C-f` | 后移 / 前移一个字符 | 输入框 |
| `M-b` / `M-f` | 后移 / 前移一个单词 | 输入框 |
| `C-a` / `C-e` | 行首 / 行尾 | 输入框 |
| `C-k` | 删除到行尾（进 kill-ring） | 输入框 |
| `C-w` / `M-w` | 剪切 / 复制选中区域 | **任何焦点** |
| `C-y` / `M-y` | yank 粘贴 / 轮换粘贴 | **任何焦点** |
| `C-SPC` | 设置标记（mark） | 输入框 |
| `C-x C-x` | 交换点与标记 | 前缀序列 |
| `C-x k` / `C-x n` / `C-x p` | 关闭 / 下一个 / 上一个会话 | 前缀序列 |
| `C-s` / `C-r` | i-search 前向 / 后向 | 全局 |
| `M-←` / `M-→` | 上一个 / 下一个会话 | 全局 |
| `C-=` / `C--` / `C-0` | 字号增大 / 减小 / 重置 | 全局 |
| `C-g` | 取消（keyboard-quit） | 全局 |
| `C-x C-r` | 热重载配置文件 | 前缀序列 |

完整键位见设置页，或直接读 [`emacs-keybindings.json`](./emacs-keybindings.json)。

## 配置

快捷键配置在工作区根目录的 `emacs-keybindings.json`，结构为功能树：

```json
{
  "categories": [
    {
      "name": "区域操作（任何焦点）",
      "context": "region",
      "bindings": {
        "region.kill": { "key": "C-w", "label": "剪切选中区域（进 kill-ring）" }
      }
    }
  ]
}
```

- **Emacs 记法**：`C`=Ctrl、`M`=Alt、`S`=Shift、`SPC`=空格；序列以空格分隔（如 `"C-x k"`）
- **`context` 分发层**（与 Emacs 的 buffer/global 语义对应）：
  - `region` —— 任何焦点上下文都生效（最先匹配）
  - `global` —— 仅输入框外生效
  - `editing` —— 仅输入框内生效
  - `prefix:C-x` —— `C-x` 前缀序列（键名为序列最后一个键）
  - `prefix-start` —— 前缀启动键
- 同一按键可在不同 `context` 绑定不同功能（如 `C-p` 在 global 是滚动、在 editing 是上一行）
- 修改 `key`/`label`/增删分类均为纯配置操作；**新增 `功能ID`** 需在 `_body_config_client.js` 的 `IMPL` 注册表中登记对应实现
- 改完按 `C-x C-r` 热重载；配置文件缺失或非法时自动回退到内置默认树（行为与上表一致）

## 接管范围（interception policy）

| 类别 | 处理 |
|------|------|
| 剪贴板 / 撤销 / 重做 | **全部接管**，由插件 kill-ring / undo 实现 |
| 区域操作（C-w / M-w / C-y / M-y） | **任何焦点上下文都生效**；C-y 无选区时自动聚焦输入框粘贴 |
| 历史导航（Alt+←/→） | **接管**，映射为上一个/下一个会话 |
| 缩放（Ctrl+=/-/0） | **接管**，映射为字号增大/减小/重置 |
| 打印/保存/查找/地址栏/书签/源码视图 | **接管**，命中 Emacs 映射或显示"未绑定"提示 |
| 标签管理（Ctrl+T、Ctrl+Tab、Ctrl+1-9）、F 键、DevTools | 放行（页面脚本无法阻止） |
| IME 输入法组合 | 放行（绝不劫持中文输入法） |

> 注意：在普通浏览器标签页中，Ctrl+N（新窗口）/ Ctrl+T（新标签）由浏览器在页面之前处理，任何页面脚本都无法拦截；在 DSH 桌面（Electron）窗口中这些键可正常接管。

## 架构

```
emacs-keybindings.json          功能树配置（Emacs 记法）
        │ fs 服务读取
        ▼
┌─────────────────────────┐  包私有 RPC   ┌──────────────────────────────┐
│ Host 半                  │ ───────────▶ │ Client 半                     │
│ _body_config_host.js    │              │ _body_config_client.js       │
│ harness.handle(read)    │              │ 解析配置 → 构建分发表          │
└─────────────────────────┘              │ window keydown（捕获）→ IMPL  │
                                         └──────────────────────────────┘
```

- **Host 半**：通过 `fs` 服务读取配置文件，经 `harness.handle` 提供包私有 RPC
- **Client 半**：启动时拉取配置构建分发表（Emacs 记法规范化、前缀序列解析、变体匹配），缺失时回退内置默认树；按键驱动 `IMPL` 动作注册表
- 键盘事件在 `window` 捕获阶段拦截，先于 Lexical/React 处理；剪贴板编辑延迟一个宏任务执行，避免与 Lexical 的 `selectionchange` 模型同步竞态
- 生命周期：监听器由 `ctx.effect` 持有，插件停止/更新/卸载时自动移除

## 开发

- `_body_config_host.js` / `_body_config_client.js`：实际部署的两半函数体（纯 JavaScript，无 import/TS/JSX）
- `_verify/`：基于真实 Lexical + Chromium 的回归模拟环境（`serve.js` + `lexsim.js`/`v7sim.js`），可用于本地验证按键行为
- 修改代码后：重新 `cordis_define`（`kind: "existing"`，`pluginId` 不变）→ `cordis_run update`

## 兼容性

- DSH Web（http 与桌面 Electron 壳）
- Lexical 输入框（DSH composer，`registerPlainText` + `registerHistory`）
- 普通 contenteditable 与 textarea/input 编辑器

## 许可

[MIT](LICENSE)
