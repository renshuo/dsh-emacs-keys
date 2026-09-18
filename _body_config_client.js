// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a canonical descriptor like "C-x", "M-f", "C-SPC" from a KeyboardEvent. */
function describeKey(event) {
  const mods = []
  if (event.ctrlKey) mods.push('C')
  if (event.altKey) mods.push('M')
  if (event.shiftKey && event.key.length === 1) mods.push('S')
  let k = event.key
  if (k === ' ') k = 'SPC'
  else if (k.length === 1) k = k.toLowerCase()
  return [...mods, k].join('-')
}

/** True when this keydown is the modifier key itself, not a chord. */
function isModifierKey(event) {
  return event.key === 'Control' || event.key === 'Alt'
    || event.key === 'Shift' || event.key === 'Meta'
    || event.key === 'AltGraph' || event.key === 'CapsLock'
}

/**
 * Parse one Emacs-notation key ("C-x k", "M-<", "C-SPC", "C-S-z") into its
 * canonical descriptor form — the same form describeKey() emits.
 * Modifiers C/M/S are stripped greedily; what remains is the key name.
 */
function canonicalKey(notation) {
  const tokens = String(notation).trim().split('-')
  const mods = []
  while (tokens.length > 1 && ['C', 'M', 'S'].includes(tokens[0])) {
    mods.push(tokens.shift())
  }
  let key = tokens.join('-')
  if (key === 'SPC' || key === ' ') key = 'SPC'
  else if (key.length === 1) key = key.toLowerCase()
  return [...mods, key].join('-')
}

/**
 * All descriptor variants a notation can produce on a real keyboard:
 * the base form plus, for single-character keys that would be typed with
 * Shift (e.g. "<"), the explicit S variant.
 */
function canonicalVariants(notation) {
  const base = canonicalKey(notation)
  const out = [base]
  const tokens = base.split('-')
  const key = tokens[tokens.length - 1]
  if (key.length === 1 && !/[a-z0-9]/.test(key)) {
    const mods = tokens.slice(0, -1)
    if (!mods.includes('S')) out.push([...mods, 'S', key].join('-'))
  }
  return out
}

/** True when focus is inside a text-entry surface. */
function inTextInput() {
  const el = document.activeElement
  if (el === null || el === undefined) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (el.isContentEditable) return true
  return false
}

/** The scrollable conversation container, if present. */
function conversationScroller() {
  return (
    document.querySelector('.conversation-scroll') ||
    document.querySelector('[data-conversation-scroll]') ||
    document.querySelector('.chat-scroll') ||
    document.querySelector('main')
  )
}

/** The main input / composer element, if present. */
function composerEl() {
  return (
    document.querySelector('[contenteditable="true"]') ||
    document.querySelector('textarea[name="prompt"]')
  )
}

/** True when the DOM selection sits inside the given element (or its shadow). */
function selectionInside(el) {
  const sel = window.getSelection()
  if (sel === null || sel.rangeCount === 0 || el === null) return false
  const node = sel.anchorNode
  return node !== null && el.contains(node)
}

// ---------------------------------------------------------------------------
// Default configuration — mirrors emacs-keybindings.json; used when the
// config file is missing or invalid. Same tree shape: categories[] with
// { name, context, bindings: { actionId: { key, label } } }.
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  categories: [
    { name: '区域操作（任何焦点）', context: 'region', bindings: {
      'region.kill':      { key: 'C-w',   label: '剪切选中区域（进 kill-ring）' },
      'region.copy':      { key: 'M-w',   label: '复制选中区域（进 kill-ring）' },
      'region.yank':      { key: 'C-y',   label: 'Yank 粘贴（粘到输入框）' },
      'region.yank-pop':  { key: 'M-y',   label: 'yank-pop 轮换粘贴内容' },
      'editing.set-mark': { key: 'C-SPC', label: '设置标记（mark，输入框内）' },
    }},
    { name: '导航（输入框外）', context: 'global', bindings: {
      'nav.up':               { key: 'C-p',            label: '向上滚动（上一屏）' },
      'nav.down':             { key: 'C-n',            label: '向下滚动（下一屏）' },
      'nav.page-down':        { key: 'C-v',            label: '向下翻页' },
      'nav.page-up':          { key: 'M-v',            label: '向上翻页' },
      'nav.top':              { key: 'M-<',            label: '跳到对话开头' },
      'nav.bottom':           { key: 'M->',            label: '跳到对话末尾' },
      'nav.isearch-forward':  { key: 'C-s',            label: '向前搜索（isearch）' },
      'nav.isearch-backward': { key: 'C-r',            label: '向后搜索（isearch）' },
      'session.prev-alt':     { key: 'M-ArrowLeft',    label: '上一个会话' },
      'session.next-alt':     { key: 'M-ArrowRight',   label: '下一个会话' },
      'view.font-zoom-in':    { key: 'C-=',            label: '字号增大（含 C-+）' },
      'view.font-zoom-out':   { key: 'C--',            label: '字号减小' },
      'view.font-reset':      { key: 'C-0',            label: '字号重置' },
      'app.keyboard-quit':    { key: 'C-g',            label: '取消 / 退出当前操作' },
      'app.command-palette':  { key: 'M-x',            label: '打开命令面板' },
    }},
    { name: '输入框编辑（输入框内）', context: 'editing', bindings: {
      'editing.beginning-of-line':  { key: 'C-a',          label: '跳到行首' },
      'editing.end-of-line':        { key: 'C-e',          label: '跳到行尾' },
      'editing.forward-char':       { key: 'C-f',          label: '向前移动一个字符' },
      'editing.backward-char':      { key: 'C-b',          label: '向后移动一个字符' },
      'editing.forward-word':       { key: 'M-f',          label: '向前移动一个单词' },
      'editing.backward-word':      { key: 'M-b',          label: '向后移动一个单词' },
      'editing.previous-line':      { key: 'C-p',          label: '上一行' },
      'editing.next-line':          { key: 'C-n',          label: '下一行' },
      'nav.top':                    { key: 'M-<',          label: '跳到行首（缓冲区首）' },
      'nav.bottom':                 { key: 'M->',          label: '跳到行尾（缓冲区尾）' },
      'nav.isearch-forward':        { key: 'C-s',          label: '向前搜索' },
      'nav.isearch-backward':       { key: 'C-r',          label: '向后搜索' },
      'editing.delete-char':        { key: 'C-d',          label: '向前删除一个字符' },
      'editing.backward-kill-char': { key: 'C-h',          label: '向后删除一个字符' },
      'editing.kill-word':          { key: 'M-d',          label: '向前删除一个单词（进 kill-ring）' },
      'editing.backward-kill-word': { key: 'M-Backspace',  label: '向后删除一个单词（进 kill-ring）' },
      'editing.kill-line':          { key: 'C-k',          label: '删除到行尾（kill-line，进 kill-ring）' },
      'editing.transpose-chars':    { key: 'C-t',          label: '交换两个字符位置' },
      'editing.transpose-words':    { key: 'M-t',          label: '交换两个单词位置' },
      'editing.undo':               { key: 'C-z',          label: '撤销' },
      'editing.redo':               { key: 'C-S-z',        label: '重做' },
      'editing.undo-alt':           { key: 'C-/',          label: '撤销（含 C-x u）' },
      'view.font-zoom-in':          { key: 'C-=',          label: '字号增大' },
      'view.font-zoom-out':         { key: 'C--',          label: '字号减小' },
      'region.copy':                { key: 'C-c',          label: '复制区域（接管浏览器 Ctrl+C）' },
      'region.yank':                { key: 'C-v',          label: 'Yank 粘贴（接管浏览器 Ctrl+V）' },
      'app.command-palette':        { key: 'M-x',          label: '打开命令面板' },
    }},
    { name: 'C-x 前缀', context: 'prefix:C-x', bindings: {
      'app.swap-point-mark': { key: 'C-x C-x', label: '交换光标位置与标记' },
      'session.next':        { key: 'C-x n',   label: '切换到下一个会话（含 C-x b）' },
      'session.prev':        { key: 'C-x p',   label: '切换到上一个会话' },
      'session.kill':        { key: 'C-x k',   label: '关闭当前会话' },
      'layout.cycle-panel':  { key: 'C-x o',   label: '切换到另一个面板' },
      'layout.close-right':  { key: 'C-x 0',   label: '关闭右侧面板' },
      'layout.maximize':     { key: 'C-x 1',   label: '最大化主区域（切换侧边栏）' },
      'editing.undo':        { key: 'C-x u',   label: '撤销' },
      'editing.select-all':  { key: 'C-x h',   label: '全选' },
      'app.reload-config':   { key: 'C-x C-r', label: '重新加载快捷键配置文件' },
    }},
    { name: '前缀启动键', context: 'prefix-start', bindings: {
      'app.prefix-c-x': { key: 'C-x', label: 'C-x 前缀（等待组合键）' },
      'app.prefix-c-u': { key: 'C-u', label: 'C-u 前缀（通用参数）' },
    }},
  ],
}

// ---------------------------------------------------------------------------
// Settings UI — renders the ACTIVE config tree (file or defaults)
// ---------------------------------------------------------------------------

function KeybindingSettings(props) {
  const { close, tree, source } = props
  return React.createElement('div', { className: 'emacs-keybinding-settings', style: {
    padding: '0 0 24px 0', fontSize: '13px', lineHeight: '1.6',
  } },
    React.createElement('h2', { style: { fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' } },
      'Emacs 快捷键'),
    React.createElement('p', { style: { color: 'var(--ds-muted, #888)', margin: '0 0 20px 0', fontSize: '12px' } },
      '当前配置来源：' + String(source || '未知')
      + '（工作区 emacs-keybindings.json，Emacs 记法：C=Ctrl M=Alt S=Shift SPC=空格，序列以空格分隔；C-x C-r 热重载）。'),
    ...tree.map((section) =>
      React.createElement('section', { key: section.name, style: { marginBottom: '24px' } },
        React.createElement('h3', {
          style: { fontSize: '13px', fontWeight: 600, margin: '0 0 8px 0',
            color: 'var(--ds-accent, #5b8def)', textTransform: 'uppercase', letterSpacing: '0.5px' },
        }, section.name),
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
          React.createElement('tbody', null,
            ...section.rows.map((row, i) =>
              React.createElement('tr', { key: i, style: { borderBottom: '1px solid var(--ds-border, #2a2a2a)' } },
                React.createElement('td', { style: { padding: '6px 8px 6px 0', whiteSpace: 'nowrap', verticalAlign: 'top', width: '1%' } },
                  React.createElement('kbd', {
                    style: { ...monoStyle(), padding: '2px 6px', borderRadius: '3px',
                      border: '1px solid var(--ds-border, #555)', background: 'var(--ds-kbd-bg, #333)',
                      color: 'var(--ds-fg, #e8e8e8)', fontSize: '11px', lineHeight: 1.4 },
                  }, row.key),
                ),
                React.createElement('td', { style: { padding: '6px 0', color: 'var(--ds-fg, #ccc)' } }, row.label),
              ),
            ),
          ),
        ),
      ),
    ),
  )
}

function monoStyle() {
  return { fontFamily: 'var(--ds-mono, monospace), monospace', fontSize: '12px',
    color: 'var(--ds-fg, #e8e8e8)' }
}

// ---------------------------------------------------------------------------
// Plugin body
// ---------------------------------------------------------------------------

return {
  async apply(ctx) {
    // ── optional Cordis services ─────────────────────────────────────────
    const layout = ctx.get('layout')
    const sessions = ctx.get('sessions')
    const timer = ctx.get('timer')
    const hostApi = typeof host !== 'undefined' ? host : null

    // ── config loading ───────────────────────────────────────────────────
    let config = DEFAULT_CONFIG
    let configSource = '内置默认（配置文件缺失或无效）'

    async function loadConfig() {
      if (hostApi === null) return false
      try {
        const res = await hostApi.call('emacs-keybindings:read', {})
        if (res && res.ok && typeof res.text === 'string') {
          const parsed = JSON.parse(res.text)
          if (parsed && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
            config = parsed
            configSource = 'emacs-keybindings.json'
            return true
          }
        }
      } catch { /* keep defaults */ }
      return false
    }

    // ── dispatch tables built from the config tree ───────────────────────
    // regionMap/globalMap/editingMap: canonical descriptor → actionId
    // prefixStarters: descriptor → prefix key (e.g. 'C-x')
    // prefixMaps: prefix key → (last-key descriptor → actionId)
    // uiTree: [{ name, rows: [{ key, label }] }] for the settings page
    let regionMap = {}
    let globalMap = {}
    let editingMap = {}
    let prefixStarters = {}
    let prefixMaps = {}
    let uiTree = []

    function rebuildTables() {
      regionMap = {}; globalMap = {}; editingMap = {}
      prefixStarters = {}; prefixMaps = {}; uiTree = []
      for (const category of config.categories) {
        if (!category || typeof category !== 'object') continue
        const context = String(category.context || 'global')
        const rows = []
        const bind = (notation, actionId) => {
          for (const variant of canonicalVariants(notation)) {
            if (context === 'region') regionMap[variant] = actionId
            else if (context === 'global') globalMap[variant] = actionId
            else if (context === 'editing') editingMap[variant] = actionId
            else if (context.startsWith('prefix:')) {
              const starter = canonicalKey(context.slice('prefix:'.length))
              const seqTokens = String(notation).trim().split(/\s+/)
              const lastVariants = canonicalVariants(seqTokens[seqTokens.length - 1])
              prefixStarters[starter] = starter
              const seq = prefixMaps[starter] || (prefixMaps[starter] = {})
              for (const variant of lastVariants) seq[variant] = actionId
            } else if (context === 'prefix-start') {
              const starter = canonicalKey(notation)
              prefixStarters[starter] = starter
            }
          }
        }
        const bindings = category.bindings || {}
        for (const actionId of Object.keys(bindings)) {
          const binding = bindings[actionId]
          if (!binding || typeof binding.key !== 'string') continue
          bind(binding.key, actionId)
          rows.push({ key: binding.key, label: String(binding.label || actionId) })
        }
        uiTree.push({ name: String(category.name || context), rows })
      }
    }

    await loadConfig()
    rebuildTables()

    // ── prefix-key state ─────────────────────────────────────────────────
    let prefix = null       // active starter key, e.g. "C-x"
    let prefixTimeout = null
    let markActive = false

    const PREFIX_MS = 3000

    function clearPrefix() {
      prefix = null
      if (prefixTimeout !== null) { prefixTimeout(); prefixTimeout = null }
    }

    function armPrefixTimeout() {
      if (prefixTimeout !== null) prefixTimeout()
      if (timer !== undefined) {
        prefixTimeout = timer.timeout(clearPrefix, PREFIX_MS)
      } else {
        const id = setTimeout(clearPrefix, PREFIX_MS)
        prefixTimeout = () => clearTimeout(id)
      }
    }

    // ── visual feedback (mini status bar via DOM) ───────────────────────
    let statusEl = null
    let flashTimeout = null

    function ensureStatus() {
      if (statusEl !== null) return statusEl
      const el = document.createElement('div')
      el.setAttribute('data-dsh-emacs-status', '')
      el.style.cssText = 'position:fixed;bottom:8px;right:12px;'
        + 'font-family:monospace;font-size:11px;'
        + 'padding:2px 8px;border-radius:4px;'
        + 'background:rgba(0,0,0,.65);color:#7ee787;'
        + 'pointer-events:none;z-index:9999;'
        + 'transition:opacity .15s;opacity:0;'
      document.body.appendChild(el)
      statusEl = el
      return el
    }

    function flashStatus(text) {
      const el = ensureStatus()
      el.textContent = text
      el.style.opacity = '1'
      if (flashTimeout !== null) { flashTimeout(); flashTimeout = null }
      if (timer !== undefined) {
        flashTimeout = timer.timeout(() => { el.style.opacity = '0' }, 1200)
      } else {
        const id = setTimeout(() => { el.style.opacity = '0' }, 1200)
        flashTimeout = () => clearTimeout(id)
      }
    }

    // ── action: conversation navigation ─────────────────────────────────
    function navigateMessage(dir) {
      const scroller = conversationScroller()
      if (scroller === null) return
      const step = scroller.clientHeight * 0.85
      const before = scroller.scrollTop
      scroller.scrollTop += dir * step
      // At the scroll edge a same-position result is invisible feedback;
      // report it so C-n at the bottom no longer looks dead.
      if (scroller.scrollTop === before) {
        flashStatus(dir > 0 ? '已到底部 (C-n)' : '已在顶部 (C-p)')
      }
    }

    function scrollConversation(dir) {
      const scroller = conversationScroller()
      if (scroller === null) return
      scroller.scrollTop += dir * (scroller.clientHeight * 0.9)
    }

    function gotoConversationEdge(top) {
      const scroller = conversationScroller()
      if (scroller === null) return
      scroller.scrollTop = top ? 0 : scroller.scrollHeight
    }

    // ── action: panel / layout ──────────────────────────────────────────
    function cyclePanel() { layout && layout.toggleSidebar && layout.toggleSidebar() }
    function closeRightPanel() { layout && layout.closeRightbar && layout.closeRightbar() }
    function toggleSidebar() { layout && layout.toggleSidebar && layout.toggleSidebar() }

    // ── action: session switching ───────────────────────────────────────
    function switchSession(dir) {
      window.dispatchEvent(new CustomEvent('dsh-emacs:switch-session', { detail: { dir } }))
      flashStatus(dir > 0 ? 'Next session' : 'Prev session')
    }

    // ── action: command palette ─────────────────────────────────────────
    function openCommandPalette() {
      window.dispatchEvent(new CustomEvent('dsh-emacs:command-palette'))
      flashStatus('M-x')
    }

    // ── action: isearch ─────────────────────────────────────────────────
    let lastSearchQuery = ''
    function startIsearch(forward) {
      const query = window.prompt(
        (forward ? 'I-search: ' : 'I-search backward: '),
        lastSearchQuery,
      )
      if (query === null || query === '') return
      lastSearchQuery = query
      window.dispatchEvent(new CustomEvent('dsh-emacs:isearch', { detail: { query, forward } }))
    }

    // ── composer editing helpers ────────────────────────────────────────
    /** The focused editable surface (textarea/input or Lexical contenteditable). */
    function activeEditor() {
      if (inTextInput()) return document.activeElement
      return composerEl()
    }

    /** Whether the editor is a classic text-like element (value + setSelectionRange). */
    function isTextLikeEditor(el) {
      return el !== null && typeof el === 'object'
        && 'setSelectionRange' in el && 'value' in el
    }

    /** Current {start, end, text} selection on either editor kind; null when none. */
    function editorSelection() {
      const el = activeEditor()
      if (el === null) return null
      if (isTextLikeEditor(el)) {
        const start = el.selectionStart === null ? 0 : el.selectionStart
        const end = el.selectionEnd === null ? start : el.selectionEnd
        return { start, end, text: el.value }
      }
      const sel = window.getSelection()
      if (sel === null || sel.rangeCount === 0) return null
      const range = sel.getRangeAt(0)
      const text = (range.endContainer.parentNode
        ? range.endContainer.parentNode.textContent : '') ?? ''
      return { start: sel.anchorOffset, end: sel.focusOffset, text }
    }

    /**
     * Move/work the caret in a contenteditable via the Selection.modify API.
     * `extend` keeps/extends the existing region (Emacs mark behaviour).
     * Returns false when the API is unavailable.
     */
    function modifySelection(unit, dir, extend) {
      const sel = window.getSelection()
      if (sel === null || typeof sel.modify !== 'function') return false
      try {
        sel.modify(extend === true ? 'extend' : 'move', dir, unit)
        return true
      } catch {
        return false
      }
    }

    function wordBoundaryForward(text, pos) {
      let i = pos
      while (i < text.length && /\w/.test(text[i])) i++
      while (i < text.length && /\W/.test(text[i])) i++
      return Math.min(i, text.length)
    }

    function wordBoundaryBackward(text, pos) {
      let i = pos
      while (i > 0 && /\W/.test(text[i - 1])) i--
      while (i > 0 && /\w/.test(text[i - 1])) i--
      return Math.max(i, 0)
    }

    // ── kill ring ────────────────────────────────────────────────────────
    let killRing = []
    let killRingIndex = 0
    let lastCommandWasYank = false

    function ringPush(text) {
      if (text === undefined || text === null || text === '') return
      killRing.unshift(text)
      if (killRing.length > 30) killRing.length = 30
      killRingIndex = 0
    }

    function ringTop() {
      return killRing.length > 0 ? killRing[0] : ''
    }

    /** Grab the current document selection into the kill ring (any context). */
    function stashSelectionToRing() {
      const sel = window.getSelection()
      if (sel === null || sel.rangeCount === 0) return false
      const text = sel.toString()
      if (text === '') return false
      ringPush(text)
      return true
    }

    /** Focus the composer and collapse its caret to the end. */
    function focusComposerAtEnd() {
      const el = composerEl()
      if (el === null) return false
      el.focus()
      if (isTextLikeEditor(el)) {
        el.setSelectionRange(el.value.length, el.value.length)
      } else {
        const sel = window.getSelection()
        if (sel !== null) {
          const range = document.createRange()
          range.selectNodeContents(el)
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
      return true
    }

    /**
     * Run a clipboard edit (cut/copy) one task later. Editors like Lexical
     * process `selectionchange` asynchronously; cutting synchronously inside
     * the keydown task races their model sync and the edit is swallowed.
     * A macrotask boundary lets the editor adopt the DOM selection first.
     */
    function runClipboardEdit(cmd) {
      const run = () => { try { document.execCommand(cmd) } catch { /* best effort */ } }
      if (timer !== undefined) timer.timeout(run, 0)
      else setTimeout(run, 0)
    }

    /** Insert text at the composer caret, preserving line breaks. */
    function insertIntoComposer(text) {
      const el = composerEl()
      if (el === null) return false
      if (!selectionInside(el) && document.activeElement !== el) {
        if (!focusComposerAtEnd()) return false
      }
      if (isTextLikeEditor(el)) {
        const s = editorSelection()
        el.setRangeText(text, s.start, s.end, 'end')
        return true
      }
      const parts = String(text).split('\n')
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] !== '') document.execCommand('insertText', false, parts[i])
        if (i < parts.length - 1) document.execCommand('insertLineBreak')
      }
      return true
    }

    // ── region commands — work with ANY document selection ──────────────
    function killRegion() {
      if (!stashSelectionToRing()) { flashStatus('无选中区域'); return }
      const composer = composerEl()
      const editable = inTextInput() || (composer !== null && selectionInside(composer))
      if (editable) {
        if (isTextLikeEditor(document.activeElement)) document.execCommand('cut')
        else runClipboardEdit('cut')
      } else {
        // Read-only content cannot be cut; behave as copy and say so.
        runClipboardEdit('copy')
        flashStatus('只读区域已复制 (C-w)')
        const sel = window.getSelection()
        if (sel !== null && sel.rangeCount > 0) sel.collapseToStart()
      }
      lastCommandWasYank = false
    }
    function copyRegion() {
      if (!stashSelectionToRing()) { flashStatus('无选中区域'); return }
      if (inTextInput() && isTextLikeEditor(document.activeElement)) document.execCommand('copy')
      else runClipboardEdit('copy')
      flashStatus('已复制 (M-w)')
      lastCommandWasYank = false
    }
    function yank() {
      const text = ringTop()
      if (text === '') { flashStatus('Kill ring 为空'); return }
      if (!insertIntoComposer(text)) { flashStatus('没有可粘贴的输入框'); return }
      killRingIndex = 0
      lastCommandWasYank = true
    }
    function yankPop() {
      if (killRing.length === 0) { flashStatus('Kill ring 为空'); return }
      if (!lastCommandWasYank) { flashStatus('yank-pop 需紧跟 C-y'); return }
      killRingIndex = (killRingIndex + 1) % killRing.length
      const text = killRing[killRingIndex]
      // Replace the previous yank: delete the just-inserted text, then insert.
      const el = composerEl()
      if (el !== null && isTextLikeEditor(el)) {
        const s = editorSelection()
        el.setRangeText(text, s.start, s.end, 'end')
      } else {
        // contenteditable: the previous yank left the caret at its end and no
        // selection; best effort is a fresh insert after collapsing selection.
        document.execCommand('insertText', false, text)
      }
      flashStatus('yank-pop: ' + killRingIndex)
      lastCommandWasYank = true
    }

    // ── editing primitives (textarea / input via selection, contenteditable via DOM) ──
    function moveBeginningOfLine() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) { el.setSelectionRange(0, 0); return }
      modifySelection('lineboundary', 'backward', markActive)
    }
    function moveEndOfLine() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) { el.setSelectionRange(el.value.length, el.value.length); return }
      modifySelection('lineboundary', 'forward', markActive)
    }
    function forwardChar() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection(); const pos = Math.max(s.start, s.end)
        el.setSelectionRange(pos + 1, pos + 1); return
      }
      modifySelection('character', 'forward', markActive)
    }
    function backwardChar() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection(); const pos = Math.min(s.start, s.end)
        el.setSelectionRange(Math.max(0, pos - 1), Math.max(0, pos - 1)); return
      }
      modifySelection('character', 'backward', markActive)
    }
    function forwardWord() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection(); const pos = s.end
        const next = wordBoundaryForward(el.value, pos)
        el.setSelectionRange(next, next); return
      }
      modifySelection('word', 'forward', markActive)
    }
    function backwardWord() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection(); const pos = s.start
        const next = wordBoundaryBackward(el.value, pos)
        el.setSelectionRange(next, next); return
      }
      modifySelection('word', 'backward', markActive)
    }
    function moveLineUp() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection()
        const pos = Math.min(s.start, s.end)
        const col = pos - (el.value.lastIndexOf('\n', pos - 1) + 1)
        const lineStart = el.value.lastIndexOf('\n', pos - 1) + 1
        if (lineStart === 0) { el.setSelectionRange(0, 0); return }
        const prevStart = el.value.lastIndexOf('\n', lineStart - 2) + 1
        const next = Math.min(prevStart + col, lineStart - 1)
        el.setSelectionRange(next, next); return
      }
      modifySelection('line', 'backward', markActive)
    }
    function moveLineDown() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection()
        const pos = Math.min(s.start, s.end)
        const nl = el.value.indexOf('\n', pos)
        if (nl === -1) { el.setSelectionRange(el.value.length, el.value.length); return }
        const nextNl = el.value.indexOf('\n', nl + 1)
        const nextLineEnd = nextNl === -1 ? el.value.length : nextNl
        const col = pos - (el.value.lastIndexOf('\n', pos - 1) + 1)
        const next = Math.min(nl + 1 + col, nextLineEnd)
        el.setSelectionRange(next, next); return
      }
      modifySelection('line', 'forward', markActive)
    }
    function deleteForward() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection()
        if (s.start === s.end) { el.setSelectionRange(s.start, Math.min(el.value.length, s.start + 1)) }
      }
      document.execCommand('delete')
      lastCommandWasYank = false
    }
    function deleteBackward() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection()
        if (s.start === s.end) { el.setSelectionRange(Math.max(0, s.start - 1), s.start) }
      }
      document.execCommand('backspace')
      lastCommandWasYank = false
    }
    function killWordForward() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection(); const pos = s.end
        const end = wordBoundaryForward(el.value, pos)
        ringPush(el.value.slice(pos, end))
        el.setSelectionRange(pos, end)
        document.execCommand('cut'); return
      }
      if (modifySelection('word', 'forward', true)) {
        stashSelectionToRing(); runClipboardEdit('cut')
      }
      lastCommandWasYank = false
    }
    function killWordBackward() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection(); const pos = s.start
        const start = wordBoundaryBackward(el.value, pos)
        ringPush(el.value.slice(start, pos))
        el.setSelectionRange(start, pos)
        document.execCommand('cut'); return
      }
      if (modifySelection('word', 'backward', true)) {
        stashSelectionToRing(); runClipboardEdit('cut')
      }
      lastCommandWasYank = false
    }
    function killLine() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection()
        const start = Math.min(s.start, s.end)
        const nl = el.value.indexOf('\n', start)
        const end = nl === -1 ? el.value.length : nl
        ringPush(el.value.slice(start, end))
        el.setSelectionRange(start, end)
        document.execCommand('cut'); return
      }
      if (modifySelection('lineboundary', 'forward', true)) {
        stashSelectionToRing(); runClipboardEdit('cut')
      }
      lastCommandWasYank = false
    }
    function undo() { document.execCommand('undo'); lastCommandWasYank = false }
    function redo() { document.execCommand('redo'); lastCommandWasYank = false }
    function transposeChars() {
      const el = activeEditor()
      if (el === null) return
      if (isTextLikeEditor(el)) {
        const s = editorSelection()
        const pos = Math.min(s.start, s.end)
        if (pos < 2) return
        const v = el.value
        el.value = v.slice(0, pos - 2) + v[pos - 1] + v[pos - 2] + v.slice(pos)
        el.setSelectionRange(pos, pos); return
      }
      // contenteditable: select two chars back + cut then insert swapped — best effort
      flashStatus('C-t transpose (contenteditable best-effort)')
    }
    function transposeWords() {
      flashStatus('M-t transpose words (best-effort)')
    }
    function setMark() {
      markActive = true
      flashStatus('Mark 已设置 (C-x C-x 交换点/标记)')
    }
    function swapPointAndMark() {
      if (markActive) {
        // Swap: fold the region so the point jumps to the mark. For text-like
        // editors we can swap start/end; for contenteditable collapse to anchor.
        const el = activeEditor()
        if (isTextLikeEditor(el)) {
          const s = editorSelection()
          el.setSelectionRange(s.end, s.start === s.end ? s.end : s.start)
        }
        flashStatus('交换点与标记')
        return
      }
      flashStatus('无标记 (C-SPC 设置标记)')
    }
    function selectAll() {
      const el = activeEditor()
      if (el !== null && isTextLikeEditor(el)) {
        el.setSelectionRange(0, el.value.length)
      } else {
        document.execCommand('selectAll')
      }
    }
    function adjustFontSize(delta) {
      const themeSvc = ctx.get('theme')
      if (themeSvc !== undefined && typeof themeSvc.setFontSize === 'function') {
        let cur = 13
        const snap = themeSvc.getTheme()
        if (snap !== undefined && typeof snap.fontSize === 'number') cur = snap.fontSize
        const next = delta === 0 ? 13 : Math.max(9, Math.min(28, cur + delta))
        themeSvc.setFontSize(next)
        flashStatus('字号 ' + next + 'px')
        return
      }
      flashStatus(delta === 0 ? '字号重置 (13px)' : (delta > 0 ? '增大字号' : '减小字号'))
    }
    async function reloadConfig() {
      const loaded = await loadConfig()
      rebuildTables()
      mountSettings()
      flashStatus(loaded
        ? '快捷键配置已重载 (C-x C-r)'
        : '配置读取失败，沿用当前配置')
    }

    // ── action registry: actionId → implementation, per dispatch context ─
    const IMPL = {
      region: {
        'region.kill': killRegion,
        'region.copy': copyRegion,
        'region.yank': yank,
        'region.yank-pop': yankPop,
      },
      global: {
        'nav.up': () => navigateMessage(-1),
        'nav.down': () => navigateMessage(1),
        'nav.page-down': () => scrollConversation(1),
        'nav.page-up': () => scrollConversation(-1),
        'nav.top': () => gotoConversationEdge(true),
        'nav.bottom': () => gotoConversationEdge(false),
        'nav.isearch-forward': () => startIsearch(true),
        'nav.isearch-backward': () => startIsearch(false),
        'session.prev-alt': () => switchSession(-1),
        'session.next-alt': () => switchSession(1),
        'view.font-zoom-in': () => adjustFontSize(1),
        'view.font-zoom-out': () => adjustFontSize(-1),
        'view.font-reset': () => adjustFontSize(0),
        'app.keyboard-quit': () => {
          clearPrefix()
          markActive = false
          window.dispatchEvent(new CustomEvent('dsh-emacs:keyboard-quit'))
          flashStatus('Quit')
        },
        'app.command-palette': openCommandPalette,
      },
      editing: {
        'editing.beginning-of-line': moveBeginningOfLine,
        'editing.end-of-line': moveEndOfLine,
        'editing.forward-char': forwardChar,
        'editing.backward-char': backwardChar,
        'editing.forward-word': forwardWord,
        'editing.backward-word': backwardWord,
        'editing.previous-line': moveLineUp,
        'editing.next-line': moveLineDown,
        'nav.top': moveBeginningOfLine,
        'nav.bottom': moveEndOfLine,
        'nav.isearch-forward': () => startIsearch(true),
        'nav.isearch-backward': () => startIsearch(false),
        'editing.delete-char': deleteForward,
        'editing.backward-kill-char': deleteBackward,
        'editing.kill-word': killWordForward,
        'editing.backward-kill-word': killWordBackward,
        'editing.kill-line': killLine,
        'editing.transpose-chars': transposeChars,
        'editing.transpose-words': transposeWords,
        'editing.undo': undo,
        'editing.redo': redo,
        'editing.undo-alt': undo,
        'editing.set-mark': setMark,
        'view.font-zoom-in': () => adjustFontSize(1),
        'view.font-zoom-out': () => adjustFontSize(-1),
        'region.copy': copyRegion,
        'region.yank': yank,
        'app.command-palette': openCommandPalette,
      },
      prefix: {
        'app.swap-point-mark': swapPointAndMark,
        'session.next': () => switchSession(1),
        'session.prev': () => switchSession(-1),
        'session.kill': () => window.dispatchEvent(new CustomEvent('dsh-emacs:kill-session')),
        'layout.cycle-panel': cyclePanel,
        'layout.close-right': closeRightPanel,
        'layout.maximize': toggleSidebar,
        'editing.undo': undo,
        'editing.select-all': selectAll,
        'app.reload-config': reloadConfig,
        'app.prefix-c-u': () => flashStatus('C-u (universal arg — simplified)'),
      },
    }

    function runAction(context, actionId) {
      const table = IMPL[context]
      const fn = table ? table[actionId] : undefined
      if (typeof fn !== 'function') return false
      try {
        const result = fn()
        if (result && typeof result.catch === 'function') {
          result.catch((err) => { flashStatus('命令失败: ' + String(err && err.message || err)) })
        }
      } catch (err) {
        flashStatus('命令失败: ' + String(err && err.message || err))
      }
      return true
    }

    // ── the big keydown dispatcher ───────────────────────────────────────
    /**
     * Is this combination a browser/system key the plugin MUST NOT steal?
     * Only keys a page script genuinely cannot preventDefault() — tab &
     * window management, DevTools, tab switching, plus IME. Clipboard,
     * undo/redo, history navigation and zoom are ALL taken over by the
     * plugin: the plugin's own commands implement copy/kill/yank/undo and
     * font-size adjustments, so the browser default never runs.
     * NOTE: Ctrl+W is bound globally (kill-region), so it is NOT essential;
     * Ctrl+T / Ctrl+Tab / Ctrl+1-9 remain unbindable.
     */
    function isBrowserEssential(event) {
      const k = (event.key || '').toLowerCase()
      const ctrl = event.ctrlKey
      const alt = event.altKey
      const meta = event.metaKey
      const shift = event.shiftKey

      // IME composition must never be hijacked
      if (event.isComposing === true || event.keyCode === 229) return true

      // F-keys are browser/system owned (F5 refresh, F12 DevTools, …)
      if (/^f\d{1,2}$/.test(k) && !ctrl && !alt && !meta) return true

      // Tab / window management — cannot be prevented by page scripts
      if (ctrl && !alt && !meta) {
        if (k === 't' || k === 'tab') return true              // new tab, switch
        if (/^[1-9]$/.test(k)) return true                     // Ctrl+1..9 switch tab
      }

      // DevTools / incognito / hard-refresh — Ctrl|Meta+Shift+*
      if (shift && (ctrl || meta)) return true

      // Meta (Cmd) combinations that are OS-level (Cmd+Tab etc.)
      if (meta && !ctrl && !alt && k === 'tab') return true
      if (meta && shift && k === 'q') return true

      return false
    }

    function onKeyDown(event) {
      // Modifier presses are not chords — never treat them as bindings.
      if (isModifierKey(event)) return

      const desc = describeKey(event)

      // Universal cancel — always ours
      if (desc === 'C-g') {
        event.preventDefault()
        event.stopPropagation()
        clearPrefix()
        markActive = false
        window.dispatchEvent(new CustomEvent('dsh-emacs:keyboard-quit'))
        flashStatus('Quit')
        return
      }

      // Prefix continuation: C-x <key> etc.
      if (prefix !== null) {
        event.preventDefault()
        event.stopPropagation()
        const starter = prefix
        const seq = prefixMaps[starter]
        const actionId = seq ? seq[desc] : undefined
        clearPrefix()
        if (actionId === undefined) { flashStatus(starter + ' ' + desc + ' undefined'); return }
        runAction('prefix', actionId)
        return
      }

      // Prefix starter (C-x / C-u): arm the sequence and wait.
      if (prefixStarters[desc] !== undefined) {
        event.preventDefault()
        event.stopPropagation()
        prefix = desc
        armPrefixTimeout()
        flashStatus(desc)
        return
      }

      // Region keys (C-w / M-w / C-y / M-y) work with the document selection
      // in EVERY focus context — not only inside the composer.
      if (regionMap[desc] !== undefined) {
        event.preventDefault()
        event.stopPropagation()
        runAction('region', regionMap[desc])
        return
      }

      // Emacs dispatch (global nav / editing), driven by the config maps.
      const inInput = inTextInput()
      const map = inInput ? editingMap : globalMap
      const context = inInput ? 'editing' : 'global'
      const actionId = map[desc]
      if (actionId !== undefined) {
        event.preventDefault()
        event.stopPropagation()
        runAction(context, actionId)
        return
      }

      // Not bound by the Emacs map, but a Ctrl/Alt combo the browser would
      // otherwise claim (print/find/history/address bar/…). Prevent the
      // browser default and show a short notice instead of letting it slip.
      if (event.ctrlKey || event.altKey) {
        if (!isBrowserEssential(event)) {
          event.preventDefault()
          event.stopPropagation()
          flashStatus(desc + ' 未绑定 (C-g 退出)')
        }
        return
      }

      // Meta-only or unmodified keys pass through untouched.
    }

    // ── install the listener via ctx.effect ─────────────────────────────
    ctx.effect(() => {
      window.addEventListener('keydown', onKeyDown, true)
      return () => {
        window.removeEventListener('keydown', onKeyDown, true)
        clearPrefix()
        if (statusEl !== null) { statusEl.remove(); statusEl = null }
      }
    })

    // ── settings section: renders the ACTIVE config tree ────────────────
    const slots = ctx.get('slots')
    function mountSettings() {
      if (slots === undefined) return
      slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'emacs-key-binding', order: 35, label: 'Emacs 快捷键' },
        (props) => React.createElement(KeybindingSettings, {
          close: props.close, tree: uiTree, source: configSource,
        }),
      ))
    }
    mountSettings()
  },
}