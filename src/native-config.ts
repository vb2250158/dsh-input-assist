/** Settings for the fork's native DSH model route. */
export const NATIVE_NS = 'input-assist'
/** Default continuation instruction, editable independently of the conversation prompt. */
export const DEFAULT_COMPLETION_PROMPT = '续写用户正在输入的请求。只输出可以直接接在原文后面的短文本，保持原文语言和语气。不要回答请求，不要解释，不要重复原文，不要添加引号或 Markdown。最多续写一句；信息不足时输出空文本。'
export interface NativeConfig {
  enabled: boolean
  provider: string
  model: string
  debounceMs: number
  timeoutMs: number
  maxTokens: number
  maxCharacters: number
  maxInputCharacters: number
  systemPrompt: string
  includeHistory: boolean
  historyMessageLimit: number
  maxHistoryCharacters: number
  includeClipboard: boolean
  maxClipboardCharacters: number
}
export const NATIVE_DEFAULTS: NativeConfig = {
  enabled: true, provider: '', model: '', debounceMs: 500, timeoutMs: 5000,
  maxTokens: 64, maxCharacters: 200, maxInputCharacters: 2000,
  systemPrompt: DEFAULT_COMPLETION_PROMPT,
  includeHistory: false, historyMessageLimit: 4, maxHistoryCharacters: 4000,
  includeClipboard: false, maxClipboardCharacters: 2000,
}
