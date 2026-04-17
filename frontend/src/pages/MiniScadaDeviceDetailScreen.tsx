import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Clock,
  Cpu,
  Loader2,
  ServerCrash,
  Settings,
} from 'lucide-react'
import { apiGet, getStoredToken } from '../lib/api'
import { ApiError } from '../lib/api'
import { useScadaMqtt, type ScadaLiveState } from '../hooks/useScadaMqtt'
import { useAuth } from '../auth/AuthContext'
import {
  MiniSummaryCard,
  InlineBadge,
  statusTone,
  alarmTone,
  qualityTone,
} from '../components/scada/ScadaUi'

type CurrentTagValue = {
  tagId: string
  name: string
  /** MQTT 토픽 `/scada/{deviceId}/{code}` 와 매칭 */
  code?: string
  value: number | string | null
  unit: string | null
  alarmState: string
  quality: string | null
}

type DeviceDetail = {
  deviceId: string
  name: string
  code: string
  protocolType: string
  groupName: string | null
  ip: string | null
  port: number | null
  slaveId: number | null
  pollingIntervalSec: number
  timeoutMs: number
  status: string
  lastSeen: string | null
  stale: boolean
  tags: CurrentTagValue[]
}

type TimeseriesSeries = {
  tagId: string
  tagName: string
  unit: string | null
  points: Array<{ timestamp: string; value: number | string | null }>
}
type TimeseriesData = { series: TimeseriesSeries[] }

type DeviceEvent = {
  eventId: string
  type: string
  occurredAt: string
  severity: string
  message: string
}

type AlarmRow = {
  alarmId: string
  tagName: string | null
  severity: string
  occurredAt: string
  measuredValue: number | string | null
}
type AlarmListData = { items: AlarmRow[] }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CHART_TAG_LIMIT = 6
const EVENTS_LIMIT = 40
const ALARMS_PAGE_SIZE = 50

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

function formatClock(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(d)
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function formatValue(v: number | string | null | undefined): string {
  const n = num(v)
  if (n != null) {
    const abs = Math.abs(n)
    const frac = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
    return n.toLocaleString('ko-KR', { maximumFractionDigits: frac })
  }
  return '—'
}

function worstAlarmState(tags: CurrentTagValue[]): string {
  let score = 0
  for (const t of tags) {
    if (t.alarmState === 'CRITICAL') score = Math.max(score, 2)
    else if (t.alarmState === 'WARNING') score = Math.max(score, 1)
  }
  if (score >= 2) return 'CRITICAL'
  if (score === 1) return 'WARNING'
  return 'NORMAL'
}

function worstQuality(tags: CurrentTagValue[]): string {
  const rank = (q: string | null): number => {
    if (!q) return 2
    switch (q) {
      case 'TIMEOUT':
        return 4
      case 'BAD':
        return 3
      case 'UNCERTAIN':
        return 2
      case 'GOOD':
        return 1
      default:
        return 2
    }
  }
  let worst = 0
  for (const t of tags) worst = Math.max(worst, rank(t.quality))
  if (worst >= 4) return 'TIMEOUT'
  if (worst === 3) return 'BAD'
  if (worst === 2) return 'UNCERTAIN'
  return 'GOOD'
}

function addr(ip: string | null, port: number | null): string {
  if (ip && port != null) return `${ip}:${port}`
  if (ip) return ip
  if (port != null) return `:${port}`
  return '—'
}

/** lastSeen 기준 상대 경과 (미리보기의 Freshness 카드용) */
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
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

function abnormalTagsLabel(tags: CurrentTagValue[]): string {
  const abnormal = tags.filter((t) => ['WARNING', 'CRITICAL'].includes(t.alarmState)).length
  return `${abnormal} / ${tags.length}`
}

type ModalType = 'alarms' | 'events' | null

function mergeDeviceWithLive(detail: DeviceDetail, live: ScadaLiveState, deviceId: string): DeviceDetail {
  const patch = live.byDevice[deviceId]
  if (!patch) return detail
  let status = detail.status
  let lastSeen = detail.lastSeen
  let stale = detail.stale
  if (patch.status?.status && patch.status.lastSeen) {
    status = patch.status.status
    lastSeen = patch.status.lastSeen
    stale = false
  }
  const tags = detail.tags.map((t) => {
    const code = t.code
    if (!code) return t
    const m = patch.tags[code]
    if (!m) return t
    const raw = m.value
    let value: number | string | null = t.value
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'number') value = raw
      else if (typeof raw === 'string') value = raw
      else if (typeof raw === 'boolean') value = raw ? 1 : 0
    }
    return {
      ...t,
      value,
      unit: m.unit ?? t.unit,
      alarmState: m.alarmState,
      quality: m.quality,
    }
  })
  return { ...detail, status, lastSeen, stale, tags }
}

export default function MiniScadaDeviceDetailScreen() {
  const { deviceId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [detail, setDetail] = useState<DeviceDetail | null>(null)
  const [series, setSeries] = useState<TimeseriesSeries[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tsLoading, setTsLoading] = useState(false)
  const [modal, setModal] = useState<ModalType>(null)
  const [eventsData, setEventsData] = useState<DeviceEvent[] | null>(null)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [openAlarms, setOpenAlarms] = useState<AlarmRow[] | null>(null)
  const [alarmsLoading, setAlarmsLoading] = useState(false)
  const [freshTick, setFreshTick] = useState(0)

  const validId = deviceId && UUID_RE.test(deviceId)

  const mqttWs = import.meta.env.VITE_MQTT_WS_URL as string | undefined
  const { live, connected, error: mqttError } = useScadaMqtt({
    wsUrl: mqttWs,
    enabled: Boolean(validId && deviceId && getStoredToken()),
  })

  const display = useMemo(() => {
    if (!detail) return null
    return mergeDeviceWithLive(detail, live, detail.deviceId)
  }, [detail, live])

  useEffect(() => {
    const id = window.setInterval(() => setFreshTick((n) => n + 1), 15000)
    return () => window.clearInterval(id)
  }, [])

  /** MQTT로 들어온 값을 트렌드 시리즈 끝에 붙여 차트가 따라가게 함 */
  useEffect(() => {
    if (!detail?.deviceId || !deviceId) return
    const patch = live.byDevice[deviceId]
    if (!patch?.tags) return
    setSeries((prev) => {
      if (prev.length === 0) return prev
      return prev.map((s) => {
        const tagMeta = detail.tags.find((t) => t.tagId === s.tagId)
        const code = tagMeta?.code
        if (!code) return s
        const cell = patch.tags[code]
        if (!cell) return s
        const raw = cell.value
        const n = typeof raw === 'number' ? raw : Number(raw)
        if (!Number.isFinite(n)) return s
        const pt = { timestamp: new Date().toISOString(), value: n }
        return { ...s, points: [...(s.points ?? []), pt].slice(-150) }
      })
    })
  }, [live, detail, deviceId])

  const loadDetail = useCallback(async () => {
    if (!validId || !deviceId) return
    setLoadError(null)
    setLoading(true)
    try {
      setDetail(await apiGet<DeviceDetail>(`/api/v1/devices/${deviceId}`))
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Failed to load device')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [deviceId, validId])

  const loadTimeseries = useCallback(async () => {
    if (!validId || !deviceId || !detail?.tags.length) return
    const tagIds = detail.tags
      .slice(0, CHART_TAG_LIMIT)
      .map((t) => t.tagId)
      .join(',')
    const to = new Date()
    const from = new Date(to.getTime() - 60 * 60 * 1000)
    setTsLoading(true)
    try {
      const q = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        tagIds,
      })
      const data = await apiGet<TimeseriesData>(`/api/v1/devices/${deviceId}/timeseries?${q}`)
      setSeries(data.series ?? [])
    } catch {
      setSeries([])
    } finally {
      setTsLoading(false)
    }
  }, [deviceId, detail?.tags, validId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (detail?.tags.length) void loadTimeseries()
  }, [detail?.deviceId, detail?.tags.length, loadTimeseries])

  const loadEventsModal = useCallback(async () => {
    if (!validId || !deviceId) return
    setEventsLoading(true)
    try {
      const data = await apiGet<{ items: DeviceEvent[] }>(
        `/api/v1/devices/${deviceId}/events?limit=${EVENTS_LIMIT}`,
      )
      setEventsData(data.items ?? [])
    } catch {
      setEventsData([])
    } finally {
      setEventsLoading(false)
    }
  }, [deviceId, validId])

  const loadOpenAlarmsModal = useCallback(async () => {
    if (!validId || !deviceId) return
    setAlarmsLoading(true)
    try {
      const data = await apiGet<AlarmListData>(
        `/api/v1/alarms?deviceId=${deviceId}&acknowledged=false&page=1&size=${ALARMS_PAGE_SIZE}`,
      )
      setOpenAlarms(data.items ?? [])
    } catch {
      setOpenAlarms([])
    } finally {
      setAlarmsLoading(false)
    }
  }, [deviceId, validId])

  useEffect(() => {
    if (modal === 'events') void loadEventsModal()
  }, [modal, loadEventsModal])

  useEffect(() => {
    if (modal === 'alarms') void loadOpenAlarmsModal()
  }, [modal, loadOpenAlarmsModal])

  const worstAlarm = useMemo(
    () => (display ? worstAlarmState(display.tags) : 'NORMAL'),
    [display],
  )
  const worstQ = useMemo(() => (display ? worstQuality(display.tags) : 'GOOD'), [display])
  const primaryTag = display?.tags[0]?.name ?? '—'
  const freshnessLabel = useMemo(() => {
    if (!display) return '—'
    void freshTick
    return freshnessFromLastSeen(display.lastSeen)
  }, [display, display?.lastSeen, freshTick])
  const abnormalTags = useMemo(
    () => (display ? abnormalTagsLabel(display.tags) : '—'),
    [display],
  )

  if (!validId) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center text-slate-300">
        <ServerCrash className="h-10 w-10 text-rose-300/80" aria-hidden />
        <p>Invalid device id.</p>
        <Link to="/devices" className="text-[#9fd0c4] underline">
          Back to list
        </Link>
      </div>
    )
  }

  if (loading && !detail) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading…
      </div>
    )
  }

  if (loadError && !detail) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center text-slate-300">
        <ServerCrash className="h-10 w-10 text-rose-300/80" aria-hidden />
        <p>{loadError}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadDetail()}
            className="border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
          >
            Retry
          </button>
          <Link
            to="/devices"
            className="border border-[#24303a] px-4 py-2 text-sm text-slate-300 hover:bg-[#1a232d]"
          >
            List
          </Link>
        </div>
      </div>
    )
  }

  if (!detail || !display) return null

  return (
    <>
      <div className="space-y-5">
        {loadError ? (
          <div className="rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            {loadError}
          </div>
        ) : null}
        {mqttWs && (mqttError || !connected) ? (
          <div className="rounded border border-slate-600/50 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
            MQTT:{' '}
            {mqttError
              ? `disconnected (${mqttError})`
              : 'connecting… — check broker and VITE_MQTT_WS_URL (e.g. ws://localhost:9001)'}
          </div>
        ) : mqttWs && connected ? (
          <div className="rounded border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200/90">
            MQTT live — tag values and trends update from the broker.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-b border-[#24303a] pb-4">
          <button
            type="button"
            onClick={() => navigate('/devices')}
            className="inline-flex items-center gap-1.5 border border-[#24303a] bg-[#151d25] px-2.5 py-1.5 text-sm text-slate-300 hover:bg-[#1a232d]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back
          </button>
          <nav className="flex items-center gap-1 text-sm text-slate-500">
            <Link to="/devices" className="hover:text-slate-300">
              Devices
            </Link>
            <span className="text-slate-600 opacity-80" aria-hidden>
              {'>'}
            </span>
            <span className="max-w-[200px] truncate text-slate-300">{display.name}</span>
          </nav>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => void loadDetail()}
            className="border border-[#315463] bg-[#16252f] px-3 py-1.5 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setModal('alarms')}
            className="border border-[#315463] bg-[#16252f] px-3 py-1.5 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
          >
            Open alarms
          </button>
          <button
            type="button"
            onClick={() => setModal('events')}
            className="border border-[#315463] bg-[#16252f] px-3 py-1.5 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
          >
            Alarm history
          </button>
          {isAdmin ? (
            <Link
              to={`/admin/devices/${display.deviceId}/edit`}
              className="inline-flex items-center gap-1.5 border border-[#315463] bg-[#16252f] px-3 py-1.5 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Edit
            </Link>
          ) : null}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-50">{display.name}</h1>
            <InlineBadge text={display.status} tone={statusTone(display.status)} fixed />
            {display.stale ? (
              <span className="rounded border border-amber-500/35 bg-amber-950/35 px-2 py-0.5 text-xs text-amber-100">
                STALE
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>Code: {display.code}</span>
            <span>·</span>
            <span>Last seen: {formatWhen(display.lastSeen)}</span>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MiniSummaryCard label="Alarm" value={worstAlarm} icon={Bell} />
          <MiniSummaryCard label="Quality" value={worstQ} icon={Activity} />
          <MiniSummaryCard label="Freshness" value={freshnessLabel} icon={Clock} />
          <MiniSummaryCard label="Abnormal tags" value={abnormalTags} icon={AlertTriangle} />
          <MiniSummaryCard label="Polling" value={`${display.pollingIntervalSec}s`} icon={Cpu} />
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_minmax(240px,280px)]">
          <section className="border border-[#24303a] bg-[#131b23] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
            <h2 className="text-lg font-semibold text-slate-50">Live tags</h2>
            <p className="mt-1 text-sm text-slate-400">Latest values from the server</p>
            <div className="mt-4 overflow-x-auto border border-[#24303a]">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead className="bg-[#18212a] text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="border-b border-[#24303a] px-3 py-2.5">Tag</th>
                    <th className="border-b border-[#24303a] px-3 py-2.5">Value</th>
                    <th className="border-b border-[#24303a] px-3 py-2.5">Unit</th>
                    <th className="border-b border-[#24303a] px-3 py-2.5">Quality</th>
                    <th className="border-b border-[#24303a] px-3 py-2.5">Alarm</th>
                  </tr>
                </thead>
                <tbody>
                  {display.tags.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                        No tags configured.
                      </td>
                    </tr>
                  ) : (
                    display.tags.map((row) => (
                      <tr
                        key={row.tagId}
                        className={`border-b border-[#24303a] last:border-b-0 ${display.stale ? 'opacity-[0.9]' : ''}`}
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-100">{row.name}</td>
                        <td className="px-3 py-2.5 text-slate-200">{formatValue(row.value)}</td>
                        <td className="px-3 py-2.5 text-slate-500">{row.unit ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <InlineBadge
                            text={row.quality ?? '—'}
                            tone={qualityTone(row.quality ?? 'UNKNOWN')}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <InlineBadge text={row.alarmState} tone={alarmTone(row.alarmState)} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="border border-[#24303a] bg-[#131b23] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
            <h2 className="text-lg font-semibold text-slate-50">Connection</h2>
            <p className="mt-1 text-sm text-slate-400">Modbus / polling</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Group</dt>
                <dd className="mt-0.5 text-slate-200">{display.groupName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Protocol</dt>
                <dd className="mt-0.5 text-slate-200">{display.protocolType}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Address</dt>
                <dd className="mt-0.5 break-all text-slate-200">{addr(display.ip, display.port)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Slave</dt>
                <dd className="mt-0.5 text-slate-200">{display.slaveId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Timeout</dt>
                <dd className="mt-0.5 text-slate-200">{display.timeoutMs} ms</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Primary tag</dt>
                <dd className="mt-0.5 text-slate-200">{primaryTag}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Device ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-slate-400">{display.deviceId}</dd>
              </div>
            </dl>
          </aside>
        </div>

        <section className="border border-[#24303a] bg-[#131b23] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Trends (1 hour)</h2>
              <p className="mt-1 text-sm text-slate-400">Up to {CHART_TAG_LIMIT} tags · auto scale</p>
            </div>
            {tsLoading ? (
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Loading…
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void loadTimeseries()}
                className="border border-[#315463] bg-[#16252f] px-3 py-1.5 text-xs text-[#b8d2da] hover:bg-[#1b2c37]"
              >
                Reload charts
              </button>
            )}
          </div>
          <TrendCharts series={series} />
        </section>
      </div>

      <Modal open={modal === 'alarms'} title="Open alarms" onClose={() => setModal(null)}>
        {alarmsLoading ? (
          <div className="flex justify-center py-12 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : (
          <ul className="max-h-[65vh] space-y-2 overflow-y-auto">
            {(openAlarms ?? []).length === 0 ? (
              <li className="text-sm text-slate-500">No open alarms.</li>
            ) : (
              (openAlarms ?? []).map((a) => (
                <li key={a.alarmId} className="border border-[#24303a] bg-[#161f28] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <InlineBadge text={a.severity} tone={alarmTone(a.severity)} compact />
                    <time className="text-xs text-slate-500" dateTime={a.occurredAt}>
                      {formatClock(a.occurredAt)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-100">{a.tagName ?? '—'}</p>
                  <p className="mt-1 text-xs text-slate-500">Value {formatValue(a.measuredValue)}</p>
                </li>
              ))
            )}
          </ul>
        )}
      </Modal>

      <Modal open={modal === 'events'} title="Alarm history (this device)" onClose={() => setModal(null)}>
        {eventsLoading ? (
          <div className="flex justify-center py-12 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-auto border border-[#24303a]">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-[#18212a] text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="border-b border-[#24303a] px-3 py-2 text-left">Time</th>
                  <th className="border-b border-[#24303a] px-3 py-2 text-left">Type</th>
                  <th className="border-b border-[#24303a] px-3 py-2 text-left">Severity</th>
                  <th className="border-b border-[#24303a] px-3 py-2 text-left">Message</th>
                </tr>
              </thead>
              <tbody>
                {(eventsData ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                      No records.
                    </td>
                  </tr>
                ) : (
                  (eventsData ?? []).map((row) => (
                    <tr key={row.eventId} className="border-b border-[#24303a]">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                        {formatClock(row.occurredAt)}
                      </td>
                      <td className="px-3 py-2 text-slate-200">{row.type}</td>
                      <td className="px-3 py-2">
                        <InlineBadge text={row.severity} tone={alarmTone(row.severity)} compact />
                      </td>
                      <td className="px-3 py-2 text-slate-400">{row.message}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  )
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-modal-title"
        className="w-full max-w-lg overflow-hidden border border-[#24303a] bg-[#11181f] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#24303a] px-4 py-3">
          <h2 id="device-modal-title" className="text-base font-semibold text-slate-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function TrendCharts({ series }: { series: TimeseriesSeries[] }) {
  if (!series.length) {
    return (
      <p className="mt-6 py-8 text-center text-sm text-slate-500">
        No series data in this window.
      </p>
    )
  }
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      {series.map((s) => (
        <Spark key={s.tagId} series={s} />
      ))}
    </div>
  )
}

function Spark({ series }: { series: TimeseriesSeries }) {
  const w = 360
  const h = 120
  const { path, stroke, dots } = useMemo(() => {
    const pts = series.points ?? []
    const vals = pts.map((p) => num(p.value)).filter((v): v is number => v != null)
    if (vals.length === 0) {
      return { path: '', stroke: '#64748b', dots: [] as { cx: number; cy: number }[] }
    }
    const minV = Math.min(...vals)
    const maxV = Math.max(...vals)
    const pad = maxV === minV ? Math.abs(minV) * 0.05 || 1 : (maxV - minV) * 0.08
    const y0 = minV - pad
    const span = maxV - minV + 2 * pad || 1
    const last = pts.length - 1
    const segs: string[] = []
    let first = true
    for (let i = 0; i < pts.length; i++) {
      const v = num(pts[i].value)
      if (v == null) continue
      const x = last <= 0 ? w / 2 : (i / last) * (w - 24) + 12
      const y = h - 12 - ((v - y0) / span) * (h - 24)
      segs.push(`${first ? 'M' : 'L'} ${x} ${y}`)
      first = false
    }
    const ds = pts
      .map((p, i) => {
        const v = num(p.value)
        if (v == null) return null
        const x = last <= 0 ? w / 2 : (i / last) * (w - 24) + 12
        const y = h - 12 - ((v - y0) / span) * (h - 24)
        return { cx: x, cy: y }
      })
      .filter((x): x is { cx: number; cy: number } => x != null)
    return { path: segs.join(' '), stroke: '#9fd0c4', dots: ds }
  }, [series.points])

  const lastVal = series.points.length ? series.points[series.points.length - 1]?.value : null

  return (
    <div className="rounded border border-[#24303a] bg-[#161f28] p-3">
      <div className="mb-2 flex justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-slate-100">{series.tagName}</div>
          <div className="text-xs text-slate-500">{series.unit ?? ''}</div>
        </div>
        <div className="text-right text-lg font-semibold text-slate-50">{formatValue(lastVal)}</div>
      </div>
      <div className="rounded border border-[#24303a] bg-[#141b22] p-1">
        {path ? (
          <svg viewBox={`0 0 ${w} ${h}`} className="h-[120px] w-full" preserveAspectRatio="none">
            <path d={path} fill="none" stroke={stroke} strokeWidth="1.75" />
            {dots.map((d, i) => (
              <circle key={`${series.tagId}-${i}`} cx={d.cx} cy={d.cy} r="2.2" fill={stroke} />
            ))}
          </svg>
        ) : (
          <div className="flex h-[120px] items-center justify-center text-xs text-slate-500">
            No points
          </div>
        )}
      </div>
    </div>
  )
}
