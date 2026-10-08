/** Selected references from the derived message surface and replayed context facts. */
import type { Message } from '@deepseek-ai/dsh-llm'
import type { NativeConfig } from './native-config.ts'
import type { ContextFacts } from './context-facts.ts'

/** Apply independent content filters before the count and character budgets. */
export function historyReferences(config: NativeConfig, messages: readonly Message[], facts?: ContextFacts): { role: string; text: string }[] {
  const rows: { role: string; text: string }[] = []
  for (const message of messages) {
    const text = message.content.filter(part => part.type === 'text').map(part => part.text).join('')
    if (message.role === 'user' && message.source.kind === 'user' && !config.excludeUserMessages && text.trim()) rows.push({ role: 'user', text })
    if (message.role === 'assistant') {
      if (text.trim() && (!config.excludeIntermediateAssistant || facts?.finalAssistantIds[message.id])) rows.push({ role: 'assistant', text })
      if (config.includeToolCalls) for (const part of message.content) {
        if (part.type === 'tool-call') rows.push({ role: 'tool-call', text: JSON.stringify({ id: part.id, name: part.name, arguments: part.arguments }) })
      }
    }
    if (message.role === 'tool') {
      if (config.includeToolCalls && text.trim()) rows.push({ role: 'tool-result', text: JSON.stringify({ callId: message.toolCallId, isError: message.isError ?? false, text }) })
      if (config.includeFileChanges && facts?.filesByResultId[message.id]) rows.push({ role: 'file-change', text: JSON.stringify(facts.filesByResultId[message.id]) })
    }
  }
  let budget = config.maxHistoryCharacters
  const bounded: typeof rows = []
  for (const row of rows.slice(-config.historyMessageLimit).reverse()) {
    if (budget <= 0) break
    const text = row.text.slice(-budget)
    bounded.unshift({ role: row.role, text })
    budget -= text.length
  }
  return bounded
}
