import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function client() {
  let definition
  new Function('window', readFileSync(new URL('../lib/native-client.js', import.meta.url), 'utf8'))({ __ModuleLoader__: { load: value => { definition = value } } })
  return definition.factory(id => {
    if (id === 'react') return { createElement: () => null }
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
    throw new Error(`Unexpected external module: ${id}`)
  })
}

test('history source follows live titles, handles paged metadata and marks only confirmed missing sessions unavailable', () => {
  const { completionSource } = client()
  const snapshot = { byId: { original: { title: '原会话', displayTitle: '原会话' } }, projectionsBySession: {} }
  const labels = [completionSource(snapshot, 'original')]
  snapshot.projectionsBySession.original = { values: { title: '最新会话名' }, state: 'ready', error: null }
  labels.push(completionSource(snapshot, 'original'))
  labels.push(completionSource(snapshot, 'unloaded'))
  snapshot.projectionsBySession.unloaded = { values: { title: '历史会话' }, state: 'ready', error: null }
  labels.push(completionSource(snapshot, 'unloaded'))
  snapshot.projectionsBySession.original = { values: {}, state: 'error', error: { code: 'session/not-found' } }
  labels.push(completionSource(snapshot, 'original'))
  snapshot.projectionsBySession.transient = { values: {}, state: 'error', error: { code: 'gateway/internal' } }
  labels.push(completionSource(snapshot, 'transient'))
  assert.deepEqual(labels, JSON.parse(readFileSync(new URL('./completion-source.expected.json', import.meta.url), 'utf8')))
})

test('source navigation uses exact session identities and preserves the original direct-parent child address', () => {
  const { openCompletionSource } = client()
  const address = { parentSessionId: 'original-parent', childSessionId: 'original-child', mode: 'continuable' }
  const calls = []
  const sources = { subagentAddress: id => id === 'original-child' ? address : undefined }
  openCompletionSource(sources, target => calls.push(target), 'original-session')
  openCompletionSource(sources, target => calls.push(target), 'original-child')
  assert.equal(calls[0], 'original-session')
  assert.equal(calls[1], address)
  assert.equal(calls.length, 2)
})

test('bounded history search includes current names, models and results while status filters retain cancelled and failed requests', () => {
  const { completionRecordMatches } = client()
  const row = { provider: 'provider', model: 'Small', result: '补齐内容', error: '', status: 'success' }
  assert.equal(completionRecordMatches(row, ' 最新会话 ', 'all', '最新会话名称'), true)
  assert.equal(completionRecordMatches(row, 'small', 'success', ''), true)
  assert.equal(completionRecordMatches(row, '补齐内容', 'success', ''), true)
  assert.equal(completionRecordMatches(row, '不存在', 'all', ''), false)
  assert.equal(completionRecordMatches(row, '', 'cancelled', ''), false)
  for (const status of ['error', 'timeout', 'interrupted']) assert.equal(completionRecordMatches({ ...row, status }, '', 'error', ''), true)
  assert.equal(completionRecordMatches({ ...row, status: 'cancelled' }, '', 'cancelled', ''), true)
})
