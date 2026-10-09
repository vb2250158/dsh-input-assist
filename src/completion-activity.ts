/** Request activity shared by the completion binding and its toolbar control. */
import { createSnapshotStore } from './snapshot-store.ts'

/** Track only the latest request per composer; abort clears activity immediately.
 * @returns The reactive activity store and a streaming request wrapper.
 */
export function createCompletionActivity() {
  const store = createSnapshotStore<{ sessions: Record<string, boolean> }>({ sessions: {} })
  const requests = new Map<string, symbol>()
  async function* track(sessionId: string, signal: AbortSignal, source: () => AsyncIterable<string>): AsyncIterable<string> {
    signal.throwIfAborted()
    const token = Symbol()
    requests.set(sessionId, token)
    store.set({ sessions: { ...store.getSnapshot().sessions, [sessionId]: true } })
    const finish = (): void => {
      if (requests.get(sessionId) !== token) return
      requests.delete(sessionId)
      const sessions = { ...store.getSnapshot().sessions }
      delete sessions[sessionId]
      store.set({ sessions })
    }
    signal.addEventListener('abort', finish, { once: true })
    try { yield* source() }
    finally { signal.removeEventListener('abort', finish); finish() }
  }
  return { store, track }
}
