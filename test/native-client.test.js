import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function client() {
  let definition
  const source = readFileSync(new URL('../lib/native-client.js', import.meta.url), 'utf8')
  new Function('window', source)({ __ModuleLoader__: { load: value => { definition = value } } })
  return definition.factory(id => {
    if (id === 'react') return { createElement: () => null }
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
    throw new Error(`Unexpected external module: ${id}`)
  })
}

test('registers builtin Chinese and English dictionaries and the declared native slots', () => {
  const registrations = []
  const namespaces = []
  const api = client()
  api.apply({
    modelPickers: {Picker: () => null},
    effect() {},
    locale: { register(ns, dictionaries) {
      assert.equal(ns, 'input-assist')
      assert.deepEqual(Object.keys(dictionaries).sort(), ['en', 'zh'])
      assert.equal(dictionaries.zh.button, '补齐')
      assert.equal(dictionaries.en.button, 'Complete')
    } },
    slots: { inject(name, callback) { namespaces.push(name); callback() },
      register(meta, component) { registrations.push({ meta, component }) } },
  })
  assert.deepEqual(namespaces, ['conversation.input.completion', 'conversation.input.right'])
  assert.equal(registrations[1].meta.id, 'input-completion-settings')
  assert.equal(typeof registrations[0].component, 'function')
})

test('reads split SSE frames and reports upstream errors without accepting an unfinished draft', async () => {
  const api = client()
  const encoder = new TextEncoder()
  const body = new ReadableStream({ start(controller) {
    for (const text of ['data: {"delta":"续', '写"}\n\n', 'data: {"done":true}\n\n']) controller.enqueue(encoder.encode(text))
    controller.close()
  } })
  const parts = []
  for await (const part of api.readCompletionStream(new Response(body, { headers: { 'content-type': 'text/event-stream' } }), new AbortController().signal)) parts.push(part)
  assert.deepEqual(parts, ['续写'])
  await assert.rejects(async () => {
    for await (const part of api.readCompletionStream(new Response('data: {"error":"model unavailable"}\n\n', { headers: { 'content-type': 'text/event-stream' } }), new AbortController().signal)) void part
  }, /model unavailable/u)
})

test('uses the browser fetch transport for settings and cancellable completion', async t => {
  const api = client()
  const original = globalThis.fetch
  const signal = new AbortController().signal
  const calls = []
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async (path, init) => {
    calls.push({ path, init })
    assert.equal(init.method, 'POST')
    assert.equal(init.credentials, 'same-origin')
    if (path === '/api/input-completion/rpc') {
      assert.deepEqual(JSON.parse(init.body), { endpoint: 'config.get' })
      return Response.json({ ok: true, value: { provider: 'test', model: 'fast' } })
    }
    assert.equal(path, '/api/input-completion/stream')
    assert.equal(init.signal, signal)
    assert.deepEqual(JSON.parse(init.body), { prefix: '检查配置', sessionId: 'test-session' })
    return new Response('data: {"delta":"并说明原因"}\n\ndata: {"done":true}\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  assert.deepEqual(await api.nativeRpc('config.get'), { provider: 'test', model: 'fast' })
  const parts = []
  for await (const part of api.requestCompletion('检查配置', 'test-session', signal)) parts.push(part)
  assert.deepEqual(parts, ['并说明原因'])
  assert.equal(calls.length, 2)
})

test('only transmits explicitly supplied clipboard text and retains cancellation', async t => {
  const api = client()
  const original = globalThis.fetch
  const signal = new AbortController().signal
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async (_path, init) => {
    assert.equal(init.signal, signal)
    assert.deepEqual(JSON.parse(init.body), { prefix: '当前草稿', sessionId: 'test-session', clipboard: '合成剪贴板内容' })
    return new Response('data: {"done":true}\n\n', { headers: { 'content-type': 'text/event-stream' } })
  }
  for await (const part of api.requestCompletion('当前草稿', 'test-session', signal, '合成剪贴板内容')) void part
})

test('completion activity follows stream completion, cancellation and failures', async () => {
  const activity = client().createCompletionActivity()
  const abort = new AbortController()
  let release
  const gate = new Promise(resolve => { release = resolve })
  const stream = activity.track('synthetic', abort.signal, async function* () { await gate; yield '建议' })
  const next = stream.next()
  assert.equal(activity.store.getSnapshot().sessions.synthetic, true)
  abort.abort()
  assert.deepEqual(activity.store.getSnapshot().sessions, {})
  const replacement = activity.track('synthetic', new AbortController().signal, async function* () { yield '新建议' })
  await replacement.next()
  release()
  await next
  await stream.return()
  assert.equal(activity.store.getSnapshot().sessions.synthetic, true)
  await replacement.next()
  assert.deepEqual(activity.store.getSnapshot().sessions, {})
  await assert.rejects(async () => {
    for await (const _ of activity.track('failure', new AbortController().signal, async function* () { throw new Error('synthetic failure') })) void _
  }, /synthetic failure/)
  assert.deepEqual(activity.store.getSnapshot().sessions, {})
})

test('composer mounts share one initial settings read and reuse it on subsequent openings', async () => {
  let reads = 0, resolve
  const cache = client().createCompletionSettingsCache(() => {
    ++reads
    return new Promise(done => { resolve = done })
  }, { enabled: false })
  const first = cache.ensureLoaded()
  const second = cache.ensureLoaded()
  assert.equal(first, second)
  await Promise.resolve()
  assert.equal(reads, 1)
  resolve({ enabled: true, provider: 'synthetic', model: 'fast' })
  await first
  for (let session = 0; session < 3; session++) await cache.ensureLoaded()
  assert.equal(reads, 1)
  assert.equal(cache.state.getSnapshot().ready, true)
  assert.equal(cache.config.getSnapshot().model, 'fast')
})

test('settings errors are visible and the next opening can retry', async () => {
  let reads = 0
  const cache = client().createCompletionSettingsCache(async () => {
    if (++reads === 1) throw new Error('synthetic settings unavailable')
    return { model: 'recovered' }
  }, { enabled: false })
  await cache.ensureLoaded()
  assert.equal(cache.state.getSnapshot().ready, false)
  assert.match(cache.state.getSnapshot().error, /synthetic settings unavailable/)
  await cache.ensureLoaded()
  assert.equal(cache.state.getSnapshot().error, '')
  assert.equal(cache.config.getSnapshot().model, 'recovered')
})

test('settings invalidation keeps the cached picker usable and coalesces pending refreshes', async () => {
  const replies = []
  const cache = client().createCompletionSettingsCache(() => new Promise(resolve => replies.push(resolve)), { enabled: false })
  const initial = cache.ensureLoaded()
  await Promise.resolve()
  replies[0]({ model: 'cached' })
  await initial
  const refresh = cache.refresh()
  await Promise.resolve()
  assert.equal(cache.state.getSnapshot().ready, true)
  assert.equal(cache.config.getSnapshot().model, 'cached')
  cache.refresh()
  cache.refresh()
  replies[1]({ model: 'stale' })
  await Promise.resolve()
  assert.equal(replies.length, 3)
  assert.equal(cache.config.getSnapshot().model, 'cached')
  replies[2]({ model: 'latest' })
  await refresh
  assert.equal(cache.config.getSnapshot().model, 'latest')
})

test('a saved settings readback supersedes an older pending read', async () => {
  let resolve
  const cache = client().createCompletionSettingsCache(() => new Promise(done => { resolve = done }), { enabled: false })
  const initial = cache.ensureLoaded()
  await Promise.resolve()
  cache.commit({ enabled: true, model: 'saved' })
  resolve({ enabled: false, model: 'stale' })
  await initial
  assert.equal(cache.config.getSnapshot().model, 'saved')
  assert.equal(cache.state.getSnapshot().ready, true)
})

test('a failed background refresh keeps existing settings and retries on opening', async () => {
  let reads = 0
  const cache = client().createCompletionSettingsCache(async () => {
    if (++reads === 2) throw new Error('synthetic refresh failure')
    return { model: reads === 1 ? 'cached' : 'fresh' }
  }, { enabled: false })
  await cache.ensureLoaded()
  await cache.refresh()
  assert.equal(cache.state.getSnapshot().ready, true)
  assert.equal(cache.config.getSnapshot().model, 'cached')
  await cache.ensureLoaded()
  assert.equal(reads, 3)
  assert.equal(cache.config.getSnapshot().model, 'fresh')
})

test('Host reset discards the previous generation and unloading ignores pending reads', async () => {
  const replies = []
  const cache = client().createCompletionSettingsCache(() => new Promise(resolve => replies.push(resolve)), { enabled: false })
  const initial = cache.ensureLoaded()
  await Promise.resolve()
  cache.reset()
  assert.equal(cache.config.getSnapshot().enabled, false)
  replies[0]({ model: 'old-host' })
  await Promise.resolve()
  assert.equal(cache.state.getSnapshot().ready, false)
  replies[1]({ model: 'new-host' })
  await initial
  assert.equal(cache.config.getSnapshot().model, 'new-host')
  const refresh = cache.refresh()
  await Promise.resolve()
  cache.dispose()
  replies[2]({ model: 'unloaded' })
  await refresh
  cache.commit({ model: 'late-save' })
  assert.equal(cache.config.getSnapshot().model, 'new-host')
})
