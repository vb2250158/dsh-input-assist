/** Settings for the fork's native DSH model route. */
export const NATIVE_NS = 'input-assist'
export interface NativeConfig {
  enabled: boolean
  provider: string
  model: string
  debounceMs: number
  timeoutMs: number
  maxTokens: number
  maxCharacters: number
  maxInputCharacters: number
}
export const NATIVE_DEFAULTS: NativeConfig = {
  enabled: true, provider: '', model: '', debounceMs: 500, timeoutMs: 5000,
  maxTokens: 64, maxCharacters: 200, maxInputCharacters: 2000,
}
