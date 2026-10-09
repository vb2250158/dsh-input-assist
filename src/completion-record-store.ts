/** Serialized, atomically persisted ring of the latest 100 started requests. */
import { z } from 'zod'
import { COMPLETION_RECORD_LIMIT, completionRecordSchema, completionRecordSummary } from './completion-record.ts'
import type { CompletionRecord, CompletionRecordSummary } from './completion-record.ts'

interface RecordUnit {
  loadAll(): Promise<{ global: unknown }>
  setGlobal(value: unknown): Promise<void>
  close(): Promise<void>
}

/** Open one owned storage unit. Invalid persisted data is preserved and rejected. */
export async function createCompletionRecordStore(unit: RecordUnit) {
  let records: CompletionRecord[]
  try {
    const persisted = (await unit.loadAll()).global
    records = persisted === null ? [] : z.array(completionRecordSchema).max(COMPLETION_RECORD_LIMIT).parse(persisted)
    const interrupted = records.map(record => record.status === 'pending' ? { ...record, status: 'interrupted' as const } : record)
    if (records.some(record => record.status === 'pending')) await unit.setGlobal(interrupted)
    records = interrupted
  } catch (error) {
    await unit.close()
    throw error
  }
  let closed = false
  let writes = Promise.resolve()
  const enqueue = (update: () => CompletionRecord[]): Promise<void> => {
    if (closed) return Promise.reject(new Error('completion history is closed'))
    const write = writes.then(async () => {
      const next = update()
      await unit.setGlobal(next)
      records = next
    })
    // A rejected write remains visible to its caller without poisoning later retries.
    writes = write.catch((_error) => {})
    return write
  }
  return {
    async list(): Promise<CompletionRecordSummary[]> { await writes; return records.map(completionRecordSummary) },
    async get(id: string): Promise<CompletionRecord | undefined> { await writes; return records.find(record => record.id === id) },
    begin(record: CompletionRecord): Promise<void> {
      return enqueue(() => [record, ...records].sort((a, b) => b.startedAt - a.startedAt).slice(0, COMPLETION_RECORD_LIMIT))
    },
    finish(id: string, patch: Partial<Pick<CompletionRecord, 'status' | 'elapsedMs' | 'firstTokenMs' | 'usage' | 'result' | 'error' | 'truncated'>>): Promise<void> {
      return enqueue(() => records.map(record => record.id === id ? { ...record, ...patch } : record))
    },
    async close(): Promise<void> { closed = true; await writes; await unit.close() },
  }
}
