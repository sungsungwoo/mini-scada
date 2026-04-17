import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { ApiError, apiGet } from '../../lib/api'

type ChangeLogEntry = {
  id: string
  when: string
  actor: string
  action: string
  summary: string
}

type HistoryPayload = {
  entries: ChangeLogEntry[]
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

function actionTone(action: string): string {
  const v = action.toUpperCase()
  if (v === 'UPDATE') return 'border-sky-500/45 bg-sky-950/20 text-sky-100'
  if (v === 'DISABLE' || v === 'ENABLE') return 'border-amber-500/45 bg-amber-950/20 text-amber-100'
  if (v === 'CREATE') return 'border-emerald-500/45 bg-emerald-950/20 text-emerald-100'
  if (v === 'DELETE') return 'border-rose-500/45 bg-rose-950/20 text-rose-100'
  return 'border-slate-600 bg-slate-800/80 text-slate-200'
}

function Badge({ text, tone }: { text: string; tone: string }) {
  return (
    <span className={`inline-flex min-w-[88px] items-center justify-center border px-2 py-1 text-xs leading-none ${tone}`}>
      {text}
    </span>
  )
}

export default function AdminDeviceChangeHistoryPage() {
  const { deviceId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState<string>('')
  const [rows, setRows] = useState<ChangeLogEntry[]>([])

  const load = useCallback(async () => {
    if (!deviceId) return
    setError(null)
    setLoading(true)
    try {
      const dev = await apiGet<{ name?: string }>(`/api/v1/admin/devices/${deviceId}`)
      setDeviceName(typeof dev?.name === 'string' ? dev.name : '')
      const data = await apiGet<HistoryPayload>(
        `/api/v1/admin/devices/${deviceId}/history?page=1&size=100`,
      )
      setRows(Array.isArray(data.entries) ? data.entries : [])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load history')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    void load()
  }, [load])

  if (!deviceId) {
    return (
      <div className="space-y-4 text-slate-200">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#24303a] pb-4">
          <button
            type="button"
            onClick={() => navigate('/admin/devices')}
            className="inline-flex items-center gap-1.5 border border-[#24303a] bg-[#151d25] px-2.5 py-1.5 text-sm text-slate-300 hover:bg-[#1a232d]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back
          </button>
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
            <Link to="/admin/devices" className="hover:text-slate-300">
              Admin
            </Link>
            <span className="text-slate-600">{'>'}</span>
            <span className="text-slate-300">Devices</span>
          </nav>
        </div>
        <p className="text-sm text-slate-500">Invalid device.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#24303a] pb-4">
        <button
          type="button"
          onClick={() => navigate('/admin/devices')}
          className="inline-flex items-center gap-1.5 border border-[#24303a] bg-[#151d25] px-2.5 py-1.5 text-sm text-slate-300 hover:bg-[#1a232d]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back
        </button>
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
          <Link to="/admin/devices" className="hover:text-slate-300">
            Admin
          </Link>
          <span className="text-slate-600">{'>'}</span>
          <Link to="/admin/devices" className="hover:text-slate-300">
            Devices
          </Link>
          <span className="text-slate-600">{'>'}</span>
          <span className="text-slate-300">Change History</span>
        </nav>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Change History</h1>
        <p className="mt-1 text-sm text-slate-400">
          {deviceName ? `${deviceName} · ` : null}
          <span className="font-mono text-slate-500">{deviceId}</span>
        </p>
      </div>

      {error ? (
        <div className="border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      <div className="overflow-hidden border border-[#24303a] bg-[#131b23]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24303a] px-4 py-3">
          <div>
            <div className="text-base font-semibold text-slate-100">Entries</div>
            <div className="mt-1 text-sm text-slate-500">설비 설정 생성·수정·활성/비활성·삭제 이력</div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex items-center gap-2 border border-[#315463] bg-[#16252f] px-3 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reload
          </button>
        </div>

        <div className="overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-[#18212a] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-[#24303a] px-4 py-3">When</th>
                  <th className="border-b border-[#24303a] px-4 py-3">Actor</th>
                  <th className="border-b border-[#24303a] px-4 py-3">Action</th>
                  <th className="border-b border-[#24303a] px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#24303a] hover:bg-[#17212a]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatWhen(row.when)}</td>
                    <td className="px-4 py-3 font-medium text-slate-100">{row.actor}</td>
                    <td className="px-4 py-3">
                      <Badge text={row.action} tone={actionTone(row.action)} />
                    </td>
                    <td className="max-w-[480px] break-words px-4 py-3 text-slate-400">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">변경 이력이 없습니다.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
