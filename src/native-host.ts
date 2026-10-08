/** Authenticated completion routes using DSH's configured adapters and credential service. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { normalizeSuggestion } from './completion.ts'
import { linkedTimeoutSignal } from './abort.ts'
import { NATIVE_NS, NATIVE_DEFAULTS } from './native-config.ts'
import type { NativeConfig } from './native-config.ts'

export const name = 'input-assist'
export const inject = ['settings', 'llm', 'sessions', 'connection']
export const NATIVE_RPC_PATH = '/api/input-completion/rpc'
export const NATIVE_STREAM_PATH = '/api/input-completion/stream'
export const COMPLETION_SYSTEM = '续写用户正在输入的请求。只输出可以直接接在原文后面的短文本，保持原文语言和语气。不要回答请求，不要解释，不要重复原文，不要添加引号或 Markdown。最多续写一句；信息不足时输出空文本。'
export const Config = z.object({
  enabled: z.boolean().default(true), provider: z.string().default(''), model: z.string().default(''),
  debounceMs: z.number().min(100).max(5000).step(1).default(500),
  timeoutMs: z.number().min(500).max(30000).step(1).default(5000),
  maxTokens: z.number().min(8).max(256).step(1).default(64),
  maxCharacters: z.number().min(8).max(500).step(1).default(200),
  maxInputCharacters: z.number().min(64).max(8000).step(1).default(2000),
})
for (const field of Object.values(Config.dict ?? {})) field.meta.volatile = true
export type Config = { [Key in keyof NativeConfig]: Volatile<NativeConfig[Key]> }
interface Model { provider: string; id: string; name: string }
interface NativeServices {
  settings: {
    describe(): { ns: string; revision: number; value: unknown }[]
    update(ns: string, patch: Partial<NativeConfig>, expectedRevision: number): Promise<void>
  }
  llm: {
    listProviders(): { id: string; name: string }[]
    listModels(provider: string): Promise<Model[]>
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>
  }
  sessions: { get(id: string): { append(type: string, data: unknown, options: { ignorable: true }): unknown } | undefined }
  connection: { fetch: { register(route: {
    path: string; methods: ('POST')[]; requestBody: 'buffered'; fetch(request: Request): Promise<Response>
  }): () => void } }
}
const object = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid request')
  return value as Record<string, unknown>
}
const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json' },
})

/** Reject unknown keys and invalid bounds before committing settings. */
export function validateNativePatch(value: unknown): Partial<NativeConfig> {
  const patch = object(value)
  for (const [key, item] of Object.entries(patch)) {
    if (!(key in NATIVE_DEFAULTS)) throw new Error(`unknown setting: ${key}`)
    if (key === 'enabled') { if (typeof item !== 'boolean') throw new Error('enabled must be boolean') }
    else if (key === 'provider' || key === 'model') {
      if (typeof item !== 'string' || item.length > 200) throw new Error(`invalid ${key}`)
    } else {
      const bounds = { debounceMs: [100, 5000], timeoutMs: [500, 30000], maxTokens: [8, 256], maxCharacters: [8, 500], maxInputCharacters: [64, 8000] }[key]
      if (bounds === undefined || typeof item !== 'number' || !Number.isInteger(item) || item < bounds[0]! || item > bounds[1]!) throw new Error(`invalid ${key}`)
    }
  }
  return patch as Partial<NativeConfig>
}

/** Build one model request; no agent turn is started and no tools are supplied. */
export function nativeRequest(config: NativeConfig, prefix: string, signal: AbortSignal): GenerateOptions {
  if (config.provider === '' || config.model === '') throw new Error('请选择补齐供应商和模型')
  return {
    provider: config.provider, model: config.model, system: COMPLETION_SYSTEM,
    messages: [createUserMessage({ content: [{ type: 'text', text: prefix.slice(-config.maxInputCharacters) }], source: { kind: 'user' } })],
    maxTokens: config.maxTokens, signal,
  }
}

/** Install routes; the framework supplies same-origin authentication and reversible registration. */
export function apply(ctx: Context, config: Config): void {
  // Structural service faces keep the out-of-tree plugin compatible with the running Host version.
  const services = ctx as unknown as NativeServices
  const scope = {
    get: (): NativeConfig => Object.fromEntries(Object.entries(config).map(([key, value]) => [key, value.get()])) as unknown as NativeConfig,
    update: async (patch: Partial<NativeConfig>): Promise<void> => {
      const descriptor = services.settings.describe().find(item => item.ns === NATIVE_NS)
      if (!descriptor) throw new Error('completion settings are unavailable')
      await services.settings.update(NATIVE_NS, patch, descriptor.revision)
    },
  }
  const inflight = new Set<AbortController>()
  ctx.effect(() => () => { for (const request of inflight) request.abort(); inflight.clear() })
  ctx.effect(() => services.connection.fetch.register({
    path: NATIVE_RPC_PATH, methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      try {
        const body = object(await request.json())
        switch (body.endpoint) {
          case 'config.get': return json({ ok: true, value: scope.get() })
          case 'config.set': {
            const patch = validateNativePatch(body.payload)
            const next = { ...scope.get(), ...patch }
            if ((next.provider === '') !== (next.model === '')) throw new Error('供应商和模型需同时选择')
            await scope.update(patch)
            return json({ ok: true, value: scope.get() })
          }
          case 'models.list': {
            const providers = services.llm.listProviders()
            const results = await Promise.all(providers.map(async provider => {
              try { return { provider: provider.id, name: provider.name, models: await services.llm.listModels(provider.id) } }
              catch { // A provider without a catalog still accepts an explicitly entered model id.
                return { provider: provider.id, name: provider.name, models: [] }
              }
            }))
            return json({ ok: true, value: results })
          }
          default: throw new Error('unknown endpoint')
        }
      } catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : String(error) }) }
    },
  }))
  ctx.effect(() => services.connection.fetch.register({
    path: NATIVE_STREAM_PATH, methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      try {
        const body = object(await request.json())
        if (typeof body.prefix !== 'string' || typeof body.sessionId !== 'string') throw new Error('invalid completion request')
        const config = scope.get()
        const session = services.sessions.get(body.sessionId)
        if (session === undefined) throw new Error('session is not open')
        const prefix = body.prefix.slice(-config.maxInputCharacters)
        if (!config.enabled || prefix.trim().length < 2) return json({ done: '' })
        if (config.provider === '' || config.model === '') throw new Error('请选择补齐供应商和模型')
        const abort = new AbortController()
        inflight.add(abort)
        const linked = linkedTimeoutSignal(config.timeoutMs, AbortSignal.any([request.signal, abort.signal]))
        let options: GenerateOptions
        try {
          options = nativeRequest(config, prefix, linked.signal)
        // Ignorable auxiliary provenance survives uninstall without entering agent history.
        session.append('input/completion-request', {
          provider: options.provider, model: options.model, system: options.system,
          messages: options.messages, maxTokens: options.maxTokens,
          }, { ignorable: true })
        } catch (error) {
          linked.dispose(); inflight.delete(abort)
          throw error
        }
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (payload: object): void => { if (!abort.signal.aborted) controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)) }
            let text = ''
            try {
              for await (const chunk of services.llm.stream(options)) {
                linked.signal.throwIfAborted()
                if (chunk.type === 'text-delta') {
                  const before = normalizeSuggestion(text, config.maxCharacters, prefix)
                  text += chunk.text
                  const after = normalizeSuggestion(text.split('\n')[0] ?? '', config.maxCharacters, prefix)
                  send({ delta: after.slice(before.length) })
                  if (text.includes('\n') || after.length >= config.maxCharacters) break
                } else if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
                  throw new Error(chunk.reason.failure.message)
                }
              }
              send({ done: true })
            } catch (error) {
              if (!request.signal.aborted && !abort.signal.aborted) send({ error: error instanceof Error ? error.message : String(error) })
            } finally {
              linked.dispose(); inflight.delete(abort)
              if (!abort.signal.aborted) controller.close()
            }
          },
          cancel() { abort.abort(); linked.dispose(); inflight.delete(abort) },
        })
        return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } })
      } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 400) }
    },
  }))
}
