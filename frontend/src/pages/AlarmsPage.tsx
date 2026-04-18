import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, Search } from 'lucide-react'
import { apiGet } from '../lib/api'
import { ApiError } from '../lib/api'
import { InlineBadge, alarmTone } from '../components/scada/ScadaUi'
import AlarmDetailModal from '../components/scada/AlarmDetailModal'
import { ALARMS_LIST_PAGE_SIZE } from '../config/app'

type AlarmRow = {
  alarmId: string
  deviceId: string
  deviceName: string
  tagName: string | null
  severity: string
  occurredAt: string
  acknowledged: boolean
}

type AlarmListData = {
  items: AlarmRow[]
  pageInfo: { page: number; size: number; totalElements: number; totalPages: number }
}

/** 백엔드 `OpenAlarmCount` — Jackson 설정에 따라 키가 달라질 수 있어 둘 다 허용 */
function readOpenAlarmCount(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const o = payload as Record<string, unknown>
  const raw = o.count ?? o.openAlarmCount
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(d)
}

function freshnessFromOccurred(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000)
  if (diffSec < 0) return '—'
  if (diffSec < 8) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function ackBadgeTone(ack: boolean): string {
  return ack
    ? 'border-emerald-500/35 bg-emerald-950/35 text-emerald-100'
    : 'border-slate-600 bg-slate-800/80 text-slate-200'
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

export default function AlarmsPage() {
  const [data, setData] = useState<AlarmListData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [ackFilter, setAckFilter] = useState<'all' | 'open' | 'acked'>('all')
  const [openAlarmTotal, setOpenAlarmTotal] = useState<number | null>(null)
  const [freshTick, setFreshTick] = useState(0)
  const [modalAlarmId, setModalAlarmId] = useState<string | null>(null)

  const pageSize = ALARMS_LIST_PAGE_SIZE

  useEffect(() => {
    const id = window.setInterval(() => setFreshTick((n) => n + 1), 15000)
    return () => window.clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
      })
      const q = query.trim()
      if (q) params.set('keyword', q)
      if (severityFilter) params.set('severity', severityFilter)
      if (ackFilter === 'open') params.set('acknowledged', 'false')
      if (ackFilter === 'acked') params.set('acknowledged', 'true')

      const [listRes, countPayload] = await Promise.all([
        apiGet<AlarmListData>(`/api/v1/alarms?${params}`),
        apiGet<unknown>('/api/v1/alarms/counts/open'),
      ])
      setData(listRes)
      setOpenAlarmTotal(readOpenAlarmCount(countPayload))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load')
      setData(null)
      setOpenAlarmTotal(null)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, query, severityFilter, ackFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!data?.pageInfo) return
    const { totalPages: tp, totalElements } = data.pageInfo
    if (totalElements === 0 && page !== 1) {
      setPage(1)
      return
    }
    if (tp > 0 && page > tp) setPage(tp)
  }, [data, page])

  const totalFiltered = data?.pageInfo.totalElements ?? 0
  const totalPages = useMemo(() => {
    const tp = data?.pageInfo.totalPages ?? 0
    return totalFiltered === 0 ? 1 : Math.max(1, tp)
  }, [data?.pageInfo.totalPages, totalFiltered])

  const pagedRows = data?.items ?? []
  const currentPage = Math.min(page, totalPages)
  const startIndex = data ? Math.max(0, (data.pageInfo.page - 1) * data.pageInfo.size) : 0

  const reload = () => void load()

  void freshTick

  return (
    <div className="space-y-4 text-slate-200">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-50">Alarms</h1>
            <span
              className={`inline-flex min-w-[88px] items-center justify-center border px-2 py-1 text-xs leading-none ${ackBadgeTone(false)}`}
            >
              {openAlarmTotal != null ? `${openAlarmTotal} Unacked` : '— Unacked'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            알람 {totalFiltered}건 중 {pagedRows.length}건 표시 · 페이지 {currentPage} / {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[260px] items-center gap-2 border border-[#24303a] bg-[#131b23] px-3 py-2 text-sm text-slate-400">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="장비명, 메시지, Severity, 알람 UUID"
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-slate-500"
            />
          </label>
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value)
              setPage(1)
            }}
            className="border border-[#24303a] bg-[#131b23] px-3 py-2 text-sm text-slate-300 outline-none"
            aria-label="Severity filter"
          >
            <option value="">전체 Severity</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
          <select
            value={ackFilter}
            onChange={(e) => {
              setAckFilter(e.target.value as 'all' | 'open' | 'acked')
              setPage(1)
            }}
            className="border border-[#24303a] bg-[#131b23] px-3 py-2 text-sm text-slate-300 outline-none"
            aria-label="Ack filter"
          >
            <option value="all">전체 Ack</option>
            <option value="open">미인지만</option>
            <option value="acked">인지됨</option>
          </select>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-[#315463] bg-[#16252f] px-3 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center gap-2 border border-[#24303a] bg-[#131b23] text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : error ? (
        <div className="border border-[#3a2629] bg-[#1b1416] p-8 text-center text-rose-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="overflow-hidden border border-[#24303a] bg-[#131b23]">
          {pagedRows.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
              <AlertTriangle className="h-6 w-6 text-slate-500" aria-hidden />
              {query.trim() || severityFilter || ackFilter !== 'all' ? (
                <>
                  <p className="mt-3 text-sm text-slate-300">조건에 맞는 알람이 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-500">검색어·필터를 바꿔 다시 확인해보세요.</p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm text-slate-300">등록된 알람 이력이 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-500">설비에서 조건을 충족하면 알람이 표시됩니다.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#18212a] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-[#24303a] px-4 py-3">Severity</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Device</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Tag</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Occurred at</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Freshness</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Ack</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((a) => (
                    <tr key={a.alarmId} className="border-b border-[#24303a] hover:bg-[#17212a]">
                      <td className="px-4 py-3 align-middle">
                        <InlineBadge text={a.severity} tone={alarmTone(a.severity)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">{a.deviceName}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">ID {shortId(a.alarmId)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{a.tagName ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatWhen(a.occurredAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {freshnessFromOccurred(a.occurredAt)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span
                          className={`inline-flex min-w-[88px] items-center justify-center border px-2 py-1 text-xs leading-none ${ackBadgeTone(a.acknowledged)}`}
                        >
                          {a.acknowledged ? 'ACK' : 'UNACK'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setModalAlarmId(a.alarmId)}
                          className="inline-flex items-center border border-[#315463] bg-[#16252f] px-3 py-1.5 text-xs text-[#b8d2da] hover:bg-[#1b2c37]"
                        >
                          View detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#24303a] px-4 py-3 text-sm text-slate-400">
            <span>
              {pagedRows.length ? `${startIndex + 1}-${startIndex + pagedRows.length}` : '0'} / {totalFiltered}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="border border-[#315463] bg-[#16252f] px-3 py-1.5 text-xs text-[#b8d2da] hover:bg-[#1b2c37] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="min-w-[72px] text-center text-slate-300">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="border border-[#315463] bg-[#16252f] px-3 py-1.5 text-xs text-[#b8d2da] hover:bg-[#1b2c37] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <AlarmDetailModal
        alarmId={modalAlarmId}
        open={modalAlarmId != null}
        onClose={() => setModalAlarmId(null)}
        onAcked={() => void load()}
      />
    </div>
  )
}
