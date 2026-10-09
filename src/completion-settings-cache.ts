/** Page-scoped completion settings mirrored from the Host; composer mounts share reads. */
import { createSnapshotStore } from './snapshot-store.ts'
import type { NativeConfig } from './native-config.ts'

/** Availability and last read error of the page's shared settings. */
export interface CompletionSettingsState {
  ready: boolean
  loading: boolean
  error: string
}

/**
 * Keep one settings read in flight, refreshing only on explicit invalidation.
 * @param read Host settings reader.
 * @param initial Disabled settings used before the first successful read.
 * @returns Shared settings, load state and lifecycle operations; failures remain retryable.
 */
export function createCompletionSettingsCache(read: () => Promise<NativeConfig>, initial: NativeConfig) {
  const config = createSnapshotStore(initial)
  const state = createSnapshotStore<CompletionSettingsState>({ ready: false, loading: false, error: '' })
  let generation = 0
  let disposed = false
  let pending: Promise<void> | undefined
  let refreshQueued = false

  const ensureRead = (): Promise<void> => {
    if (disposed) return Promise.resolve()
    if (pending) return pending
    refreshQueued = true
    state.set({ ...state.getSnapshot(), loading: true, error: '' })
    pending = Promise.resolve().then(async () => {
      while (refreshQueued && !disposed) {
        refreshQueued = false
        const readingGeneration = generation
        try {
          const value = await read()
          if (!disposed && generation === readingGeneration) {
            config.set(value)
            state.set({ ready: true, loading: true, error: '' })
          }
        } catch (error) {
          if (!disposed && generation === readingGeneration) {
            state.set({ ...state.getSnapshot(), error: String(error) })
          }
        }
      }
    }).finally(() => {
      pending = undefined
      if (!disposed) state.set({ ...state.getSnapshot(), loading: false })
    })
    return pending
  }

  return {
    config, state,
    ensureLoaded(): Promise<void> {
      const snapshot = state.getSnapshot()
      return snapshot.ready && !snapshot.error ? Promise.resolve() : ensureRead()
    },
    refresh(): Promise<void> {
      ++generation
      refreshQueued = true
      return ensureRead()
    },
    commit(value: NativeConfig): void {
      if (disposed) return
      ++generation
      refreshQueued = false
      config.set(value)
      state.set({ ready: true, loading: false, error: '' })
    },
    reset(): Promise<void> {
      ++generation
      config.set(initial)
      state.set({ ready: false, loading: true, error: '' })
      refreshQueued = true
      return ensureRead()
    },
    dispose(): void {
      disposed = true
      ++generation
      refreshQueued = false
    },
  }
}
