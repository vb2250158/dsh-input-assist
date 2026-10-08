/** Replayable final-reply and file-change facts; no synchronous historical event reads. */
import { z } from 'zod'

const fileChange = z.object({ path: z.string(), operation: z.string(), updatedSnippetLines: z.number(), previousSnippetLines: z.number() })
const pendingCall = z.object({ name: z.string(), arguments: z.string() })
const stateSchema = z.object({
  lastAssistant: z.string().nullable(),
  finalAssistantIds: z.record(z.string(), z.literal(true)),
  filesByResultId: z.record(z.string(), z.array(fileChange)),
  pendingCalls: z.record(z.string(), pendingCall),
})
export type ContextFacts = z.infer<typeof stateSchema>
export const CONTEXT_FACTS_KEY = 'inputCompletionContext'

const eventSchema = z.object({ type: z.string(), data: z.unknown() })
const assistantSchema = z.object({ message: z.object({ id: z.string(), content: z.array(z.object({ type: z.string() })) }), interrupted: z.boolean().optional() })
const resultSchema = z.object({ message: z.object({ id: z.string(), toolCallId: z.string(), isError: z.boolean().optional() }), meta: z.unknown().optional() })
const diffMeta = z.object({ diffs: z.array(z.object({ path: z.string(), oldText: z.string().nullable(), newText: z.string() })), operation: z.string().optional() })

/** Restore facts from validated event envelopes and tool-owned JSON metadata. */
export function foldContextFacts(state: ContextFacts, input: unknown): ContextFacts {
  const event = eventSchema.parse(input)
  if (event.type === 'turn/start') return { ...state, lastAssistant: null, pendingCalls: {} }
  if (event.type === 'assistant/message') {
    const { message, interrupted } = assistantSchema.parse(event.data)
    return { ...state, lastAssistant: interrupted || message.content.some(part => part.type === 'tool-call') ? null : message.id }
  }
  if (event.type === 'turn/end') {
    const completed = z.object({ reason: z.object({ kind: z.string() }) }).parse(event.data).reason.kind === 'completed'
    return { ...state, lastAssistant: null, finalAssistantIds: completed && state.lastAssistant
      ? { ...state.finalAssistantIds, [state.lastAssistant]: true } : state.finalAssistantIds }
  }
  if (event.type === 'tool/call') {
    const call = pendingCall.extend({ callId: z.string() }).parse(event.data)
    return { ...state, pendingCalls: { ...state.pendingCalls, [call.callId]: { name: call.name, arguments: call.arguments } } }
  }
  if (event.type !== 'tool/result') return state
  const { message, meta } = resultSchema.parse(event.data)
  const call = state.pendingCalls[message.toolCallId]
  const pendingCalls = { ...state.pendingCalls }
  delete pendingCalls[message.toolCallId]
  const parsed = diffMeta.safeParse(meta)
  const files: ContextFacts['filesByResultId'][string] = []
  if (!message.isError && parsed.success) {
    for (const diff of parsed.data.diffs) files.push({ path: diff.path, operation: parsed.data.operation ?? 'update',
      updatedSnippetLines: diff.newText === '' ? 0 : diff.newText.split('\n').length,
      previousSnippetLines: diff.oldText ? diff.oldText.split('\n').length : 0 })
    if (parsed.data.operation === 'create' && files.length === 0 && call?.name === 'write') {
      let args: unknown
      try { args = JSON.parse(call.arguments) } catch { /* Invalid recorded arguments cannot identify a created file. */ }
      const created = z.object({ file_path: z.string(), content: z.string() }).safeParse(args)
      if (created.success) files.push({ path: created.data.file_path, operation: 'create', updatedSnippetLines: created.data.content.split('\n').length, previousSnippetLines: 0 })
    }
  }
  return { ...state, pendingCalls, filesByResultId: files.length > 0 ? { ...state.filesByResultId, [message.id]: files } : state.filesByResultId }
}

/** Host-only projection, reconstructed on resume and updated by the registry. */
export const contextFactsProjection = {
  key: CONTEXT_FACTS_KEY, stateSchema, stateVersion: 1,
  init: (): ContextFacts => ({ lastAssistant: null, finalAssistantIds: {}, filesByResultId: {}, pendingCalls: {} }),
  apply: foldContextFacts,
}
