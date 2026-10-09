/** Private, profile-wide completion history; contains only input actually sent to the model. */
import { z } from 'zod'

export const COMPLETION_RECORD_LIMIT = 100
const usageSchema = z.object({
  inputTokens: z.number().nonnegative(), outputTokens: z.number().nonnegative(),
  totalTokens: z.number().nonnegative().optional(), cacheReadTokens: z.number().nonnegative().optional(),
  cacheWriteTokens: z.number().nonnegative().optional(), reasoningTokens: z.number().nonnegative().optional(),
})
export const completionRecordSchema = z.object({
  id: z.string(), sessionId: z.string(), provider: z.string(), model: z.string(), startedAt: z.number(),
  status: z.enum(['pending', 'success', 'empty', 'cancelled', 'timeout', 'error', 'interrupted']),
  elapsedMs: z.number().nonnegative().nullable(), firstTokenMs: z.number().nonnegative().nullable(),
  system: z.string(), messages: z.array(z.object({ role: z.string(), text: z.string() })),
  maxTokens: z.number(), result: z.string(), error: z.string(), usage: usageSchema.nullable(),
  truncated: z.boolean(),
})
export type CompletionRecord = z.infer<typeof completionRecordSchema>
export type CompletionRecordSummary = Omit<CompletionRecord, 'system' | 'messages'>

/** List rows exclude potentially long prompts; details are read only when opened. */
export function completionRecordSummary(record: CompletionRecord): CompletionRecordSummary {
  const { system: _system, messages: _messages, ...summary } = record
  return summary
}
