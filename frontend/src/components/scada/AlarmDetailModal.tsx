import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { apiGet, apiPost } from '../../lib/api'
import { ApiError } from '../../lib/api'
import { InlineBadge, alarmTone } from './ScadaUi'

type AlarmThresholds = {
  warningMin: number | string | null
  warningMax: number | string | null
  criticalMin: number | string | null
  criticalMax: number | string | null
  deadband: number | string | null
}

export type AlarmDetailPayload = {
  alarmId: string
  displayCode: string
  deviceId: string
  deviceName: string
  groupName: string | null
  tagId: string | null
  tagName: string | null
  severity: string
  message: string
  occurredAt: string
  clearedAt: string | null
  acknowledged: boolean
  acknowledgedByUsername: string | null
  acknowledgedAt: string | null
  measuredValue: number | string | null
  unit: string | null
  currentState: string
  thresholds: AlarmThresholds | null
}

type AlarmListItem = {
  alarmId: string
  tagName: string | null
  severity: string
}

type DeviceEvent = {
  eventId: string
  type: string
  occurredAt: string
  severity: string
  message: string
}

function formatDateTimeLong(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  })
    .format(d)
    .replace(',', '')
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

function fmtNum(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number' && Number.isFinite(v)) {
    const abs = Math.abs(v)
    const frac = abs >= 100 ? 2 : abs >= 10 ? 2 : 4
    return v.toLocaleString('ko-KR', { maximumFractionDigits: frac })
  }
  return String(v)
}

function formatDuration(occurredAt: string, clearedAt: string | null, tick: number): string {
  void tick
  const start = new Date(occurredAt).getTime()
  if (Number.isNaN(start)) return '—'
  const end = clearedAt ? new Date(clearedAt).getTime() : Date.now()
  if (Number.isNaN(end)) return '—'
  const sec = Math.max(0, Math.floor((end - start) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function ackBadgeTone(ack: boolean): string {
  return ack
    ? 'border-emerald-500/35 bg-emerald-950/35 text-emerald-100'
    : 'border-slate-600 bg-slate-800/80 text-slate-200'
}

type Props = {
  alarmId: string | null
  open: boolean
  onClose: () => void
  onAcked?: () => void
}

export default function AlarmDetailModal({ alarmId, open, onClose, onAcked }: Props) {
  const navigate = useNavigate()
  const [detail, setDetail] = useState<AlarmDetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentAlarms, setRecentAlarms] = useState<string>('')
  const [eventLine, setEventLine] = useState<string>('')
  const [ackBusy, setAckBusy] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [open])

  const loadDetail = useCallback(async () => {
    if (!alarmId) return
    setError(null)
    setLoading(true)
    try {
      const d = await apiGet<AlarmDetailPayload>(`/api/v1/alarms/${alarmId}`)
      setDetail(d)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [alarmId])

  useEffect(() => {
    if (!open || !alarmId) {
      setDetail(null)
      setRecentAlarms('')
      setEventLine('')
      return
    }
    void loadDetail()
  }, [open, alarmId, loadDetail])

  useEffect(() => {
    if (!open || !detail?.deviceId) return
    const deviceId = detail.deviceId
    const currentId = detail.alarmId
    ;(async () => {
      try {
        const [alarmsRes, evRes] = await Promise.all([
          apiGet<{ items: AlarmListItem[] }>(`/api/v1/alarms?deviceId=${deviceId}&page=1&size=12`),
          apiGet<{ items: DeviceEvent[] }>(`/api/v1/devices/${deviceId}/events?limit=6`),
        ])
        const others = (alarmsRes.items ?? [])
          .filter((a) => a.alarmId !== currentId)
          .slice(0, 5)
        setRecentAlarms(
          others.length
            ? others.map((a) => `${a.tagName ?? '—'} ${a.severity}`).join(' / ')
            : '—',
        )
        const ev = evRes.items ?? []
        setEventLine(
          ev.length ? ev.map((e) => `${e.message} (${formatClock(e.occurredAt)})`).join(' · ') : '—',
        )
      } catch {
        setRecentAlarms('—')
        setEventLine('—')
      }
    })()
  }, [open, detail?.alarmId, detail?.deviceId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleAck = async () => {
    if (!alarmId || !detail || detail.acknowledged) return
    setAckBusy(true)
    try {
      await apiPost(`/api/v1/alarms/${alarmId}/ack`)
      await loadDetail()
      onAcked?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ack failed')
    } finally {
      setAckBusy(false)
    }
  }

  const goDevice = () => {
    if (detail?.deviceId) {
      onClose()
      navigate(`/devices/${detail.deviceId}`)
    }
  }

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
        aria-labelledby="alarm-detail-title"
        className="flex max-h-[80vh] w-full max-w-[840px] flex-col overflow-hidden border border-[#24303a] bg-[#11181f] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#24303a] px-4 py-3">
          <h2 id="alarm-detail-title" className="text-base font-semibold text-slate-50">
            Alarm Detail
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-200"
            aria-label="Close"
          >
            Close ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm text-slate-300">
          {loading ? (
            <div className="flex justify-center py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            </div>
          ) : error ? (
            <p className="text-center text-rose-200">{error}</p>
          ) : detail ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-[#24303a] pb-3">
                <InlineBadge text={detail.severity} tone={alarmTone(detail.severity)} />
                <span
                  className={`inline-flex min-w-[72px] items-center justify-center border px-2 py-1 text-[11px] font-semibold tracking-wide ${ackBadgeTone(detail.acknowledged)}`}
                >
                  {detail.acknowledged ? 'ACK' : 'UNACK'}
                </span>
                <span className="text-slate-100">
                  {detail.deviceName} / {detail.tagName ?? '—'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Occurred at {formatDateTimeLong(detail.occurredAt)}
              </p>

              <section className="mt-4 border-b border-[#24303a] pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Basic Info</h3>
                <dl className="mt-2 space-y-1.5 font-mono text-xs text-slate-300">
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Alarm ID</dt>
                    <dd>{detail.displayCode}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Device</dt>
                    <dd>{detail.deviceName}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Group</dt>
                    <dd>{detail.groupName ?? '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Tag</dt>
                    <dd>{detail.tagName ?? '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Severity</dt>
                    <dd>{detail.severity}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Ack Status</dt>
                    <dd>{detail.acknowledged ? 'ACK' : 'UNACK'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Occurred At</dt>
                    <dd>{formatDateTimeLong(detail.occurredAt)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Cleared At</dt>
                    <dd>{detail.clearedAt ? formatDateTimeLong(detail.clearedAt) : '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Duration</dt>
                    <dd>{formatDuration(detail.occurredAt, detail.clearedAt, tick)}</dd>
                  </div>
                </dl>
              </section>

              <section className="mt-4 border-b border-[#24303a] pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alarm Message</h3>
                <p className="mt-2 whitespace-pre-wrap text-slate-200">{detail.message || '—'}</p>
              </section>

              <section className="mt-4 border-b border-[#24303a] pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Measured Value / Threshold
                </h3>
                <dl className="mt-2 space-y-1.5 font-mono text-xs text-slate-300">
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Current Value</dt>
                    <dd>
                      {fmtNum(detail.measuredValue)} {detail.unit ? detail.unit : ''}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Unit</dt>
                    <dd>{detail.unit ?? '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Warning High</dt>
                    <dd>{fmtNum(detail.thresholds?.warningMax)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Critical High</dt>
                    <dd>{fmtNum(detail.thresholds?.criticalMax)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Warning Low</dt>
                    <dd>{fmtNum(detail.thresholds?.warningMin)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Critical Low</dt>
                    <dd>{fmtNum(detail.thresholds?.criticalMin)}</dd>
                  </div>
                </dl>
              </section>

              <section className="mt-4 border-b border-[#24303a] pb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acknowledge Info</h3>
                <dl className="mt-2 space-y-1.5 font-mono text-xs text-slate-300">
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Acknowledged</dt>
                    <dd>{detail.acknowledged ? 'Yes' : 'No'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Ack By</dt>
                    <dd>{detail.acknowledgedByUsername ?? '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-[120px] shrink-0 text-slate-500">Ack At</dt>
                    <dd>{detail.acknowledgedAt ? formatDateTimeLong(detail.acknowledgedAt) : '—'}</dd>
                  </div>
                </dl>
              </section>

              <section className="mt-4 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Related Context</h3>
                <dl className="mt-2 space-y-2 text-xs text-slate-300">
                  <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                    <dt className="w-32 shrink-0 text-slate-500">Recent alarms</dt>
                    <dd className="min-w-0 break-words text-slate-400">{recentAlarms}</dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                    <dt className="w-32 shrink-0 text-slate-500">Event history</dt>
                    <dd className="min-w-0 break-words text-slate-400">{eventLine}</dd>
                  </div>
                </dl>
              </section>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#24303a] px-4 py-3">
          <button
            type="button"
            onClick={handleAck}
            disabled={!detail || detail.acknowledged || ackBusy}
            className="border border-[#315e60] bg-[#183034] px-4 py-2 text-sm font-medium text-[#b9d8cf] hover:bg-[#1f3d38] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ackBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Ack'}
          </button>
          <button
            type="button"
            onClick={goDevice}
            disabled={!detail?.deviceId}
            className="border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37] disabled:opacity-40"
          >
            Go to Device
          </button>
        </div>
      </div>
    </div>
  )
}
