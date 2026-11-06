import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import * as Native from '../lib/native-host.js'

test('current Cordis mounts completion routes and releases owned services on unload', async () => {
  const ctx = new Context()
  const routes = new Map()
  let projections = 0
  let closed = false
  ctx.provide('settings', { describe: () => [], update: async () => {} })
  ctx.provide('llm', {})
  ctx.provide('sessions', { get: () => undefined })
  ctx.provide('sessionProjections', {
    register() { projections++; return () => { projections-- } },
  })
  ctx.provide('storage', { backend: { get: () => ({ kv: { open: async () => ({
    loadAll: async () => ({ global: null }), setGlobal: async () => {}, close: async () => { closed = true },
  }) } }) } })
  ctx.provide('storage.backend.json', {})
  ctx.provide('connection', { fetch: { register(route) {
    routes.set(route.path, route.fetch)
    return () => routes.delete(route.path)
  } } })
  try {
    const fiber = ctx.plugin(Native)
    await fiber
    assert.equal(projections, 1)
    assert.equal(routes.size, 2)
    const response = await routes.get(Native.NATIVE_RPC_PATH)(new Request('http://test/api', {
      method: 'POST', body: JSON.stringify({ endpoint: 'config.get' }),
    }))
    const result = await response.json()
    assert.equal(result.ok, true)
    assert.equal(result.value.enabled, true)
    await fiber.dispose()
    assert.equal(routes.size, 0)
    assert.equal(projections, 0)
    assert.equal(closed, true)
  } finally {
    await ctx.fiber.dispose()
  }
})
