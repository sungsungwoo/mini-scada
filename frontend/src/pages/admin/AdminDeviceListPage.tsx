import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, Loader2, MoreHorizontal, Plus, RefreshCw, Search, SquarePen, Trash2, Wifi } from 'lucide-react'
import { ApiError, apiDelete, apiGet, apiPatch } from '../../lib/api'
import { InlineBadge, alarmTone, qualityTone, statusTone } from '../../components/scada/ScadaUi'
import { DEVICES_LIST_PAGE_SIZE } from '../../config/app'

type AdminDevice = {
  deviceId: string
  name: string
  code: string
  description: string | null
  groupName: string | null
  protocolType: string
  ip: string
  port: number
  slaveId: number
  pollingIntervalSec: number
  timeoutMs: number
  lastSeenAt: string | null
  isActive: boolean
  status: string
  tagCount: number
}

type AdminDeviceListData = {
  devices: AdminDevice[]
  pageInfo: { page: number; size: number; totalElements: number; totalPages: number }
}

type DashDevice = {
  deviceId: string
  groupName?: string | null
  alarmState: string
  worstQuality: string
  status: string
  lastSeen?: string | null
}

type DashboardSummary = {
  deviceCount: number
  onlineCount: number
  offlineCount: number
  warningCount: number
  criticalCount: number
  openAlarmCount: number
}

type DashboardOverview = {
  summary: DashboardSummary
  devices: DashDevice[]
}

type MergedRow = AdminDevice & {
  alarmState: string
  worstQuality: string
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

/**
 * DB `ip_address` / `port` 는 nullable.
 * API에서 port가 null이면 프론트에서 숫자 0으로 쓰기 쉬워 `:0` 처럼 보일 수 있음 → 아래에서 구분.
 */
function addressLine(d: AdminDevice): string {
  const p = d.protocolType?.toUpperCase() ?? ''
  const ip = (d.ip ?? '').trim()
  const port = d.port
  const portKnown = typeof port === 'number' && port > 0

  if (p.includes('RTU')) {
    return ip ? `${ip} (serial)` : '—'
  }
  if (!ip && !portKnown) {
    return '—'
  }
  if (!ip) {
    return portKnown ? `—:${port}` : '—'
  }
  return portKnown ? `${ip}:${port}` : ip
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

/** 설비 이름 오름차순 (한글·영문·숫자, 운영 Devices 목록과 동일한 기준) */
function compareDeviceNameAsc(a: string, b: string): number {
  return a.localeCompare(b, 'ko', { sensitivity: 'base', numeric: true })
}

function readProp(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) return obj[k]
  }
  return undefined
}

function optStr(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return undefined
}

function optStrNull(v: unknown): string | null {
  const s = optStr(v)
  return s === undefined ? null : s
}

function optInt(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function optBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v
  if (v === 'true' || v === 1) return true
  if (v === 'false' || v === 0) return false
  return fallback
}

/** JSON 키 변형 대응 (protocol_type, 예기치 못한 키명 등) */
function extractProtocol(r: Record<string, unknown>): string {
  const direct = optStr(readProp(r, 'protocolType', 'protocol_type', 'protocol', 'Protocol'))
  if (direct?.trim()) return direct.trim()
  for (const [k, val] of Object.entries(r)) {
    const kn = k.toLowerCase().replace(/_/g, '')
    if (kn.includes('protocol') && typeof val === 'string' && val.trim().length > 0) {
      return val.trim()
    }
  }
  return 'MODBUS_TCP'
}

function isModbusRtuProtocol(protocol: string | undefined | null): boolean {
  if (!protocol?.trim()) return false
  return protocol.trim().toUpperCase().replace(/-/g, '_') === 'MODBUS_RTU'
}

function normalizeAdminDevice(raw: unknown): AdminDevice {
  const r = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const lastRaw = readProp(r, 'lastSeenAt', 'last_seen_at', 'lastSeen', 'last_seen')
  let lastSeenAt: string | null = null
  if (typeof lastRaw === 'string' && lastRaw.length > 0) {
    lastSeenAt = lastRaw
  } else if (typeof lastRaw === 'number' && Number.isFinite(lastRaw)) {
    lastSeenAt = new Date(lastRaw).toISOString()
  }

  return {
    deviceId: optStr(readProp(r, 'deviceId', 'device_id')) ?? '',
    name: optStr(readProp(r, 'name')) ?? '',
    code: optStr(readProp(r, 'code')) ?? '',
    description: optStrNull(readProp(r, 'description')),
    groupName: optStrNull(readProp(r, 'groupName', 'group_name')),
    protocolType: extractProtocol(r),
    ip: optStr(readProp(r, 'ip', 'ip_address')) ?? '',
    port: optInt(readProp(r, 'port'), 0),
    slaveId: optInt(readProp(r, 'slaveId', 'slave_id'), 0),
    pollingIntervalSec: optInt(readProp(r, 'pollingIntervalSec', 'polling_interval_sec'), 5),
    timeoutMs: optInt(readProp(r, 'timeoutMs', 'timeout_ms'), 2000),
    lastSeenAt,
    isActive: optBool(readProp(r, 'isActive', 'is_active', 'active'), true),
    status: optStr(readProp(r, 'status')) ?? '',
    tagCount: optInt(readProp(r, 'tagCount', 'tag_count'), 0),
  }
}

function parseDashDevice(raw: unknown): DashDevice | null {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o) return null
  const id = optStr(readProp(o, 'deviceId', 'device_id'))
  if (!id) return null
  return {
    deviceId: id,
    groupName: optStrNull(readProp(o, 'groupName', 'group_name')),
    alarmState: optStr(readProp(o, 'alarmState', 'alarm_state')) ?? 'NORMAL',
    worstQuality: optStr(readProp(o, 'worstQuality', 'worst_quality')) ?? '—',
    status: optStr(readProp(o, 'status')) ?? '',
    lastSeen: optStrNull(readProp(o, 'lastSeen', 'last_seen')),
  }
}

function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden border border-[#24303a] bg-[#11181f] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#24303a] px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-slate-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-3 text-sm leading-relaxed text-slate-200">{body}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#24303a] px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="border border-rose-900/60 bg-[#2c1819] px-4 py-2 text-sm text-rose-100 hover:bg-[#3a2022]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#24303a] bg-[#131b23] p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-100">{value}</div>
    </div>
  )
}

export default function AdminDeviceListPage() {
  const navigate = useNavigate()
  const pageSize = DEVICES_LIST_PAGE_SIZE
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<MergedRow[]>([])
  const [pageInfo, setPageInfo] = useState<AdminDeviceListData['pageInfo'] | null>(null)
  const [dashSummary, setDashSummary] = useState<DashboardSummary | null>(null)
  const [groupOptions, setGroupOptions] = useState<string[]>(['ALL'])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [protocolFilter, setProtocolFilter] = useState('ALL')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MergedRow | null>(null)
  /** 행별 "More" 드롭다운 — 버튼 줄바꿈 방지 */
  const [actionMenuDeviceId, setActionMenuDeviceId] = useState<string | null>(null)

  useEffect(() => {
    if (actionMenuDeviceId == null) return
    const onDown = (e: MouseEvent) => {
      const el = document.querySelector(`[data-device-action-menu="${actionMenuDeviceId}"]`)
      if (el && !el.contains(e.target as Node)) {
        setActionMenuDeviceId(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [actionMenuDeviceId])

  useEffect(() => {
    void (async () => {
      try {
        const list = await apiGet<Array<{ id: string; name: string }>>('/api/v1/admin/devices/device-groups')
        const names = list.map((g) => g.name).sort()
        setGroupOptions(['ALL', 'Ungrouped', ...names])
      } catch {
        setGroupOptions(['ALL', 'Ungrouped'])
      }
    })()
  }, [])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
      })
      const kw = query.trim()
      if (kw) params.set('keyword', kw)
      if (groupFilter !== 'ALL') params.set('group', groupFilter)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (protocolFilter !== 'ALL') params.set('protocol', protocolFilter)

      const [listRes, overview] = await Promise.all([
        apiGet<AdminDeviceListData>(`/api/v1/admin/devices?${params}`),
        apiGet<DashboardOverview>('/api/v1/dashboard/overview?includeActiveAlarms=false'),
      ])

      setPageInfo(listRes.pageInfo)
      setDashSummary(overview.summary)

      const dashById = new Map<string, DashDevice>()
      for (const raw of overview.devices as unknown[]) {
        const row = parseDashDevice(raw)
        if (row) dashById.set(row.deviceId, row)
      }

      const merged: MergedRow[] = listRes.devices.map((raw) => {
        const d = normalizeAdminDevice(raw)
        const dash = dashById.get(d.deviceId)
        const lastSeenAt =
          dash?.lastSeen != null && String(dash.lastSeen).length > 0
            ? String(dash.lastSeen)
            : d.lastSeenAt
        const groupName = d.groupName ?? dash?.groupName ?? null
        return {
          ...d,
          groupName,
          lastSeenAt,
          alarmState: dash?.alarmState ?? 'NORMAL',
          worstQuality: dash?.worstQuality ?? '—',
        }
      })
      merged.sort((x, y) => compareDeviceNameAsc(x.name, y.name))
      setRows(merged)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load')
      setRows([])
      setPageInfo(null)
      setDashSummary(null)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, query, groupFilter, statusFilter, protocolFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!pageInfo) return
    const { totalPages: tp, totalElements } = pageInfo
    if (totalElements === 0 && page !== 1) {
      setPage(1)
      return
    }
    if (tp > 0 && page > tp) setPage(tp)
  }, [pageInfo, page])

  const stats = useMemo(() => {
    const total = pageInfo?.totalElements ?? 0
    const s = dashSummary
    if (!s) {
      return { total, online: 0, offline: 0, alarm: 0, inactive: 0 }
    }
    const inactive = Math.max(0, total - s.deviceCount)
    return {
      total,
      online: s.onlineCount,
      offline: s.offlineCount,
      alarm: s.warningCount + s.criticalCount,
      inactive,
    }
  }, [dashSummary, pageInfo])

  const totalFiltered = pageInfo?.totalElements ?? 0
  const totalPages = useMemo(() => {
    const tp = pageInfo?.totalPages ?? 0
    return totalFiltered === 0 ? 1 : Math.max(1, tp)
  }, [pageInfo?.totalPages, totalFiltered])

  const currentPage = Math.min(page, totalPages)
  const startIndex = pageInfo ? Math.max(0, (pageInfo.page - 1) * pageInfo.size) : 0

  const setActive = async (d: MergedRow, active: boolean) => {
    setActionBusy(`act-${d.deviceId}`)
    setError(null)
    try {
      await apiPatch(`/api/v1/admin/devices/${d.deviceId}`, { is_active: active })
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Update failed')
    } finally {
      setActionBusy(null)
    }
  }

  const executeDelete = useCallback(
    async (d: MergedRow) => {
      setActionBusy(`del-${d.deviceId}`)
      setError(null)
      try {
        await apiDelete(`/api/v1/admin/devices/${d.deviceId}`)
        await load()
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Delete failed')
      } finally {
        setActionBusy(null)
      }
    },
    [load],
  )

  const confirmDelete = () => {
    if (!deleteTarget) return
    const d = deleteTarget
    setDeleteTarget(null)
    void executeDelete(d)
  }

  return (
    <div className="space-y-4 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Admin</span>
            <span className="text-slate-600" aria-hidden>
              {'>'}
            </span>
            <span className="text-slate-300">Devices</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Admin Device Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            설비 {totalFiltered}대 중 {rows.length}대 표시 · 페이지 {currentPage} / {totalPages}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/devices/new')}
          className="inline-flex items-center gap-2 border border-[#4d7885] bg-[#1a2a33] px-3 py-2 text-sm text-[#d3eef4] hover:bg-[#20333d]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add Device
        </button>
      </div>

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Total Devices" value={stats.total} />
          <StatCard label="Online" value={stats.online} />
          <StatCard label="Offline" value={stats.offline} />
          <StatCard label="Alarm" value={stats.alarm} />
          <StatCard label="Inactive" value={stats.inactive} />
        </div>
        {error ? (
          <div className="border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden border border-[#24303a] bg-[#131b23]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24303a] px-4 py-3">
            <div>
              <div className="text-base font-semibold text-slate-100">Devices</div>
              <div className="mt-1 text-sm text-slate-500">
                서버 페이징 · 필터는 API로 적용됩니다.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 border border-[#315463] bg-[#16252f] px-3 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>

          <div className="grid gap-3 border-b border-[#24303a] px-4 py-4 lg:grid-cols-[minmax(260px,1fr)_180px_160px_160px]">
            <label className="flex items-center gap-2 border border-[#24303a] bg-[#10171d] px-3 py-2 text-sm text-slate-400">
              <Search className="h-4 w-4 text-slate-500" aria-hidden />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="장비명, 코드, IP, UUID 검색"
                className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
              />
            </label>
            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value)
                setPage(1)
              }}
              className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-sm text-slate-100 outline-none"
            >
              {groupOptions.map((g) => (
                <option key={g} value={g}>
                  {g === 'ALL' ? 'All Groups' : g}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-sm text-slate-100 outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ONLINE">ONLINE</option>
              <option value="OFFLINE">OFFLINE</option>
              <option value="UNKNOWN">UNKNOWN</option>
            </select>
            <select
              value={protocolFilter}
              onChange={(e) => {
                setProtocolFilter(e.target.value)
                setPage(1)
              }}
              className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-sm text-slate-100 outline-none"
            >
              <option value="ALL">All Protocols</option>
              <option value="MODBUS_TCP">MODBUS_TCP</option>
              <option value="MODBUS_RTU">MODBUS_RTU</option>
            </select>
          </div>

          <div className="overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading…
              </div>
            ) : (
              <table className="w-full min-w-[1260px] border-collapse text-left text-sm">
                <thead className="bg-[#18212a] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-[#24303a] px-4 py-3">Name</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Group</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Protocol</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Address</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Polling</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Status</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Alarm</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Quality</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Last seen</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Use</th>
                    <th className="border-b border-[#24303a] px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((device) => (
                    <tr key={device.deviceId} className="border-b border-[#24303a] hover:bg-[#17212a]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">{device.name}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {device.code}
                          <span className="text-slate-600"> · </span>
                          ID {shortId(device.deviceId)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{device.groupName ?? '—'}</td>
                      <td className="max-w-[160px] break-words px-4 py-3 text-slate-300">
                        {device.protocolType || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{addressLine(device)}</td>
                      <td className="px-4 py-3 text-slate-400">{device.pollingIntervalSec}s</td>
                      <td className="px-4 py-3">
                        <InlineBadge text={device.status} tone={statusTone(device.status)} />
                      </td>
                      <td className="px-4 py-3">
                        <InlineBadge text={device.alarmState} tone={alarmTone(device.alarmState)} />
                      </td>
                      <td className="px-4 py-3">
                        <InlineBadge text={device.worstQuality} tone={qualityTone(device.worstQuality)} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                        {formatWhen(device.lastSeenAt)}
                      </td>
                      <td className="px-4 py-3">
                        <InlineBadge
                          text={device.isActive ? 'ACTIVE' : 'INACTIVE'}
                          tone={
                            device.isActive
                              ? 'border-[#315e60] bg-[#183034] text-[#b9d8cf]'
                              : 'border-[#454f58] bg-[#202830] text-[#bdc5cb]'
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-nowrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/devices/${device.deviceId}/edit`)}
                            className="inline-flex shrink-0 items-center gap-1.5 border border-[#315463] bg-[#16252f] px-2.5 py-1.5 text-xs text-[#b8d2da] hover:bg-[#1b2c37]"
                          >
                            <SquarePen className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                          <div className="relative shrink-0" data-device-action-menu={device.deviceId}>
                            <button
                              type="button"
                              aria-expanded={actionMenuDeviceId === device.deviceId}
                              aria-haspopup="menu"
                              title="More actions"
                              onClick={() =>
                                setActionMenuDeviceId((id) =>
                                  id === device.deviceId ? null : device.deviceId,
                                )
                              }
                              className="inline-flex items-center justify-center border border-[#315463] bg-[#16252f] px-2 py-1.5 text-[#b8d2da] hover:bg-[#1b2c37]"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                              <span className="sr-only">More actions</span>
                            </button>
                            {actionMenuDeviceId === device.deviceId ? (
                              <div
                                role="menu"
                                className="absolute right-0 top-full z-50 mt-1 min-w-[188px] border border-[#24303a] bg-[#131b23] py-1 shadow-xl"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={actionBusy !== null || isModbusRtuProtocol(device.protocolType)}
                                  title={
                                    isModbusRtuProtocol(device.protocolType)
                                      ? 'MODBUS_RTU는 시리얼 연결이라 이 화면의 TCP 연결 테스트를 지원하지 않습니다.'
                                      : undefined
                                  }
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#b8d2da] hover:bg-[#17212a] disabled:cursor-not-allowed disabled:opacity-50"
                                  onClick={() => {
                                    setActionMenuDeviceId(null)
                                    navigate(`/admin/devices/${device.deviceId}/connection-test`)
                                  }}
                                >
                                  <Wifi className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  Connection test
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#b8d2da] hover:bg-[#17212a]"
                                  onClick={() => {
                                    setActionMenuDeviceId(null)
                                    navigate(`/admin/devices/${device.deviceId}/history`)
                                  }}
                                >
                                  <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  Change history
                                </button>
                                {device.isActive ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={actionBusy !== null}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#b8d2da] hover:bg-[#17212a] disabled:opacity-50"
                                    onClick={() => {
                                      setActionMenuDeviceId(null)
                                      void setActive(device, false)
                                    }}
                                  >
                                    Disable
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={actionBusy !== null}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-200 hover:bg-[#17212a] disabled:opacity-50"
                                    onClick={() => {
                                      setActionMenuDeviceId(null)
                                      setDeleteTarget(device)
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    Delete
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && rows.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                조건에 맞는 설비가 없습니다.
              </div>
            ) : null}
          </div>

          {!loading && pageInfo ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#24303a] px-4 py-3 text-sm text-slate-400">
              <span>
                {rows.length ? `${startIndex + 1}-${startIndex + rows.length}` : '0'} / {totalFiltered}
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
          ) : null}
        </div>
      </section>

      <ConfirmModal
        open={deleteTarget != null}
        title="Delete device"
        body={
          deleteTarget
            ? `Delete device "${deleteTarget.name}"? This cannot be undone.`
            : ''
        }
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
