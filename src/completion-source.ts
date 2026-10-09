/** Source labels come from the live Session Controller, never completion-time copies. */
export interface CompletionSourceSnapshot {
  byId: Record<string, { title?: string; displayTitle: string }>
  projectionsBySession: Readonly<Record<string, { values: { title?: string }; state: 'idle' | 'loading' | 'ready' | 'error'; error: { code: string } | null }>>
}

/** Read current titles without retaining or opening a source conversation. */
export function completionSource(snapshot: CompletionSourceSnapshot, id: string): { title: string | null; available: boolean; missing: boolean } {
  const row = snapshot.byId[id]
  const projection = snapshot.projectionsBySession[id]
  const title = projection?.values.title || row?.title || (row?.displayTitle !== id ? row?.displayTitle : null) || null
  const missing = projection?.state === 'error' && projection.error?.code === 'session/not-found'
  return { title, available: !missing && (row !== undefined || projection?.state === 'ready'), missing }
}

/** Client navigation keeps direct-parent addresses intact for child conversations. */
export interface CompletionSessionSources {
  list: { getSnapshot(): CompletionSourceSnapshot; subscribe(listener: () => void): () => void }
  refreshProjections(id: string): Promise<void>
  subagentAddress(id: string): { parentSessionId: string; childSessionId: string; mode: 'one-shot' | 'continuable' | 'unknown' } | undefined
}

/** Open the exact original identity; never create a replacement conversation. */
export function openCompletionSource(sources: CompletionSessionSources, open: (target: string | NonNullable<ReturnType<CompletionSessionSources['subagentAddress']>>) => void, id: string): void {
  open(sources.subagentAddress(id) ?? id)
}
