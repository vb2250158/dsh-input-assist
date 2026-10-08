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
