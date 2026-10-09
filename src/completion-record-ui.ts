/** Native themed history dialog with summary rows and on-demand request details. */
import * as React from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CompletionRecord, CompletionRecordSummary } from './completion-record.ts'
const h = React.createElement
export const recordDictionaries = {
  zh: { records: '补齐记录', recordsHint: '所有会话的最近 100 条请求，按发起时间排序。', recordsEmpty: '暂无补齐记录', recordsLoading: '加载补齐记录…', refresh: '刷新', result: '补齐结果', actualContext: '实际发送的上下文', elapsed: '耗时', firstToken: '首字耗时', tokens: 'Token 用量', notReturned: '未返回', inputTokens: '未缓存输入', outputTokens: '输出', cacheReadTokens: '缓存读取', cacheWriteTokens: '缓存写入', reasoningTokens: '推理', totalTokens: '总计', session: '来源会话', requestLimit: '请求输出上限', truncated: '达到建议长度或换行后提前结束，用量可能未返回。', recordPending: '请求中', recordSuccess: '完成', recordEmpty: '无建议', recordCancelled: '已取消', recordTimeout: '超时', recordError: '失败', recordInterrupted: '宿主中断' },
  en: { records: 'Completion history', recordsHint: 'Latest 100 requests across conversations, ordered by start time.', recordsEmpty: 'No completion records', recordsLoading: 'Loading completion records…', refresh: 'Refresh', result: 'Suggestion', actualContext: 'Context actually sent', elapsed: 'Duration', firstToken: 'First token', tokens: 'Token usage', notReturned: 'Not returned', inputTokens: 'Uncached input', outputTokens: 'Output', cacheReadTokens: 'Cache read', cacheWriteTokens: 'Cache write', reasoningTokens: 'Reasoning', totalTokens: 'Total', session: 'Source conversation', requestLimit: 'Request output limit', truncated: 'Stopped at the suggestion limit or line break; usage may not have been returned.', recordPending: 'In progress', recordSuccess: 'Complete', recordEmpty: 'No suggestion', recordCancelled: 'Cancelled', recordTimeout: 'Timed out', recordError: 'Failed', recordInterrupted: 'Host interrupted' },
}
interface Props {
  open: boolean
  onClose(): void
  rpc<T>(endpoint: string, payload?: unknown): Promise<T>
  t(key: string): string
}
const statusKeys = { pending: 'recordPending', success: 'recordSuccess', empty: 'recordEmpty', cancelled: 'recordCancelled', timeout: 'recordTimeout', error: 'recordError', interrupted: 'recordInterrupted' }

/** Render only persisted records; provider omissions stay distinct from zero usage. */
export function CompletionRecords({ open, onClose, rpc, t }: Props): React.ReactNode {
  const [rows, setRows] = React.useState<CompletionRecordSummary[]>([])
  const [detail, setDetail] = React.useState<CompletionRecord | null>(null)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [revision, setRevision] = React.useState(0)
  const detailSeq = React.useRef(0)
  React.useEffect(() => {
    detailSeq.current++
    if (!open) return
    let active = true
    setLoading(true); setError(''); setDetail(null)
    void rpc<CompletionRecordSummary[]>('history.list').then(value => { if (active) setRows(value) }, error => { if (active) setError(String(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; detailSeq.current++ }
  }, [open, revision, rpc])
  const select = async (id: string): Promise<void> => {
    const seq = ++detailSeq.current
    setLoading(true); setError('')
    try { const record = await rpc<CompletionRecord>('history.get', { id }); if (seq === detailSeq.current) setDetail(record) }
    catch (error) { if (seq === detailSeq.current) setError(String(error)) }
    finally { if (seq === detailSeq.current) setLoading(false) }
  }
  const time = (ms: number | null): string => ms === null ? t('notReturned') : `${(ms / 1000).toFixed(2)} s`
  const total = (row: CompletionRecordSummary): string => row.usage === null ? t('notReturned') : String(row.usage.totalTokens ?? row.usage.inputTokens + row.usage.outputTokens + (row.usage.cacheReadTokens ?? 0) + (row.usage.cacheWriteTokens ?? 0))
  const block = (label: string, value: string): React.ReactNode => h('section', { className: 'dsh-completion-record-section' }, h('strong', null, label), h('pre', { className: 'dsh-completion-record-text' }, value))
  return h(Modal, { open, onClose, title: t('records'), closeLabel: t('close'), className: 'dsh-completion-record-dialog', contentClassName: 'dsh-completion-content',
    footer: h('div', { className: 'dsh-completion-footer' }, detail ? h(Button, { onClick: () => { detailSeq.current++; setDetail(null); setLoading(false) } }, t('back')) : h(Button, { disabled: loading, onClick: () => setRevision(value => value + 1) }, t('refresh')), h(Button, { onClick: onClose }, t('close'))),
  },
    h('div', { className: 'dsh-completion-note' }, t('recordsHint')),
    loading ? h('div', { role: 'status', className: 'dsh-completion-note' }, t('recordsLoading')) : null,
    error ? h('div', { role: 'alert', className: 'dsh-completion-note' }, error) : null,
    detail ? h('div', { className: 'dsh-completion-record-detail' },
      h('strong', null, `${detail.provider} · ${detail.model} · ${t(statusKeys[detail.status])}`),
      h('div', { className: 'dsh-completion-note' }, new Date(detail.startedAt).toLocaleString()),
      h('div', null, `${t('elapsed')}: ${time(detail.elapsedMs)} · ${t('firstToken')}: ${time(detail.firstTokenMs)}`),
      h('div', null, `${t('tokens')}: ${total(detail)}`),
      detail.usage ? h('div', { className: 'dsh-completion-note' }, Object.entries(detail.usage).map(([key, value]) => `${t(key)}: ${value}`).join(' · ')) : null,
      h('div', { className: 'dsh-completion-note' }, `${t('session')}: ${detail.sessionId} · ${t('requestLimit')}: ${detail.maxTokens}`),
      block(t('result'), detail.result || t('recordEmpty')),
      detail.error ? block(t('error'), detail.error) : null,
      detail.truncated ? h('div', { className: 'dsh-completion-note' }, t('truncated')) : null,
      block(t('prompt'), detail.system),
      ...detail.messages.map((message, index) => h(React.Fragment, { key: index }, block(`${t('actualContext')} ${index + 1} · ${message.role}`, message.text))),
    ) : h('div', { className: 'dsh-completion-record-list' },
      !loading && rows.length === 0 ? h('div', { className: 'dsh-completion-note' }, t('recordsEmpty')) : null,
      ...rows.map(row => h(Button, { key: row.id, variant: 'ghost', className: 'dsh-completion-record-row', onClick: () => { void select(row.id) } },
        h('span', { className: 'dsh-completion-record-line' }, h('strong', null, `${row.provider} · ${row.model}`), h('span', null, t(statusKeys[row.status]))),
        h('span', { className: 'dsh-completion-record-line dsh-completion-note' }, h('span', null, new Date(row.startedAt).toLocaleString()), h('span', null, `${time(row.elapsedMs)} · ${t('tokens')}: ${total(row)}`)),
        h('span', { className: 'dsh-completion-record-preview' }, row.result || row.error || t(statusKeys[row.status])))),
    ),
  )
}
