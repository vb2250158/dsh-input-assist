/** Page-scoped writes keep fast model and switch edits ordered across composer mounts. */
import { createSnapshotStore } from './snapshot-store.ts'
import type { NativeConfig } from './native-config.ts'

/** Save feedback remains available when the user closes a settings surface. */
export interface CompletionSaveState {
  status: 'idle' | 'saving' | 'saved' | 'error'
  error: string
}

/**
 * Apply edits immediately and serialize partial Host writes, coalescing queued edits.
 * A failed latest write restores the last confirmed settings and retains one retry.
 * @param read - current page settings.
 * @param write - partial settings writer returning the Host's complete readback.
 * @param commit - publishes settings and invalidates stale cache reads.
 * @returns shared save feedback, edits, retry and Host/plugin lifecycle operations.
 */
export function createCompletionAutosave(read: () => NativeConfig, write: (patch: Partial<NativeConfig>, signal: AbortSignal) => Promise<NativeConfig>, commit: (value: NativeConfig) => void) {
  const state = createSnapshotStore<CompletionSaveState>({ status: 'idle', error: '' })
  let queued: Partial<NativeConfig> | undefined
  let failed: Partial<NativeConfig> | undefined
  let confirmed: NativeConfig | undefined
  let running: Promise<void> | undefined
  let generation = 0
  let disposed = false
  let activeRequest: AbortController | undefined
  const nextPatch = (): Partial<NativeConfig> | undefined => queued

  const drain = (): Promise<void> => {
    if (running) return running
    running = Promise.resolve().then(async () => {
      while (queued && !disposed) {
        const patch = queued
        const writingGeneration = generation
        queued = undefined
        const request = new AbortController()
        activeRequest = request
        try {
          const value = await write(patch, request.signal)
          if (disposed || generation !== writingGeneration) continue
          confirmed = value
          const next = nextPatch()
          commit({ ...value, ...next })
          if (!next) state.set({ status: 'saved', error: '' })
        } catch (error) {
          if (disposed || generation !== writingGeneration) continue
          const next = nextPatch()
          if (next) { queued = { ...patch, ...next }; continue }
          failed = patch
          if (confirmed) commit(confirmed)
          state.set({ status: 'error', error: String(error) })
        } finally {
          if (activeRequest === request) activeRequest = undefined
        }
      }
    }).finally(() => {
      running = undefined
      if (queued && !disposed) void drain()
    })
    return running
  }
  const change = (patch: Partial<NativeConfig>): void => {
    if (disposed) return
    if (!running || !confirmed) confirmed = read()
    failed = undefined
    queued = { ...queued, ...patch }
    commit({ ...read(), ...patch })
    state.set({ status: 'saving', error: '' })
    void drain()
  }
  return {
    state, change,
    retry(): void { if (failed) change(failed) },
    reset(): void {
      ++generation; queued = undefined; failed = undefined; confirmed = undefined
      activeRequest?.abort()
      state.set({ status: 'idle', error: '' })
    },
    dispose(): Promise<void> {
      disposed = true; ++generation; queued = undefined; failed = undefined
      activeRequest?.abort()
      return running ?? Promise.resolve()
    },
    whenIdle(): Promise<void> { return running ?? Promise.resolve() },
  }
}
