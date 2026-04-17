import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, RefreshCw, Search } from 'lucide-react'
import { apiGet } from '../lib/api'
import { ApiError } from '../lib/api'
import { InlineBadge, alarmTone, qualityTone, statusTone } from '../components/scada/ScadaUi'
import { DEVICES_LIST_PAGE_SIZE } from '../config/app'

type DeviceRow = {
  deviceId: string
  groupName: string | null
  name: string
  status: string
  alarmState: string
  worstQuality: string
  lastSeen: string | null
}

type DeviceListData = {
  devices: DeviceRow[]
  pageInfo: { page: number; size: number; totalElements: number; totalPages: number }
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

function freshnessFromLastSeen(iso: string | null | undefined): string {
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

function shortId(id: string): string {
  return id.slice(0, 8)
}

export default function DevicesListPage() {
  const [data, setData] = useState<DeviceListData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [freshTick, setFreshTick] = useState(0)

  const pageSize = DEVICES_LIST_PAGE_SIZE

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
      const res = await apiGet<DeviceListData>(`/api/v1/dashboard/devices?${params}`)
      setData(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, query])

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

  const currentPage = Math.min(page, totalPages)
  const pagedRows = data?.devices ?? []
  const startIndex = data ? Math.max(0, (data.pageInfo.page - 1) * data.pageInfo.size) : 0

  const reload = () => void load()

  void freshTick

  return (
    <div className="space-y-4 text-slate-200">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Devices</h1>
          <p className="mt-1 text-sm text-slate-400">
            설비 {totalFiltered}대 중 {pagedRows.length}대 표시 · 페이지 {currentPage} / {totalPages}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-[280px] items-center gap-2 border border-[#24303a] bg-[#131b23] px-3 py-2 text-sm text-slate-400">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="장비명, 그룹명, ID 검색"
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-slate-500"
            />
          </label>
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
              {query.trim() ? (
                <>
                  <p className="text-sm text-slate-300">검색 조건에 맞는 설비가 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-500">검색어를 지우거나 다른 키워드로 다시 확인해보세요.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300">등록된 설비가 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    관리자 화면에서 설비를 등록한 뒤 다시 새로고침하세요.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#18212a] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-[#24303a] px-4 py-3">Name</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Group</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Status</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Alarm</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Quality</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Last seen</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Freshness</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((d) => (
                    <tr key={d.deviceId} className="border-b border-[#24303a] hover:bg-[#17212a]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">{d.name}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">ID {shortId(d.deviceId)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{d.groupName ?? '—'}</td>
                      <td className="px-4 py-3 align-middle">
                        <InlineBadge text={d.status} tone={statusTone(d.status)} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <InlineBadge text={d.alarmState} tone={alarmTone(d.alarmState)} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <InlineBadge text={d.worstQuality} tone={qualityTone(d.worstQuality)} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatWhen(d.lastSeen)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {freshnessFromLastSeen(d.lastSeen)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/devices/${d.deviceId}`}
                          className="inline-flex items-center border border-[#315463] bg-[#16252f] px-3 py-1.5 text-xs text-[#b8d2da] hover:bg-[#1b2c37]"
                        >
                          View detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#24303a] px-4 py-3 text-sm text-slate-400">
            <span>
              {pagedRows.length ? `${startIndex + 1}-${startIndex + pagedRows.length}` : '0'} /{' '}
              {totalFiltered}
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
    </div>
  )
}
