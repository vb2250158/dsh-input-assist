/** Native composer provider and independent model settings; no DOM editor access. */
import * as React from 'react'
import { Button, Menu, Modal, Input, InlineEditor, Switch, Tooltip, StateDot, IconSparkleRegular, IconSettingsOutlineRegular, IconClockOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { createSnapshotStore } from './snapshot-store.ts'
import { createCompletionActivity } from './completion-activity.ts'
export { createCompletionActivity } from './completion-activity.ts'
import { createCompletionSettingsCache } from './completion-settings-cache.ts'
export { createCompletionSettingsCache } from './completion-settings-cache.ts'
import type { CompletionSettingsState } from './completion-settings-cache.ts'
import { NATIVE_DEFAULTS, NATIVE_NS } from './native-config.ts'
import type { NativeConfig } from './native-config.ts'
import { CompletionRecords, recordDictionaries } from './completion-record-ui.ts'
import type { CompletionSessionSources } from './completion-source.ts'
import { openCompletionSource } from './completion-source.ts'
export { completionSource, openCompletionSource } from './completion-source.ts'
export { CompletionRecords, completionRecordMatches } from './completion-record-ui.ts'
import { NATIVE_UI_STYLE } from './native-ui-style.ts'
export const inject = ['slots', 'locale', 'connection', 'modelPickers', 'remote', 'sessions', 'uiWorkspace']
const h = React.createElement
const RPC = '/api/input-completion/rpc'
const STREAM = '/api/input-completion/stream'
interface CompletionProvider {
  debounceMs: number; timeoutMs: number; maxCharacters: number
  complete(request: { prefix: string; signal: AbortSignal }): AsyncIterable<string>
  onError(message: string): void
}
interface Props {
  sessionId: string
  ModelPicker: React.ComponentType<{ onOpenChange?: (open: boolean) => void; sessionId: string; current: { provider: string; model: string } | null; locked: boolean; select: (selection: { provider: string; model: string }) => void }>
  register?: (provider: CompletionProvider) => () => void
  useConfig: <T>(select: (value: NativeConfig) => T) => T
  useSettingsState: <T>(select: (value: CompletionSettingsState) => T) => T
  useClipboard: <T>(select: (value: { text: string }) => T) => T
  useActivity: <T>(select: (value: { sessions: Record<string, boolean> }) => T) => T
  t: (key: string) => string
}
interface Context {
  sessions: CompletionSessionSources
  uiWorkspace: { openSession(target: string | NonNullable<ReturnType<CompletionSessionSources['subagentAddress']>>): void }
  on(name: 'connection/reset', listener: () => void): () => void
  remote: { $on(name: 'settings/document-updated', listener: (ns: string, revision: number) => void): () => void }
  modelPickers: { Picker: Props['ModelPicker'] }
  effect(callback: () => void | (() => void)): void
  locale: { register(ns: string, dictionaries: Record<string, Record<string, string>>): void }
  slots: {
    inject(name: string, callback: () => unknown): void
    register(meta: object, component: React.ComponentType<Props>): unknown
  }
}
const uxDictionaries = {
  "zh": {
    "contextSection": "参考内容",
    "promptSection": "续写方式",
    "timingSection": "速度与长度",
    "readyHint": "停顿后显示建议，Tab 接受，Esc 忽略。",
    "disabledHint": "补齐已关闭。",
    "saving": "保存中…",
    "retry": "重试",
    "invalidNumber": "数值需填写完整的非负整数。",
    "authRequired": "页面登录已失效，请从 DSH 重新打开此页面后重试。",
    "requestForbidden": "补齐请求被宿主拒绝，请检查当前页面是否来自 DSH 的正式入口。",
    "httpFailure": "补齐服务请求失败（HTTP {status}），请稍后重试。",
    "invalidResponse": "补齐服务返回了无法识别的响应，请重试。"
  },
  "en": {
    "contextSection": "Reference content",
    "promptSection": "Continuation instructions",
    "timingSection": "Speed and length",
    "readyHint": "Suggestions appear after a pause. Tab accepts; Esc dismisses.",
    "disabledHint": "Completion is disabled.",
    "saving": "Saving…",
    "retry": "Retry",
    "invalidNumber": "Enter a complete non-negative integer.",
    "authRequired": "Your page login has expired. Reopen this page from DSH and retry.",
    "requestForbidden": "The Host refused the completion request. Check that this page was opened from DSH.",
    "httpFailure": "The completion service request failed (HTTP {status}). Try again later.",
    "invalidResponse": "The completion service returned an unrecognized response. Retry the request."
  }
}
const dictionaries = {
  zh: { ...uxDictionaries.zh, ...recordDictionaries.zh, completing: '正在补齐…', button: '补齐', title: '输入补齐', settings: '补齐设置', close: '关闭', back: '返回', save: '保存', cancel: '取消', enabled: '启用补齐', provider: '提供商', model: '补齐模型', choose: '请选择', search: '搜索模型', delay: '停顿时间（ms）', timeout: '请求超时（ms）', length: '输出上限（tokens）', characters: '建议长度上限（字符）', context: '当前草稿前文（最多字符）', history: '参考最近的会话消息', tools: '包含工具调用与返回', files: '包含变动文件信息', excludeUsers: '排除用户消息', finalOnly: '仅参考最终总结回复', fileHint: '文件信息取已完成工具记录中的路径、操作和变更片段行数，不读取工作区文件内容。', historyCount: '参考条目上限', historyLength: '会话参考上限（字符）', clipboard: '参考已读取的剪贴板', clipboardRead: '读取剪贴板', clipboardClear: '清除', clipboardEmpty: '尚未读取', clipboardReady: '已读取字符数', clipboardLength: '剪贴板参考上限（字符）', clipboardHint: '仅点击读取时获取，内容只在当前页面临时保留；刷新或清除后需重新读取。勾选后会随补齐请求发送给所选模型。', prompt: '补齐提示词', promptHint: '只让模型续写，不回答请求。Shift+Enter 换行。', hint: 'Tab 接受，Esc 忽略。模型调用会产生费用，选中的参考内容会记录到本机会话日志。', unsupported: '宿主缺少补齐接口，请应用仓库配套补丁并重建。', error: '补齐失败', custom: '自定义模型 ID', loading: '加载补齐设置…' },
  en: { ...uxDictionaries.en, ...recordDictionaries.en, completing: 'Completing…', button: 'Complete', title: 'Input completion', settings: 'Completion settings', close: 'Close', back: 'Back', save: 'Save', cancel: 'Cancel', enabled: 'Enable completion', provider: 'Provider', model: 'Completion model', choose: 'Choose', search: 'Search models', delay: 'Pause (ms)', timeout: 'Timeout (ms)', length: 'Output limit (tokens)', characters: 'Suggestion limit (characters)', context: 'Draft context limit (characters)', history: 'Reference recent conversation messages', tools: 'Include tool calls and results', files: 'Include file changes', excludeUsers: 'Exclude user messages', finalOnly: 'Use final replies only', fileHint: 'File references use completed tool metadata: paths, operations and snippet line counts. No workspace files are read.', historyCount: 'Reference item limit', historyLength: 'History limit (characters)', clipboard: 'Reference captured clipboard', clipboardRead: 'Read clipboard', clipboardClear: 'Clear', clipboardEmpty: 'Not captured', clipboardReady: 'Captured characters', clipboardLength: 'Clipboard limit (characters)', clipboardHint: 'Read only on click, kept temporarily in this page. Refreshing or clearing requires another capture. When enabled, the captured text is sent to the selected model.', prompt: 'Completion prompt', promptHint: 'Ask for continuation, not an answer. Shift+Enter inserts a line break.', hint: 'Tab accepts; Esc dismisses. Model calls incur costs. Selected references are recorded in the local session log.', unsupported: 'Apply the companion composer patch and rebuild the Host.', error: 'Completion failed', custom: 'Custom model ID', loading: 'Loading completion settings…' },
}
/** Post a settings request through the served page's authenticated same-origin transport. */
export async function nativeRpc<T>(endpoint: string, payload?: unknown): Promise<T> {
  const response = await fetch(RPC, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint, payload }) })
  if (!response.ok) throw await responseError(response)
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('input-assist/invalid-response')
  const result = await response.json() as { ok: boolean; value: T; error?: string }
  if (!result.ok) throw new Error(result.error ?? String(response.status))
  return result.value
}

/** Stream one draft request; browser cookies stay owned by the existing login session. */
export async function* requestCompletion(prefix: string, sessionId: string, signal: AbortSignal, clipboard?: string): AsyncIterable<string> {
  const response = await fetch(STREAM, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefix, sessionId, clipboard }), signal })
  yield* readCompletionStream(response, signal)
}

export async function* readCompletionStream(response: Response, signal: AbortSignal): AsyncIterable<string> {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    if (!response.ok) throw await responseError(response)
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('input-assist/invalid-response')
    const data = await response.json() as { error?: string; done?: string }
    if (data.error) throw new Error(data.error)
    return
  }
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      signal.throwIfAborted()
      const next = await reader.read()
      if (next.done) break
      buffer += decoder.decode(next.value, { stream: true }).replace(/\r\n/g, '\n')
      let index: number
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6)) as { delta?: string; error?: string; done?: boolean }
          if (data.error) throw new Error(data.error)
          if (typeof data.delta === 'string') yield data.delta
          if (data.done) return
        }
      }
    }
  } finally {
    // Cancellation may already have closed the browser fetch body.
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function responseError(response: Response): Promise<Error> {
  if (response.status === 401 || response.status === 403) return new Error(`input-assist/http-${response.status}`)
  if (response.headers.get('content-type')?.includes('application/json')) {
    const data = await response.json() as { error?: string }
    if (typeof data.error === 'string' && data.error) return new Error(data.error)
  }
  return new Error(`input-assist/http-${response.status}`)
}

/** Localize transport failures without exposing a proxy response body.
 * @param message - transport or upstream error message.
 * @param t - completion dictionary lookup.
 * @returns actionable transport copy or the unchanged upstream error.
 */
export function formatCompletionError(message: string, t: (key: string) => string): string {
  const token = message.replace(/^Error: /u, '')
  if (token === 'input-assist/invalid-response') return t('invalidResponse')
  const match = /^input-assist\/http-(\d+)$/u.exec(token)
  if (!match) return message
  if (match[1] === '401') return t('authRequired')
  if (match[1] === '403') return t('requestForbidden')
  return t('httpFailure').replace('{status}', match[1]!)
}

/** Register the native provider only while the plugin and settings are active. */
export function apply(ctx: Context): void {
  const settings = createCompletionSettingsCache(() => nativeRpc<NativeConfig>('config.get'), { ...NATIVE_DEFAULTS, enabled: false })
  const config = settings.config
  const clipboard = createSnapshotStore({ text: '' })
  ctx.effect(() => () => { clipboard.set({ text: '' }) })
  const activity = createCompletionActivity()
  ctx.locale.register(NATIVE_NS, dictionaries)
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.pluginCss = 'dsh-input-assist/native'
    style.textContent = NATIVE_UI_STYLE
    document.head.append(style)
    return () => style.remove()
  })
  ctx.effect(() => {
    void settings.ensureLoaded()
    return () => settings.dispose()
  })
  ctx.effect(() => ctx.remote.$on('settings/document-updated', ns => { if (ns === NATIVE_NS) void settings.refresh() }))
  ctx.effect(() => ctx.on('connection/reset', () => { void settings.reset() }))
  function Binding({ register, useConfig, useClipboard, sessionId, t }: Props): React.ReactNode {
    const value = useConfig(value => value)
    const captured = useClipboard(value => value.text)
    const [error, setError] = React.useState('')
    React.useEffect(() => {
      setError('')
      if (!register || !value.enabled || !value.provider || !value.model) return
      return register({
        debounceMs: value.debounceMs, timeoutMs: value.timeoutMs, maxCharacters: value.maxCharacters,
        async *complete(request) {
          setError('')
          yield* activity.track(sessionId, request.signal, () => requestCompletion(request.prefix, sessionId, request.signal, value.includeClipboard && captured ? captured.slice(0, value.maxClipboardCharacters) : undefined))
        },
        onError: setError,
      })
    }, [register, value, sessionId, captured])
    return error ? h('div', { className: 'dsh-completion-error', role: 'status' }, `${t('error')}: ${formatCompletionError(error, t)}`) : null
  }
  function Control({ useConfig, useSettingsState, useClipboard, useActivity, ModelPicker, sessionId, t }: Props): React.ReactNode {
    const current = useConfig(value => value)
    const settingsState = useSettingsState(value => value)
    const pending = useActivity(value => value.sessions[sessionId] ?? false)
    const captured = useClipboard(value => value.text)
    const [open, setOpen] = React.useState(false)
    const [recordsOpen, setRecordsOpen] = React.useState(false)
    const [advanced, setAdvanced] = React.useState(false)
    const [pickerOpen, setPickerOpen] = React.useState(false)
    const [form, setForm] = React.useState(current)
    const loading = !settingsState.ready && settingsState.loading
    const [error, setError] = React.useState('')
    const [saving, setSaving] = React.useState(false)
    const [numericDrafts, setNumericDrafts] = React.useState<Record<string, string>>({})
    const invalidNumber = Object.entries(numericDrafts).some(([key, value]) => {
      if (key === 'maxClipboardCharacters' && !form.includeClipboard) return false
      if ((key === 'historyMessageLimit' || key === 'maxHistoryCharacters') && !form.includeHistory) return false
      return !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))
    })
    const displayError = formatCompletionError(error || settingsState.error, t)
    const rpc = React.useCallback(async <T,>(endpoint: string, payload?: unknown): Promise<T> => {
      try { return await nativeRpc<T>(endpoint, payload) }
      catch (error) { throw new Error(formatCompletionError(String(error), t)) }
    }, [t])
    const close = (): void => { setOpen(false) }
    const load = (): void => {
      if (open) { close(); return }
      setForm(current); setNumericDrafts({}); setError(''); setOpen(true)
      void settings.ensureLoaded()
    }
    React.useEffect(() => { if (settingsState.ready) setForm(config.getSnapshot()) }, [settingsState.ready])
    const toggle = (key: 'includeHistory' | 'includeClipboard' | 'includeToolCalls' | 'includeFileChanges' | 'excludeUserMessages' | 'excludeIntermediateAssistant', label: string): React.ReactNode => h('div', { className: 'dsh-completion-enable' }, h('span', null, t(label)), h(Switch, { checked: form[key], label: t(label), onChange: (checked: boolean) => setForm({ ...form, [key]: checked }) }))
    const field = (key: 'debounceMs' | 'timeoutMs' | 'maxTokens' | 'maxCharacters' | 'maxInputCharacters' | 'historyMessageLimit' | 'maxHistoryCharacters' | 'maxClipboardCharacters', label: string): React.ReactNode => h('label', { className: 'dsh-completion-row' }, t(label), h(Input, { type: 'text', inputMode: 'numeric', value: numericDrafts[key] ?? String(form[key]), 'aria-invalid': numericDrafts[key] !== undefined && !/^\d+$/u.test(numericDrafts[key]!), onChange: (event: React.ChangeEvent<HTMLInputElement>) => { const text = event.target.value; setNumericDrafts({ ...numericDrafts, [key]: text }); if (/^\d+$/u.test(text) && Number.isSafeInteger(Number(text))) setForm({ ...form, [key]: Number(text) }) } }))
    const section = (title: string, ...children: React.ReactNode[]): React.ReactNode => h('section', { className: 'dsh-completion-settings-section' }, h('h3', null, t(title)), ...children)
    const save = async (): Promise<void> => {
      if (saving || invalidNumber) return
      setSaving(true)
      try { const readback = await rpc<NativeConfig>('config.set', form); settings.commit(readback); close(); setAdvanced(false) }
      catch (error) { setError(String(error)) }
      finally { setSaving(false) }
    }
    const capture = async (): Promise<void> => {
      try { clipboard.set({ text: (await navigator.clipboard.readText()).slice(0, form.maxClipboardCharacters) }); setError('') }
      catch (error) { setError(String(error)) }
    }
    return h(React.Fragment, null,
      h('span', { 'data-input-completion-settings': true }, h(Menu, {
        open, onClose: () => { if (!pickerOpen) close() }, side: 'top', align: 'end', portal: true, listClassName: `dsh-completion-popover${pickerOpen ? ' dsh-completion-behind-dialog' : ''}`,
        anchor: h(Tooltip, { label: pending ? t('completing') : t('title'), side: 'top', portal: true, disabled: open, children: h(Button, { size: 'sm', variant: 'ghost', className: 'dsh-completion-icon', 'aria-label': pending ? t('completing') : t('title'), 'aria-busy': pending, 'aria-expanded': open, onClick: load }, pending ? h(StateDot, { state: 'ongoing', size: 18 }) : h(IconSparkleRegular, { size: 18 })) as React.ComponentProps<typeof Tooltip>['children'] }),
      },
        h('div', { className: 'dsh-completion-heading' }, h('strong', null, t('title')),
          h('div', { className: 'dsh-completion-actions' },
          h(Button, { size: 'sm', variant: 'ghost', className: 'dsh-completion-icon', 'aria-label': t('records'), onClick: () => { close(); setRecordsOpen(true) } }, h(IconClockOutlineRegular, { size: 16 })),
          h(Button, { size: 'sm', variant: 'ghost', className: 'dsh-completion-icon', 'aria-label': t('settings'), disabled: !settingsState.ready, onClick: () => { close(); setAdvanced(true) } }, h(IconSettingsOutlineRegular, { size: 16 })))),
        loading ? h('div', { className: 'dsh-completion-note', role: 'status' }, t('loading')) : null,
        h('div', { className: 'dsh-completion-enable' }, h('span', null, t('enabled')), h(Switch, { checked: form.enabled, label: t('enabled'), onChange: (enabled: boolean) => setForm({ ...form, enabled }) })),
        h('div', { className: 'dsh-completion-picker' }, h('div', { className: 'dsh-completion-note' }, t('model')),
          h(ModelPicker, { sessionId, onOpenChange: setPickerOpen, locked: !settingsState.ready || saving, current: form.provider && form.model ? {provider: form.provider, model: form.model} : null, select: selection => setForm({ ...form, provider: selection.provider, model: selection.model }) })),
        h('div', { className: 'dsh-completion-note' }, pending ? t('completing') : form.enabled ? t('readyHint') : t('disabledHint')),
        h('div', { className: 'dsh-completion-footer' }, h(Button, { size: 'sm', variant: 'primary', disabled: !settingsState.ready || saving, onClick: () => { void save() } }, saving ? t('saving') : t('save'))),
        displayError ? h('div', { className: 'dsh-completion-note', role: 'alert' }, displayError) : null,
        settingsState.error ? h(Button, { size: 'sm', onClick: () => { void settings.refresh() } }, t('retry')) : null,
      )),
      h(CompletionRecords, { open: recordsOpen, onClose: () => setRecordsOpen(false), rpc, t, sources: ctx.sessions, openSession: (id: string) => openCompletionSource(ctx.sessions, target => ctx.uiWorkspace.openSession(target), id) }),
      h(Modal, { open: advanced, onClose: () => setAdvanced(false), title: t('settings'), closeLabel: t('close'),
        className: 'dsh-completion-dialog', contentClassName: 'dsh-completion-content',
        footer: h('div', { className: 'dsh-completion-footer' }, h(Button, { disabled: saving, onClick: () => setAdvanced(false) }, t('cancel')), h(Button, { variant: 'primary', disabled: saving || invalidNumber, onClick: () => { void save() } }, saving ? t('saving') : t('save'))),
      },
        h('div', { className: 'dsh-completion-settings' },
          section('contextSection', field('maxInputCharacters', 'context'),
          toggle('includeHistory', 'history'),
          form.includeHistory ? h('div', { className: 'dsh-completion-dependent' }, h('div', { className: 'dsh-completion-pair' }, field('historyMessageLimit', 'historyCount'), field('maxHistoryCharacters', 'historyLength')), toggle('excludeUserMessages', 'excludeUsers'), toggle('excludeIntermediateAssistant', 'finalOnly'), toggle('includeToolCalls', 'tools'), toggle('includeFileChanges', 'files'), form.includeFileChanges ? h('div', { className: 'dsh-completion-note' }, t('fileHint')) : null) : null,
          toggle('includeClipboard', 'clipboard'),
          form.includeClipboard ? h(React.Fragment, null, field('maxClipboardCharacters', 'clipboardLength'),
            h('div', { className: 'dsh-completion-capture' }, h(Button, { size: 'sm', onClick: () => { void capture() } }, t('clipboardRead')), h(Button, { size: 'sm', disabled: !captured, onClick: () => clipboard.set({ text: '' }) }, t('clipboardClear')), h('span', { role: 'status' }, captured ? `${t('clipboardReady')}: ${captured.length}` : t('clipboardEmpty'))),
            h('div', { className: 'dsh-completion-note' }, t('clipboardHint'))) : null),
          section('promptSection', h('label', { className: 'dsh-completion-row' }, t('prompt'), h(InlineEditor, { value: form.systemPrompt, label: t('prompt'), onChange: (systemPrompt: string) => setForm({ ...form, systemPrompt }), onSave: () => { void save() }, onCancel: () => setAdvanced(false) })),
          h('div', { className: 'dsh-completion-note' }, t('promptHint'))),
          section('timingSection',
          h('div', { className: 'dsh-completion-pair' }, field('debounceMs', 'delay'), field('timeoutMs', 'timeout')),
          h('div', { className: 'dsh-completion-pair' }, field('maxTokens', 'length'), field('maxCharacters', 'characters'))),
          h('div', { className: 'dsh-completion-note' }, t('hint')),
          invalidNumber ? h('div', { role: 'alert' }, t('invalidNumber')) : null,
          displayError ? h('div', { role: 'alert' }, displayError) : null,
        )),
    )
  }
  ctx.slots.inject('conversation.input.completion', () => ctx.slots.register({ name: 'conversation.input.completion', locale: NATIVE_NS, inject: () => ({ hooks: { config, clipboard } }) }, Binding))
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({ name: 'conversation.input.right', id: 'input-completion-settings', order: 25, locale: NATIVE_NS, inject: () => ({ ModelPicker: ctx.modelPickers.Picker, hooks: { config, settingsState: settings.state, clipboard, activity: activity.store } }) }, Control))
}
