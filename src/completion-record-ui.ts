/** Native themed history dialog with summary rows and on-demand request details. */
import * as React from 'react'
import { Button, Modal, Input, SegmentedControl, Tag, DisclosureRow, IconInfoOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CompletionRecord, CompletionRecordSummary } from './completion-record.ts'
import { completionSource } from './completion-source.ts'
import type { CompletionSessionSources } from './completion-source.ts'
const h = React.createElement
const historyUx = {
  zh: { searchRecords: '搜索会话、模型或补齐内容', recordFilter: '筛选补齐记录', allRecords: '全部', completedRecords: '完成', failedRecords: '异常', cancelledRecords: '取消', noMatches: '没有匹配的记录', unnamedSession: '未命名会话', missingSession: '来源会话已不存在', sourceLoading: '读取来源会话…', sourceError: '会话信息读取失败', openSource: '打开来源会话', diagnostics: '请求详情', visibleRecords: '条记录', retry: '重试' },
  en: { searchRecords: 'Search conversations, models or suggestions', recordFilter: 'Filter completion history', allRecords: 'All', completedRecords: 'Complete', failedRecords: 'Errors', cancelledRecords: 'Cancelled', noMatches: 'No matching records', unnamedSession: 'Untitled conversation', missingSession: 'Source conversation no longer exists', sourceLoading: 'Reading source conversation…', sourceError: 'Could not read conversation information', openSource: 'Open source conversation', diagnostics: 'Request details', visibleRecords: 'records', retry: 'Retry' },
}
export const recordDictionaries = {
  zh: { ...historyUx.zh, records: '补齐记录', recordsHint: '所有会话的最近 100 条请求，按发起时间排序。', recordsEmpty: '暂无补齐记录', recordsLoading: '加载补齐记录…', refresh: '刷新', result: '补齐结果', actualContext: '实际发送的上下文', elapsed: '耗时', firstToken: '首字耗时', tokens: 'Token 用量', notReturned: '未返回', inputTokens: '未缓存输入', outputTokens: '输出', cacheReadTokens: '缓存读取', cacheWriteTokens: '缓存写入', reasoningTokens: '推理', totalTokens: '总计', session: '来源会话', requestLimit: '请求输出上限', truncated: '达到建议长度或换行后提前结束，用量可能未返回。', recordPending: '请求中', recordSuccess: '完成', recordEmpty: '无建议', recordCancelled: '已取消', recordTimeout: '超时', recordError: '失败', recordInterrupted: '宿主中断' },
  en: { ...historyUx.en, records: 'Completion history', recordsHint: 'Latest 100 requests across conversations, ordered by start time.', recordsEmpty: 'No completion records', recordsLoading: 'Loading completion records…', refresh: 'Refresh', result: 'Suggestion', actualContext: 'Context actually sent', elapsed: 'Duration', firstToken: 'First token', tokens: 'Token usage', notReturned: 'Not returned', inputTokens: 'Uncached input', outputTokens: 'Output', cacheReadTokens: 'Cache read', cacheWriteTokens: 'Cache write', reasoningTokens: 'Reasoning', totalTokens: 'Total', session: 'Source conversation', requestLimit: 'Request output limit', truncated: 'Stopped at the suggestion limit or line break; usage may not have been returned.', recordPending: 'In progress', recordSuccess: 'Complete', recordEmpty: 'No suggestion', recordCancelled: 'Cancelled', recordTimeout: 'Timed out', recordError: 'Failed', recordInterrupted: 'Host interrupted' },
}
interface Props {
  open: boolean
  onClose(): void
  rpc<T>(endpoint: string, payload?: unknown): Promise<T>
  t(key: string): string
  sources: CompletionSessionSources
  openSession(id: string): void
}
const statusKeys = { pending: 'recordPending', success: 'recordSuccess', empty: 'recordEmpty', cancelled: 'recordCancelled', timeout: 'recordTimeout', error: 'recordError', interrupted: 'recordInterrupted' }

/** Render only persisted records; provider omissions stay distinct from zero usage. */
export function CompletionRecords({ open, onClose, rpc, t: translate, sources, openSession }: Props): React.ReactNode {
  const t = (key: string): string => translate(key)
  const subscribe = React.useCallback((listener: () => void) => sources.list.subscribe(listener), [sources])
  const getSnapshot = React.useCallback(() => sources.list.getSnapshot(), [sources])
  const catalog = React.useSyncExternalStore(subscribe, getSnapshot)
  const [rows, setRows] = React.useState<CompletionRecordSummary[]>([])
  const [detail, setDetail] = React.useState<CompletionRecord | null>(null)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [revision, setRevision] = React.useState(0)
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState('all')
  const [diagnostics, setDiagnostics] = React.useState(false)
  const [sourceRevision, setSourceRevision] = React.useState(0)
  const [sourceError, setSourceError] = React.useState('')
  const detailSeq = React.useRef(0)
  React.useEffect(() => {
    detailSeq.current++
    if (!open) return
    let active = true
    setLoading(true); setError(''); setDetail(null); setQuery(''); setFilter('all'); setDiagnostics(false)
    void rpc<CompletionRecordSummary[]>('history.list').then(value => { if (active) setRows(value) }, error => { if (active) setError(String(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; detailSeq.current++ }
  }, [open, revision, rpc])
  const select = async (id: string): Promise<void> => {
    const seq = ++detailSeq.current
    setLoading(true); setError(''); setSourceError(''); setDiagnostics(false)
    try { const record = await rpc<CompletionRecord>('history.get', { id }); if (seq === detailSeq.current) setDetail(record) }
    catch (error) { if (seq === detailSeq.current) setError(String(error)) }
    finally { if (seq === detailSeq.current) setLoading(false) }
  }
  React.useEffect(() => {
    if (!open || !detail) return
    let active = true
    setSourceError('')
    void sources.refreshProjections(detail.sessionId).catch(error => { if (active) setSourceError(String(error)) })
    return () => { active = false }
  }, [open, detail?.sessionId, sources, sourceRevision])
  const time = (ms: number | null): string => ms === null ? t('notReturned') : `${(ms / 1000).toFixed(2)} s`
  const total = (row: CompletionRecordSummary): string => row.usage === null ? t('notReturned') : String(row.usage.totalTokens ?? row.usage.inputTokens + row.usage.outputTokens + (row.usage.cacheReadTokens ?? 0) + (row.usage.cacheWriteTokens ?? 0))
  const block = (label: string, value: string): React.ReactNode => h('section', { className: 'dsh-completion-record-section' }, h('strong', null, label), h('pre', { className: 'dsh-completion-record-text' }, value))
  const source = detail ? completionSource(catalog, detail.sessionId) : null
  const visible = rows.filter(row => completionRecordMatches(row, query, filter, completionSource(catalog, row.sessionId).title ?? ''))
  const status = (row: CompletionRecordSummary): React.ReactNode => h(Tag, { tone: row.status === 'success' ? 'success' : row.status === 'error' || row.status === 'timeout' ? 'danger' : row.status === 'pending' ? 'info' : 'quiet' }, t(statusKeys[row.status]))
  return h(Modal, { open, onClose, title: t('records'), closeLabel: t('close'), className: 'dsh-completion-record-dialog', contentClassName: 'dsh-completion-content',
    footer: h('div', { className: 'dsh-completion-footer' }, detail ? h(Button, { onClick: () => { detailSeq.current++; setDetail(null); setLoading(false) } }, t('back')) : h(Button, { disabled: loading, onClick: () => setRevision(value => value + 1) }, t('refresh')), h(Button, { onClick: onClose }, t('close'))),
  },
    h('div', { className: 'dsh-completion-note' }, t('recordsHint')),
    !detail ? h('div', { className: 'dsh-completion-record-toolbar' },
      h(Input, { value: query, placeholder: t('searchRecords'), 'aria-label': t('searchRecords'), onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value) }),
      h(SegmentedControl, { id: 'completion-history-filter', label: t('recordFilter'), value: filter, onChange: setFilter, options: [{ value: 'all', label: t('allRecords') }, { value: 'success', label: t('completedRecords') }, { value: 'error', label: t('failedRecords') }, { value: 'cancelled', label: t('cancelledRecords') }] }),
      h('span', { role: 'status', className: 'dsh-completion-note' }, `${visible.length} / ${rows.length} ${t('visibleRecords')}`)) : null,
    loading ? h('div', { role: 'status', className: 'dsh-completion-note' }, t('recordsLoading')) : null,
    error ? h('div', { role: 'alert', className: 'dsh-completion-note' }, error) : null,
    detail ? h('div', { className: 'dsh-completion-record-detail' },
      h('div', { className: 'dsh-completion-record-line' }, h('strong', null, `${detail.provider} · ${detail.model}`), status(detail)),
      h('div', { className: 'dsh-completion-note' }, new Date(detail.startedAt).toLocaleString()),
      h('div', { className: 'dsh-completion-metrics' }, h('div', null, h('span', null, t('elapsed')), h('strong', null, time(detail.elapsedMs))), h('div', null, h('span', null, t('firstToken')), h('strong', null, time(detail.firstTokenMs))), h('div', null, h('span', null, t('tokens')), h('strong', null, total(detail)))),
      detail.usage ? h('div', { className: 'dsh-completion-note' }, Object.entries(detail.usage).map(([key, value]) => `${t(key)}: ${value}`).join(' · ')) : null,
      h('div', { className: 'dsh-completion-source' }, h('span', null, `${t('session')}:`),
        source?.available ? h(Button, { variant: 'ghost', className: 'dsh-completion-source-link', 'aria-label': `${t('openSource')}: ${source.title ?? t('unnamedSession')}`, onClick: () => { try { openSession(detail.sessionId); onClose() } catch (error) { setSourceError(String(error)) } } }, source.title ?? t('unnamedSession')) : h('span', null, source?.missing ? t('missingSession') : sourceError ? t('sourceError') : t('sourceLoading'))),
      sourceError && !source?.missing ? h('div', { className: 'dsh-completion-note', role: 'alert' }, sourceError, h(Button, { size: 'sm', onClick: () => setSourceRevision(value => value + 1) }, t('retry'))) : null,
      block(t('result'), detail.result || t('recordEmpty')),
      detail.error ? block(t('error'), detail.error) : null,
      detail.truncated ? h('div', { className: 'dsh-completion-note' }, t('truncated')) : null,
      block(t('prompt'), detail.system),
      ...detail.messages.map((message, index) => h(React.Fragment, { key: index }, block(`${t('actualContext')} ${index + 1} · ${message.role}`, message.text))),
      h(DisclosureRow, { title: t('diagnostics'), icon: h(IconInfoOutlineRegular, { size: 16 }), open: diagnostics, expandable: true, expandOnRowClick: true, onToggle: () => setDiagnostics(value => !value) }, block(t('session'), detail.sessionId), h('div', { className: 'dsh-completion-note' }, `${t('requestLimit')}: ${detail.maxTokens}`)),
    ) : h('div', { className: 'dsh-completion-record-list', role: 'tabpanel', id: `completion-history-filter-${filter}-panel`, 'aria-labelledby': `completion-history-filter-${filter}` },
      !loading && rows.length === 0 ? h('div', { className: 'dsh-completion-note' }, t('recordsEmpty')) : null,
      !loading && rows.length > 0 && visible.length === 0 ? h('div', { className: 'dsh-completion-note' }, t('noMatches')) : null,
      ...visible.map(row => h(Button, { key: row.id, variant: 'ghost', className: 'dsh-completion-record-row', onClick: () => { void select(row.id) } },
        h('span', { className: 'dsh-completion-record-line' }, h('strong', null, `${row.provider} · ${row.model}`), status(row)),
        h('span', { className: 'dsh-completion-record-preview' }, completionSource(catalog, row.sessionId).title ?? t('unnamedSession')),
        h('span', { className: 'dsh-completion-record-line dsh-completion-note' }, h('span', null, new Date(row.startedAt).toLocaleString()), h('span', null, `${time(row.elapsedMs)} · ${t('tokens')}: ${total(row)}`)),
        h('span', { className: 'dsh-completion-record-preview' }, row.result || row.error || t(statusKeys[row.status])))),
    ),
  )
}

/** Filter only the loaded, bounded summaries; searching never changes saved records. */
export function completionRecordMatches(row: CompletionRecordSummary, query: string, filter: string, title: string): boolean {
  const matchesStatus = filter === 'all' || (filter === 'error' ? ['error', 'timeout', 'interrupted'].includes(row.status) : row.status === filter)
  return matchesStatus && `${title}\n${row.provider}\n${row.model}\n${row.result}\n${row.error}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
}
