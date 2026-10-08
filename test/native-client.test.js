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
