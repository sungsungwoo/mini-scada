import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  Cpu,
  Eye,
  Loader2,
  ServerCrash,
  WifiOff,
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { ApiError } from '../lib/api'
import {
  Panel,
  MiniSummaryCard,
  InlineBadge,
  statusTone,
  alarmTone,
  qualityTone,
  pollingTone,
  StatusPill,
} from '../components/scada/ScadaUi'
import { DASHBOARD_REFRESH_INTERVAL_SEC } from '../config/app'

type PrimaryTag = { tagName: string; value: number | null; unit: string | null }

type DashboardOverview = {
  summary: {
    deviceCount: number
    onlineCount: number
    offlineCount: number
    warningCount: number
    criticalCount: number
    openAlarmCount: number
  }
  devices: Array<{
    deviceId: string
    groupName: string | null
    name: string
    status: string
    alarmState: string
    worstQuality: string
    lastSeen: string | null
    primaryTags: PrimaryTag[]
  }>
  activeAlarms: Array<{
    alarmId: string
    deviceId: string
    deviceName: string
    tagId: string | null
    tagName: string | null
    severity: string
    occurredAt: string
    acknowledged: boolean
    measuredValue: number | null
  }>
}

type PollingLogsData = {
  items: Array<{
    deviceId: string
    deviceName: string
    result: string
    latencyMs: number | null
    finishedAt: string
  }>
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

function formatTagLines(tags: PrimaryTag[]): string {
  return tags
    .map((t) => {
      const v = t.value != null ? String(t.value) : '—'
      const u = t.unit ? ` ${t.unit}` : ''
      return `${t.tagName}: ${v}${u}`
    })
    .join(' · ')
}

export default function MiniScadaDashboardScreen() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [polling, setPolling] = useState<PollingLogsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ackBusy, setAckBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const [ov, pl] = await Promise.all([
        apiGet<DashboardOverview>('/api/v1/dashboard/overview?includeActiveAlarms=true'),
        apiGet<PollingLogsData>('/api/v1/dashboard/polling-logs?limit=30'),
      ])
      setOverview(ov)
      setPolling(pl)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Failed to load dashboard'
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const ms = DASHBOARD_REFRESH_INTERVAL_SEC * 1000
    const id = window.setInterval(() => {
      void refresh()
    }, ms)
    return () => window.clearInterval(id)
  }, [refresh])

  const onAck = async (alarmId: string) => {
    setAckBusy(alarmId)
    try {
      await apiPost(`/api/v1/alarms/${alarmId}/ack`)
      await refresh()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Ack failed'
      setLoadError(msg)
    } finally {
      setAckBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading dashboard…
      </div>
    )
  }

  if (loadError && !overview) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-300">
        <ServerCrash className="h-10 w-10 text-rose-300/80" aria-hidden />
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
        >
          Retry
        </button>
      </div>
    )
  }

  const s = overview?.summary

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1.2fr_0.85fr] gap-4">
      {loadError ? (
        <div className="rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          {loadError}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="요약">
        <MiniSummaryCard label="Devices" value={String(s?.deviceCount ?? '—')} icon={Cpu} />
        <MiniSummaryCard label="Online" value={String(s?.onlineCount ?? '—')} icon={Activity} />
        <MiniSummaryCard label="Offline" value={String(s?.offlineCount ?? '—')} icon={WifiOff} />
        <MiniSummaryCard label="Warning" value={String(s?.warningCount ?? '—')} icon={AlertTriangle} />
        <MiniSummaryCard label="Critical" value={String(s?.criticalCount ?? '—')} icon={Bell} />
        <MiniSummaryCard label="Open Alarms" value={String(s?.openAlarmCount ?? '—')} icon={Bell} />
      </section>

      <section className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[1.62fr_0.7fr]">
        <Panel
          title="Device Snapshot"
          subtitle="설비 최신 상태와 대표 측정값 (device_groups · device_tag_latest)"
          rightSlot={
            <button
              type="button"
              onClick={() => void refresh()}
              className="border border-[#315463] bg-[#16252f] px-3 py-2 text-xs font-medium text-[#b8d2da] transition hover:bg-[#1b2c37]"
            >
              Refresh
            </button>
          }
        >
          <DeviceSnapshotTable rows={overview?.devices ?? []} />
        </Panel>

        <Panel
          title="Open Alarms"
          subtitle="미인지 활성 알람 — Quick Ack"
          rightSlot={
            <StatusPill
              text={`${s?.openAlarmCount ?? 0} OPEN`}
              tone={(s?.openAlarmCount ?? 0) > 0 ? 'critical' : 'normal'}
            />
          }
        >
          <div className="h-full overflow-y-auto pr-1">
            <div className="grid gap-2">
              {(overview?.activeAlarms ?? []).map((alarm) => (
                <AlarmCard
                  key={alarm.alarmId}
                  alarm={alarm}
                  onAck={() => void onAck(alarm.alarmId)}
                  ackBusy={ackBusy === alarm.alarmId}
                />
              ))}
              {(overview?.activeAlarms ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">활성 알람이 없습니다.</p>
              ) : null}
            </div>
          </div>
        </Panel>
      </section>

      <section className="min-h-0">
        <Panel
          title="Polling Status"
          subtitle="최신 수집 결과가 상단에 표시됩니다 (polling_logs)"
          className="h-full min-h-0"
        >
          <PollingTable rows={polling?.items ?? []} />
        </Panel>
      </section>
    </div>
  )
}

function DeviceSnapshotTable({
  rows,
}: {
  rows: DashboardOverview['devices']
}) {
  return (
    <div className="h-full overflow-auto border border-[#24303a]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#18212a] text-xs uppercase tracking-[0.16em] text-slate-500">
          <tr>
            <th scope="col" className="border-b border-[#24303a] px-3 py-3">
              Group / Device
            </th>
            <th scope="col" className="border-b border-[#24303a] px-3 py-3">
              Latest Tags
            </th>
            <th scope="col" className="border-b border-[#24303a] px-3 py-3">
              Status
            </th>
            <th scope="col" className="border-b border-[#24303a] px-3 py-3">
              Alarm
            </th>
            <th scope="col" className="border-b border-[#24303a] px-3 py-3">
              Quality
            </th>
            <th scope="col" className="border-b border-[#24303a] px-3 py-3">
              Last Seen
            </th>
            <th scope="col" className="border-b border-[#24303a] px-3 py-3">
              View
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.deviceId} className="border-b border-[#24303a]">
              <td className="min-w-0 px-3 py-3 align-top">
                <div className="break-words leading-5 text-slate-100">{row.name}</div>
                <div className="mt-1 break-words text-xs leading-5 text-slate-500">
                  {row.groupName ?? '—'}
                </div>
              </td>
              <td className="min-w-0 px-3 py-3 align-top text-slate-200">
                <span className="break-words">{formatTagLines(row.primaryTags)}</span>
              </td>
              <td className="px-3 py-3 align-top">
                <InlineBadge text={row.status} tone={statusTone(row.status)} />
              </td>
              <td className="px-3 py-3 align-top">
                <InlineBadge text={row.alarmState} tone={alarmTone(row.alarmState)} />
              </td>
              <td className="px-3 py-3 align-top">
                <InlineBadge text={row.worstQuality} tone={qualityTone(row.worstQuality)} />
              </td>
              <td className="whitespace-nowrap px-3 py-3 align-top text-slate-300">
                {formatTime(row.lastSeen)}
              </td>
              <td className="px-3 py-3 align-top">
                <Link
                  to={`/devices/${row.deviceId}`}
                  className="inline-flex h-8 w-8 items-center justify-center border border-[#315463] bg-[#16252f] text-[#b8d2da] transition hover:bg-[#1b2c37]"
                  title="설비 상세"
                >
                  <Eye className="h-4 w-4" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-slate-500">등록된 설비가 없습니다.</p>
      ) : null}
    </div>
  )
}

function AlarmCard({
  alarm,
  onAck,
  ackBusy,
}: {
  alarm: DashboardOverview['activeAlarms'][number]
  onAck: () => void
  ackBusy: boolean
}) {
  return (
    <div className="border border-[#24303a] bg-[#161f28] px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <InlineBadge text={alarm.severity} tone={alarmTone(alarm.severity)} compact />
            <span className="text-xs text-slate-500">{formatTime(alarm.occurredAt)}</span>
          </div>
          <div className="mt-2 truncate text-sm font-medium text-slate-100">{alarm.deviceName}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{alarm.tagName ?? '—'}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onAck}
            disabled={ackBusy || alarm.acknowledged}
            className="flex h-8 items-center gap-1 border border-[#315e60] bg-[#183034] px-2 text-[11px] font-semibold uppercase tracking-wide text-[#b9d8cf] hover:bg-[#1f3d38] disabled:cursor-not-allowed disabled:opacity-40"
            title="Quick Ack"
          >
            {ackBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Ack
          </button>
        </div>
      </div>
    </div>
  )
}

function PollingTable({
  rows,
}: {
  rows: PollingLogsData['items']
}) {
  return (
    <div className="h-full overflow-y-auto border border-[#24303a]">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[#18212a] text-xs uppercase tracking-[0.16em] text-slate-500">
          <tr>
            <th scope="col" className="border-b border-[#24303a] px-4 py-3 text-left">
              Device
            </th>
            <th scope="col" className="border-b border-[#24303a] px-4 py-3 text-left">
              Result
            </th>
            <th scope="col" className="border-b border-[#24303a] px-4 py-3 text-left">
              Latency
            </th>
            <th scope="col" className="border-b border-[#24303a] px-4 py-3 text-left">
              Finished
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.deviceId}-${row.finishedAt}`} className="border-b border-[#24303a]">
              <td className="px-4 py-3 text-slate-200">{row.deviceName}</td>
              <td className="px-4 py-3">
                <InlineBadge text={row.result} tone={pollingTone(row.result)} fixed />
              </td>
              <td className="px-4 py-3 text-slate-300">
                {row.latencyMs != null ? `${row.latencyMs} ms` : '—'}
              </td>
              <td className="px-4 py-3 text-slate-300">{formatTime(row.finishedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          아직 폴링 로그가 없습니다. Modbus 설비가 폴링되면 기록됩니다.
        </p>
      ) : null}
    </div>
  )
}
