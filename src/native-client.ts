/** Native composer provider and independent model settings; no DOM editor access. */
import * as React from 'react'
import { Button, Menu, Modal, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { createSnapshotStore } from './snapshot-store.ts'
import { NATIVE_DEFAULTS, NATIVE_NS } from './native-config.ts'
import type { NativeConfig } from './native-config.ts'
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
  t: (key: string) => string
}
interface Context {
  effect(callback: () => void | (() => void)): void
  connection: { fetch(path: string, init: RequestInit): Promise<Response> }
  locale: { register(ns: string, dictionaries: Record<string, Record<string, string>>): void }
  slots: {
    inject(name: string, callback: () => unknown): void
    register(meta: object, component: React.ComponentType<Props>): unknown
  }
}
const dictionaries = {
  'zh-CN': { button: '补齐', title: '输入补齐', close: '关闭', save: '保存', cancel: '取消', enabled: '启用补齐', provider: '供应商', model: '补齐模型', choose: '请选择', delay: '停顿时间（ms）', timeout: '请求超时（ms）', length: '输出上限（tokens）', hint: '仅续写当前草稿，Tab 接受，Esc 忽略。补齐请求会产生模型费用并记录到本机会话日志。', unsupported: '宿主缺少补齐接口，请应用仓库配套补丁并重建。', error: '补齐失败', custom: '也可输入供应商支持的模型 ID', loading: '加载模型…' },
  'en-US': { button: 'Complete', title: 'Input completion', close: 'Close', save: 'Save', cancel: 'Cancel', enabled: 'Enable completion', provider: 'Provider', model: 'Completion model', choose: 'Choose', delay: 'Pause (ms)', timeout: 'Timeout (ms)', length: 'Output limit (tokens)', hint: 'Continues the current draft. Tab accepts; Esc dismisses. Model calls incur costs and are recorded in the local session log.', unsupported: 'Apply the companion composer patch and rebuild the Host.', error: 'Completion failed', custom: 'Or enter a model ID supported by this provider', loading: 'Loading models…' },
}
type Catalog = { provider: string; name: string; models: { id: string; name: string }[] }[]
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
  const rpc = async <T,>(endpoint: string, payload?: unknown): Promise<T> => {
    const response = await ctx.connection.fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint, payload }) })
    const result = await response.json() as { ok: boolean; value: T; error?: string }
    if (!result.ok) throw new Error(result.error ?? String(response.status))
    return result.value
  }
  ctx.locale.register(NATIVE_NS, dictionaries)
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.pluginCss = 'dsh-input-assist/native'
    style.textContent = '.dsh-completion-settings{display:grid;gap:14px;min-width:280px;max-width:520px}.dsh-completion-row{display:grid;gap:6px}.dsh-completion-error{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;padding:0 14px}.dsh-completion-note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.dsh-completion-footer{display:flex;gap:8px;justify-content:flex-end}'
    document.head.append(style)
    return () => style.remove()
  })
  ctx.effect(() => {
    let active = true
    void rpc<NativeConfig>('config.get').then(value => { if (active) config.set(value) }, () => {})
    return () => { active = false }
  })
  function Binding({ register, useConfig, sessionId, t }: Props): React.ReactNode {
    const value = useConfig(value => value)
    const [error, setError] = React.useState('')
    React.useEffect(() => {
      setError('')
      if (!register || !value.enabled || !value.provider || !value.model) return
      return register({
        debounceMs: value.debounceMs, timeoutMs: value.timeoutMs, maxCharacters: value.maxCharacters,
        async *complete(request) {
          setError('')
          const response = await ctx.connection.fetch(STREAM, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefix: request.prefix, sessionId }), signal: request.signal })
          yield* readCompletionStream(response, request.signal)
        },
        onError: setError,
      })
    }, [register, value, sessionId])
    return error ? h('div', { className: 'dsh-completion-error', role: 'status' }, `${t('error')}: ${error}`) : null
  }
  function Control({ useConfig, t }: Props): React.ReactNode {
    const current = useConfig(value => value)
    const [open, setOpen] = React.useState(false)
    const [form, setForm] = React.useState(current)
    const [catalog, setCatalog] = React.useState<Catalog>([])
    const [menu, setMenu] = React.useState('')
    const [error, setError] = React.useState('')
    const [saving, setSaving] = React.useState(false)
    const load = (): void => {
      setForm(current); setError(''); setOpen(true)
      void rpc<NativeConfig>('config.get').then(value => { config.set(value); setForm(value) }, error => setError(String(error)))
      void rpc<Catalog>('models.list').then(setCatalog, error => setError(String(error)))
    }
    const field = (key: 'debounceMs' | 'timeoutMs' | 'maxTokens', label: string): React.ReactNode => h('label', { className: 'dsh-completion-row' }, t(label), h(Input, { type: 'number', value: String(form[key]), onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(event.target.value) }) }))
    const save = async (): Promise<void> => {
      setSaving(true)
      try { const readback = await rpc<NativeConfig>('config.set', form); config.set(readback); setOpen(false) }
      catch (error) { setError(String(error)) }
      finally { setSaving(false) }
    }
    const providers = catalog.map(entry => ({ id: entry.provider, label: entry.name }))
    const models = catalog.find(entry => entry.provider === form.provider)?.models ?? []
    return h(React.Fragment, null,
      h('span', { 'data-input-completion-settings': true }, h(Button, { size: 'sm', variant: 'toolbar', onClick: load }, `${t('button')}${current.model ? ': ' + current.model : ''}`)),
      h(Modal, { open, onClose: () => setOpen(false), title: t('title'), closeLabel: t('close') },
        h('div', { className: 'dsh-completion-settings' },
          h(Switch, { checked: form.enabled, label: t('enabled'), onChange: (enabled: boolean) => setForm({ ...form, enabled }) }),
          h('div', { className: 'dsh-completion-row' }, t('provider'), h(Menu, { open: menu === 'provider', onClose: () => setMenu(''), portal: true, items: providers, selectedId: form.provider, onSelect: (provider: string) => { setForm({ ...form, provider, model: '' }); setMenu('') }, anchor: h(Button, { variant: 'outline', onClick: () => setMenu(menu === 'provider' ? '' : 'provider') }, catalog.find(entry => entry.provider === form.provider)?.name ?? t('choose')) })),
          h('div', { className: 'dsh-completion-row' }, t('model'), h(Menu, { open: menu === 'model', onClose: () => setMenu(''), portal: true, items: models.map(model => ({ id: model.id, label: model.name })), selectedId: form.model, onSelect: (model: string) => { setForm({ ...form, model }); setMenu('') }, anchor: h(Button, { variant: 'outline', onClick: () => setMenu(menu === 'model' ? '' : 'model') }, form.model || t('choose')) }), h(Input, { value: form.model, placeholder: t('custom'), onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, model: event.target.value }) })),
          field('debounceMs', 'delay'), field('timeoutMs', 'timeout'), field('maxTokens', 'length'),
          h('div', { className: 'dsh-completion-note' }, t('hint')),
          error ? h('div', { role: 'alert' }, error) : null,
          h('div', { className: 'dsh-completion-footer' }, h(Button, { onClick: () => setOpen(false) }, t('cancel')), h(Button, { variant: 'primary', disabled: saving, onClick: () => { void save() } }, t('save'))),
        )),
    )
  }
  ctx.slots.inject('conversation.input.completion', () => ctx.slots.register({ name: 'conversation.input.completion', locale: NATIVE_NS, inject: () => ({ hooks: { config } }) }, Binding))
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({ name: 'conversation.input.right', id: 'input-completion-settings', order: 25, locale: NATIVE_NS, inject: () => ({ hooks: { config } }) }, Control))
}
