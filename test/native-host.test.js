import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { apply, nativeRequest, validateNativePatch, NATIVE_RPC_PATH, NATIVE_STREAM_PATH } from '../lib/native-host.js'
import { NATIVE_DEFAULTS } from '../src/native-config.ts'

test('rejects invalid settings and retains an independent model route', () => {
  assert.throws(() => validateNativePatch({ timeoutMs: 0 }))
  assert.throws(() => validateNativePatch({ provider: 1 }))
  assert.throws(() => validateNativePatch({ apiKey: 'synthetic' }))
  const config = { ...NATIVE_DEFAULTS, provider: 'configured-provider', model: 'small-model' }
  const request = nativeRequest(config, '检查配置', new AbortController().signal)
  assert.equal(request.provider, 'configured-provider')
  assert.equal(request.model, 'small-model')
  assert.equal(request.messages[0].content[0].text, '检查配置')
  assert.equal(request.tools, undefined)
  assert.deepEqual({ provider: request.provider, model: request.model, system: request.system,
    prefix: request.messages[0].content[0].text, maxTokens: request.maxTokens, tools: request.tools ?? [] },
  JSON.parse(readFileSync(new URL('./native-request.expected.json', import.meta.url), 'utf8')))
})

test('optional references stay out of default requests even when the client sends them', () => {
  const config = { ...NATIVE_DEFAULTS, provider: 'configured', model: 'small' }
  const request = nativeRequest(config, '当前草稿', new AbortController().signal, {
    history: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '历史文字' }] }], clipboard: '剪贴板文字',
  })
  assert.equal(request.messages.length, 1)
  assert.equal(request.messages[0].content[0].text, '当前草稿')
  assert.equal(NATIVE_DEFAULTS.includeHistory, false)
  assert.equal(NATIVE_DEFAULTS.includeClipboard, false)
})

test('bounds selected references and applies the saved completion prompt to the exact request', () => {
  const config = { ...NATIVE_DEFAULTS, provider: 'configured', model: 'small', includeHistory: true, historyMessageLimit: 2,
    maxHistoryCharacters: 64, includeClipboard: true, maxClipboardCharacters: 64, maxInputCharacters: 64,
    systemPrompt: '仅补写一个简短短语，保持原文语气。' }
  const history = [
    { role: 'system', source: { kind: 'system-prompt' }, content: [{ type: 'text', text: '不能被当作会话参考的系统内容' }] },
    { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '较早的用户消息' }] },
    { role: 'user', source: { kind: 'context' }, content: [{ type: 'text', text: '不能被当作用户消息的工具上下文' }] },
    { role: 'assistant', source: { kind: 'model' }, content: [{ type: 'text', text: 'a'.repeat(80) }] },
    { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '当前问题' }, { type: 'image', data: 'excluded' }] },
  ]
  const request = nativeRequest(config, 'x'.repeat(100), new AbortController().signal, { history, clipboard: 'c'.repeat(100) })
  const reference = JSON.parse(request.messages[0].content[0].text.split('\n').slice(1).join('\n'))
  assert.deepEqual(reference.history, [{ role: 'assistant', text: 'a'.repeat(60) }, { role: 'user', text: '当前问题' }])
  assert.equal(reference.clipboard, 'c'.repeat(64))
  assert.equal(request.system, config.systemPrompt)
  assert.equal(request.messages.at(-1).content[0].text, 'x'.repeat(64))
  assert.equal(request.tools, undefined)
})

test('rejects blank prompts and invalid context limits before a settings write', () => {
  for (const patch of [{ systemPrompt: ' ' }, { systemPrompt: 'x'.repeat(8001) }, { includeHistory: 'true' },
    { includeClipboard: 1 }, { historyMessageLimit: 21 }, { maxHistoryCharacters: 12001 }, { maxClipboardCharacters: 63 }]) {
    assert.throws(() => validateNativePatch(patch))
  }
  assert.deepEqual(validateNativePatch({ systemPrompt: '仅续写一句。', includeHistory: true, includeClipboard: false }),
    { systemPrompt: '仅续写一句。', includeHistory: true, includeClipboard: false })
})

test('real HTTP streams through the registered route and aborts model work on disconnect', async t => {
  const routes = new Map()
  const disposers = []
  const events = []
  let settings = { ...NATIVE_DEFAULTS, provider: 'test', model: 'small' }
  let started
  let aborted
  const startedPromise = new Promise(resolve => { started = resolve })
  const abortedPromise = new Promise(resolve => { aborted = resolve })
  const ctx = {
    settings: { describe: () => [{ ns: 'input-assist', revision: 0, value: settings }], update: async (_ns, patch) => { settings = { ...settings, ...patch } } },
    sessions: { get: id => id === 'synthetic-session' ? { append: (...event) => events.push(event) } : undefined },
    llm: {
      listProviders: () => [{ id: 'test', name: 'Test' }], listModels: async () => [{ provider: 'test', id: 'small', name: 'Small' }],
      async *stream(request) {
        started()
        yield { type: 'text-delta', index: 0, text: '，检查日志。' }
        await new Promise(resolve => {
          const end = () => { aborted(); resolve() }
          if (request.signal.aborted) end()
          else request.signal.addEventListener('abort', end, { once: true })
        })
      },
    },
    connection: { fetch: { register: route => { routes.set(route.path, route.fetch); return () => routes.delete(route.path) } } },
    effect(callback) { const dispose = callback(); if (typeof dispose === 'function') disposers.push(dispose) },
  }
  apply(ctx, Object.fromEntries(Object.keys(settings).map(key => [key, { get: () => settings[key] }])))
  const server = createServer(async (req, res) => {
    const abort = new AbortController()
    res.on('close', () => { if (!res.writableEnded) abort.abort() })
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const response = await routes.get(req.url)(new Request('http://127.0.0.1' + req.url, { method: req.method, body: Buffer.concat(chunks), signal: abort.signal }))
    res.writeHead(response.status, Object.fromEntries(response.headers))
    try { for await (const chunk of response.body) res.write(chunk); res.end() }
    catch { res.end() }
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(async () => { disposers.reverse().forEach(dispose => dispose()); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
  const base = `http://127.0.0.1:${server.address().port}`
  const rpc = async (endpoint, payload) => (await fetch(base + NATIVE_RPC_PATH, { method: 'POST', body: JSON.stringify({ endpoint, payload }) })).json()
  assert.equal((await rpc('config.set', { debounceMs: 350 })).value.debounceMs, 350)
  assert.equal((await rpc('models.list')).value[0].models[0].id, 'small')
  assert.equal((await rpc('config.set', { timeoutMs: -1 })).ok, false)
  const abort = new AbortController()
  const response = await fetch(base + NATIVE_STREAM_PATH, { method: 'POST', body: JSON.stringify({ sessionId: 'synthetic-session', prefix: '帮我查一下' }), signal: abort.signal })
  await startedPromise
  const reader = response.body.getReader()
  const first = await reader.read()
  assert.match(new TextDecoder().decode(first.value), /检查日志/u)
  assert.equal(events[0][0], 'input/completion-request')
  assert.equal(events[0][2].ignorable, true)
  abort.abort()
  await Promise.race([abortedPromise, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('upstream was not cancelled')), 2000); timer.unref() })])
  assert.equal(settings.provider, 'test')
})
