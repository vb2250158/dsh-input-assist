/** Native composer provider and independent model settings; no DOM editor access. */
import * as React from 'react'
import { Button, Menu, MenuItemButton, Modal, Input, InlineEditor, Switch, Checkbox, Tooltip, IconSparkleRegular, IconSettingsOutlineRegular, IconChevronRightOutlineRegular, IconChevronLeftOutlineRegular, IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { createSnapshotStore } from './snapshot-store.ts'
import { NATIVE_DEFAULTS, NATIVE_NS } from './native-config.ts'
import type { NativeConfig } from './native-config.ts'
import { NATIVE_UI_STYLE } from './native-ui-style.ts'
export const inject = ['slots', 'locale', 'connection']
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
  register?: (provider: CompletionProvider) => () => void
  useConfig: <T>(select: (value: NativeConfig) => T) => T
  useClipboard: <T>(select: (value: { text: string }) => T) => T
  t: (key: string) => string
}
interface Context {
  effect(callback: () => void | (() => void)): void
  locale: { register(ns: string, dictionaries: Record<string, Record<string, string>>): void }
  slots: {
    inject(name: string, callback: () => unknown): void
    register(meta: object, component: React.ComponentType<Props>): unknown
  }
}
const dictionaries = {
  zh: { button: '补齐', title: '输入补齐', settings: '补齐设置', close: '关闭', back: '返回', save: '保存', cancel: '取消', enabled: '启用补齐', provider: '提供商', model: '补齐模型', choose: '请选择', search: '搜索模型', delay: '停顿时间（ms）', timeout: '请求超时（ms）', length: '输出上限（tokens）', characters: '建议长度上限（字符）', context: '当前草稿前文（最多字符）', history: '参考最近的会话消息', historyCount: '最近消息数', historyLength: '会话参考上限（字符）', clipboard: '参考已读取的剪贴板', clipboardRead: '读取剪贴板', clipboardClear: '清除', clipboardEmpty: '尚未读取', clipboardReady: '已读取字符数', clipboardLength: '剪贴板参考上限（字符）', clipboardHint: '仅点击读取时获取，内容只在当前页面临时保留；刷新或清除后需重新读取。勾选后会随补齐请求发送给所选模型。', prompt: '补齐提示词', promptHint: '只让模型续写，不回答请求。Shift+Enter 换行。', hint: 'Tab 接受，Esc 忽略。模型调用会产生费用，选中的参考内容会记录到本机会话日志。', unsupported: '宿主缺少补齐接口，请应用仓库配套补丁并重建。', error: '补齐失败', custom: '自定义模型 ID', loading: '加载模型…' },
  en: { button: 'Complete', title: 'Input completion', settings: 'Completion settings', close: 'Close', back: 'Back', save: 'Save', cancel: 'Cancel', enabled: 'Enable completion', provider: 'Provider', model: 'Completion model', choose: 'Choose', search: 'Search models', delay: 'Pause (ms)', timeout: 'Timeout (ms)', length: 'Output limit (tokens)', characters: 'Suggestion limit (characters)', context: 'Draft context limit (characters)', history: 'Reference recent conversation messages', historyCount: 'Recent message count', historyLength: 'History limit (characters)', clipboard: 'Reference captured clipboard', clipboardRead: 'Read clipboard', clipboardClear: 'Clear', clipboardEmpty: 'Not captured', clipboardReady: 'Captured characters', clipboardLength: 'Clipboard limit (characters)', clipboardHint: 'Read only on click, kept temporarily in this page. Refreshing or clearing requires another capture. When enabled, the captured text is sent to the selected model.', prompt: 'Completion prompt', promptHint: 'Ask for continuation, not an answer. Shift+Enter inserts a line break.', hint: 'Tab accepts; Esc dismisses. Model calls incur costs. Selected references are recorded in the local session log.', unsupported: 'Apply the companion composer patch and rebuild the Host.', error: 'Completion failed', custom: 'Custom model ID', loading: 'Loading models…' },
}
type Catalog = { provider: string; name: string; models: { id: string; name: string }[] }[]
/** Post a settings request through the served page's authenticated same-origin transport. */
export async function nativeRpc<T>(endpoint: string, payload?: unknown): Promise<T> {
  const response = await fetch(RPC, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint, payload }) })
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

/** Register the native provider only while the plugin and settings are active. */
export function apply(ctx: Context): void {
  const config = createSnapshotStore({ ...NATIVE_DEFAULTS, enabled: false })
  const clipboard = createSnapshotStore({ text: '' })
  const rpc = nativeRpc
  ctx.locale.register(NATIVE_NS, dictionaries)
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.pluginCss = 'dsh-input-assist/native'
    style.textContent = NATIVE_UI_STYLE
    document.head.append(style)
    return () => style.remove()
  })
  ctx.effect(() => {
    let active = true
    void rpc<NativeConfig>('config.get').then(value => { if (active) config.set(value) }, () => {})
    return () => { active = false }
  })
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
          yield* requestCompletion(request.prefix, sessionId, request.signal, value.includeClipboard && captured ? captured.slice(0, value.maxClipboardCharacters) : undefined)
        },
        onError: setError,
      })
    }, [register, value, sessionId, captured])
    return error ? h('div', { className: 'dsh-completion-error', role: 'status' }, `${t('error')}: ${error}`) : null
  }
  function Control({ useConfig, useClipboard, t }: Props): React.ReactNode {
    const current = useConfig(value => value)
    const captured = useClipboard(value => value.text)
    const [open, setOpen] = React.useState(false)
    const [advanced, setAdvanced] = React.useState(false)
    const [form, setForm] = React.useState(current)
    const [catalog, setCatalog] = React.useState<Catalog>([])
    const [pane, setPane] = React.useState<'root' | 'provider' | 'model'>('root')
    const [query, setQuery] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [saving, setSaving] = React.useState(false)
    const loadSeq = React.useRef(0)
    const close = (): void => { ++loadSeq.current; setOpen(false); setPane('root') }
    const load = (): void => {
      if (open) { close(); return }
      const seq = ++loadSeq.current
      setForm(current); setError(''); setPane('root'); setOpen(true); setLoading(true)
      void Promise.all([rpc<NativeConfig>('config.get'), rpc<Catalog>('models.list')]).then(([value, models]) => {
        if (seq !== loadSeq.current) return
        config.set(value); setForm(value); setCatalog(models); setLoading(false)
      }, error => { if (seq === loadSeq.current) { setError(String(error)); setLoading(false) } })
    }
    React.useEffect(() => () => { ++loadSeq.current; clipboard.set({ text: '' }) }, [])
    const field = (key: 'debounceMs' | 'timeoutMs' | 'maxTokens' | 'maxCharacters' | 'maxInputCharacters' | 'historyMessageLimit' | 'maxHistoryCharacters' | 'maxClipboardCharacters', label: string): React.ReactNode => h('label', { className: 'dsh-completion-row' }, t(label), h(Input, { type: 'number', value: String(form[key]), onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(event.target.value) }) }))
    const save = async (): Promise<void> => {
      setSaving(true)
      try { const readback = await rpc<NativeConfig>('config.set', form); config.set(readback); close(); setAdvanced(false) }
      catch (error) { setError(String(error)) }
      finally { setSaving(false) }
    }
    const providers = catalog.map(entry => ({ id: entry.provider, label: entry.name }))
    const models = catalog.find(entry => entry.provider === form.provider)?.models ?? []
    const row = (label: string, value: string): React.ReactNode => h('span', { className: 'dsh-completion-choice' }, h('span', null, label), h('span', { className: 'dsh-completion-value' }, value), h(IconChevronRightOutlineRegular, { size: 12 }))
    const choices = pane === 'provider' ? providers : models.filter(model => (model.name + ' ' + model.id).toLowerCase().includes(query.toLowerCase())).map(model => ({ id: model.id, label: model.name }))
    const capture = async (): Promise<void> => {
      try { clipboard.set({ text: (await navigator.clipboard.readText()).slice(0, form.maxClipboardCharacters) }); setError('') }
      catch (error) { setError(String(error)) }
    }
    return h(React.Fragment, null,
      h('span', { 'data-input-completion-settings': true }, h(Menu, {
        open, onClose: close, side: 'top', align: 'end', portal: true, listClassName: 'dsh-completion-popover',
        anchor: h(Tooltip, { label: t('title'), side: 'top', portal: true, disabled: open, children: h(Button, { size: 'sm', variant: 'toolbar', className: 'dsh-completion-icon', 'aria-label': t('title'), 'aria-expanded': open, onClick: load }, h(IconSparkleRegular, { size: 18 })) as React.ComponentProps<typeof Tooltip>['children'] }),
      },
        h('div', { className: 'dsh-completion-heading' }, pane === 'root' ? h('strong', null, t('title')) : h(Button, { size: 'sm', 'aria-label': t('back'), onClick: () => { setPane('root'); setQuery('') } }, h(IconChevronLeftOutlineRegular, { size: 14 }), t(pane)),
          pane === 'root' ? h(Button, { size: 'sm', className: 'dsh-completion-icon', 'aria-label': t('settings'), disabled: loading, onClick: () => { close(); setAdvanced(true) } }, h(IconSettingsOutlineRegular, { size: 16 })) : null),
        loading ? h('div', { className: 'dsh-completion-note', role: 'status' }, t('loading')) : null,
        pane === 'root' ? h(React.Fragment, null,
          h('div', { className: 'dsh-completion-enable' }, h(Switch, { checked: form.enabled, label: t('enabled'), onChange: (enabled: boolean) => setForm({ ...form, enabled }) })),
          h(MenuItemButton, { disabled: loading || saving, onSelect: () => setPane('provider'), children: row(t('provider'), catalog.find(entry => entry.provider === form.provider)?.name ?? t('choose')) }),
          h(MenuItemButton, { disabled: loading || saving || !form.provider, onSelect: () => { setPane('model'); setQuery('') }, children: row(t('model'), models.find(model => model.id === form.model)?.name ?? (form.model || t('choose'))) }),
          h('div', { className: 'dsh-completion-footer' }, h(Button, { size: 'sm', variant: 'primary', disabled: loading || saving, onClick: () => { void save() } }, t('save'))),
        ) : h(React.Fragment, null,
          pane === 'model' ? h(Input, { value: query, placeholder: t('search'), 'aria-label': t('search'), onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value) }) : null,
          ...choices.map(choice => h(MenuItemButton, { key: choice.id, onSelect: () => { setForm(pane === 'provider' ? { ...form, provider: choice.id, model: form.provider === choice.id ? form.model : '' } : { ...form, model: choice.id }); setPane('root'); setQuery('') },
            children: h('span', { className: 'dsh-completion-choice' }, h('span', null, choice.label), choice.id === (pane === 'provider' ? form.provider : form.model) ? h(IconCheckOutlineRegular, { size: 16 }) : null) })),
          pane === 'model' ? h('label', { className: 'dsh-completion-row' }, t('custom'), h(Input, { value: form.model, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, model: event.target.value }) })) : null,
        ),
        error ? h('div', { className: 'dsh-completion-note', role: 'alert' }, error) : null,
      )),
      h(Modal, { open: advanced, onClose: () => setAdvanced(false), title: t('settings'), closeLabel: t('close') },
        h('div', { className: 'dsh-completion-settings' },
          field('maxInputCharacters', 'context'),
          h(Checkbox, { checked: form.includeHistory, label: t('history'), onChange: (includeHistory: boolean) => setForm({ ...form, includeHistory }) }),
          form.includeHistory ? h('div', { className: 'dsh-completion-pair' }, field('historyMessageLimit', 'historyCount'), field('maxHistoryCharacters', 'historyLength')) : null,
          h(Checkbox, { checked: form.includeClipboard, label: t('clipboard'), onChange: (includeClipboard: boolean) => setForm({ ...form, includeClipboard }) }),
          form.includeClipboard ? h(React.Fragment, null, field('maxClipboardCharacters', 'clipboardLength'),
            h('div', { className: 'dsh-completion-capture' }, h(Button, { size: 'sm', onClick: () => { void capture() } }, t('clipboardRead')), h(Button, { size: 'sm', disabled: !captured, onClick: () => clipboard.set({ text: '' }) }, t('clipboardClear')), h('span', { role: 'status' }, captured ? `${t('clipboardReady')}: ${captured.length}` : t('clipboardEmpty'))),
            h('div', { className: 'dsh-completion-note' }, t('clipboardHint'))) : null,
          h('label', { className: 'dsh-completion-row' }, t('prompt'), h(InlineEditor, { value: form.systemPrompt, label: t('prompt'), onChange: (systemPrompt: string) => setForm({ ...form, systemPrompt }), onSave: () => { void save() }, onCancel: () => setAdvanced(false) })),
          h('div', { className: 'dsh-completion-note' }, t('promptHint')),
          h('div', { className: 'dsh-completion-pair' }, field('debounceMs', 'delay'), field('timeoutMs', 'timeout')),
          h('div', { className: 'dsh-completion-pair' }, field('maxTokens', 'length'), field('maxCharacters', 'characters')),
          h('div', { className: 'dsh-completion-note' }, t('hint')),
          error ? h('div', { role: 'alert' }, error) : null,
          h('div', { className: 'dsh-completion-footer' }, h(Button, { onClick: () => setAdvanced(false) }, t('cancel')), h(Button, { variant: 'primary', disabled: saving, onClick: () => { void save() } }, t('save'))),
        )),
    )
  }
  ctx.slots.inject('conversation.input.completion', () => ctx.slots.register({ name: 'conversation.input.completion', locale: NATIVE_NS, inject: () => ({ hooks: { config, clipboard } }) }, Binding))
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({ name: 'conversation.input.right', id: 'input-completion-settings', order: 25, locale: NATIVE_NS, inject: () => ({ hooks: { config, clipboard } }) }, Control))
}
