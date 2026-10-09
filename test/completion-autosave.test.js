import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function factory() {
  let definition
  new Function('window', readFileSync(new URL('../lib/native-client.js', import.meta.url), 'utf8'))({ __ModuleLoader__: { load: value => { definition = value } } })
  return definition.factory(id => {
    if (id === 'react') return { createElement: () => null }
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
    throw new Error(`Unexpected external module: ${id}`)
  }).createCompletionAutosave
}

test('changes apply immediately and rapid choices coalesce without stale readback replacing the latest model', async () => {
  let current = { enabled: false, provider: 'synthetic', model: 'old' }
  const initial = { ...current }
  const calls = [], replies = []
  const save = factory()(() => current, patch => {
    calls.push(patch)
    return new Promise(resolve => replies.push(resolve))
  }, value => { current = value })
  const snapshot = () => ({ ...current, status: save.state.getSnapshot().status })
  const output = []
  save.change({ enabled: true })
  output.push(snapshot())
  assert.equal(current.enabled, true)
  assert.equal(save.state.getSnapshot().status, 'saving')
  await Promise.resolve()
  save.change({ provider: 'other', model: 'first' })
  save.change({ model: 'latest' })
  output.push(snapshot())
  assert.equal(current.model, 'latest')
  assert.equal(calls.length, 1)
  replies[0]({ ...initial, enabled: true })
  await Promise.resolve()
  assert.equal(current.model, 'latest')
  assert.deepEqual(calls, [{ enabled: true }, { provider: 'other', model: 'latest' }])
  output.push(snapshot())
  replies[1]({ enabled: true, provider: 'other', model: 'latest' })
  await save.whenIdle()
  assert.equal(save.state.getSnapshot().status, 'saved')
  assert.deepEqual(current, { enabled: true, provider: 'other', model: 'latest' })
  output.push(snapshot())
  assert.deepEqual(output, JSON.parse(readFileSync(new URL('./completion-save.expected.json', import.meta.url), 'utf8')))
})

test('failed writes restore confirmed settings and retry retains only the failed patch', async () => {
  let current = { enabled: false, provider: 'synthetic', model: 'old' }, tries = 0
  const calls = []
  const save = factory()(() => current, async patch => {
    calls.push(patch)
    if (++tries === 1) throw new Error('input-assist/http-502')
    return { ...current, ...patch }
  }, value => { current = value })
  save.change({ enabled: true })
  await save.whenIdle()
  assert.equal(current.enabled, false)
  assert.deepEqual(save.state.getSnapshot(), { status: 'error', error: 'Error: input-assist/http-502' })
  save.retry()
  assert.equal(current.enabled, true)
  await save.whenIdle()
  assert.deepEqual(calls, [{ enabled: true }, { enabled: true }])
  assert.equal(save.state.getSnapshot().status, 'saved')
})

test('a newer edit carries failed in-flight fields forward and overrides older choices', async () => {
  let current = { enabled: false, model: 'old' }, reject
  const calls = []
  const save = factory()(() => current, patch => {
    calls.push(patch)
    if (calls.length === 1) return new Promise((_, fail) => { reject = fail })
    return Promise.resolve({ enabled: patch.enabled, model: patch.model })
  }, value => { current = value })
  save.change({ enabled: true })
  await Promise.resolve()
  save.change({ model: 'new' })
  reject(new Error('synthetic temporary failure'))
  await save.whenIdle()
  assert.deepEqual(calls, [{ enabled: true }, { enabled: true, model: 'new' }])
  assert.deepEqual(current, { enabled: true, model: 'new' })
})

test('Host reset and plugin unload ignore earlier readbacks and discard queued writes', async () => {
  let current = { enabled: false, model: 'old' }
  const calls = [], replies = []
  const save = factory()(() => current, patch => {
    calls.push(patch)
    return new Promise(resolve => replies.push(resolve))
  }, value => { current = value })
  save.change({ model: 'stale' })
  await Promise.resolve()
  save.reset()
  current = { enabled: false, model: 'new-host' }
  save.change({ enabled: true })
  replies[0]({ enabled: false, model: 'stale' })
  await Promise.resolve()
  assert.equal(current.model, 'new-host')
  replies[1]({ enabled: true, model: 'new-host' })
  await save.whenIdle()
  save.change({ model: 'unloading' })
  await Promise.resolve()
  save.change({ model: 'never-written' })
  save.dispose()
  replies[2]({ enabled: true, model: 'ignored-readback' })
  await save.whenIdle()
  assert.equal(current.model, 'never-written')
  assert.equal(calls.length, 3)
})

test('reset aborts the owned request and a failed write on the new Host restores its own settings', async () => {
  let current = { enabled: false, model: 'old-host' }, firstSignal, writes = 0
  const save = factory()(() => current, (_patch, signal) => {
    if (++writes > 1) return Promise.reject(new Error('new-host refused'))
    firstSignal = signal
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
  }, value => { current = value })
  save.change({ model: 'stale' })
  await Promise.resolve()
  save.reset()
  assert.equal(firstSignal.aborted, true)
  current = { enabled: false, model: 'new-host' }
  save.change({ enabled: true })
  await save.whenIdle()
  assert.deepEqual(current, { enabled: false, model: 'new-host' })
  assert.equal(save.state.getSnapshot().status, 'error')
})
