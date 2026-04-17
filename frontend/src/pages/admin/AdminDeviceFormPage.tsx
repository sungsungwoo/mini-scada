import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, Settings2, Wifi } from 'lucide-react'
import { ApiError, apiGet, apiPatch, apiPost } from '../../lib/api'

type DeviceGroupOption = { id: string; name: string }

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

type DashboardOverview = {
  devices: Array<{
    deviceId: string
    primaryTags: Array<{ tagName: string }>
  }>
}

/** API/DB 값이 MODBUS-TCP, modbus_tcp 등으로 올 수 있어 저장·검증 전에 통일 */
function normalizeProtocolType(raw: string | undefined | null): string {
  const s = String(raw ?? 'MODBUS_TCP')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
  return s === 'TCP' ? 'MODBUS_TCP' : s
}

function isModbusTcp(p: string): boolean {
  return normalizeProtocolType(p) === 'MODBUS_TCP'
}

/** DB `chk_devices_protocol` 및 시드와 맞춤. 편집 시 현재 값이 목록에 없으면 표시용으로 추가 */
function protocolSelectOptions(isNewDevice: boolean, current: string): string[] {
  const base = ['MODBUS_TCP', 'MODBUS_RTU', 'SIMULATOR'] as const
  if (isNewDevice) {
    return ['MODBUS_TCP']
  }
  const p = normalizeProtocolType(current)
  if (base.includes(p as (typeof base)[number])) {
    return [...base]
  }
  return [...base, p].sort()
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-slate-200">{label}</div>
      {children}
      {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 ${props.className ?? ''}`}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-sm text-slate-100 outline-none ${props.className ?? ''}`}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 ${props.className ?? ''}`}
    />
  )
}

export default function AdminDeviceFormPage() {
  const { deviceId } = useParams()
  const navigate = useNavigate()
  const isNew = !deviceId

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<DeviceGroupOption[]>([])
  const [primaryTag, setPrimaryTag] = useState('—')

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [groupId, setGroupId] = useState('')
  const [active, setActive] = useState(true)
  const [protocolType, setProtocolType] = useState('MODBUS_TCP')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('502')
  const [slaveId, setSlaveId] = useState('1')
  const [pollingSec, setPollingSec] = useState('5')
  const [timeoutMs, setTimeoutMs] = useState('2000')
  const [tagCount, setTagCount] = useState(0)

  const pathText = useMemo(
    () =>
      (isNew ? '/admin/devices/new' : `/admin/devices/${deviceId}/edit`)
        .replace(/^\//, '')
        .replace(/\//g, ' > '),
    [deviceId, isNew],
  )

  const loadPage = useCallback(async () => {
    setError(null)
    if (deviceId) {
      setLoading(true)
    }
    try {
      const list = await apiGet<DeviceGroupOption[]>('/api/v1/admin/devices/device-groups')
      setGroups(list)
      if (!deviceId) {
        setLoading(false)
        return
      }
      const [d, overview] = await Promise.all([
        apiGet<AdminDevice>(`/api/v1/admin/devices/${deviceId}`),
        apiGet<DashboardOverview>('/api/v1/dashboard/overview?includeActiveAlarms=false').catch(() => ({
          devices: [] as DashboardOverview['devices'],
        })),
      ])
      setName(d.name)
      setCode(d.code)
      setDescription(d.description ?? '')
      setActive(d.isActive)
      setProtocolType(
        normalizeProtocolType(
          (d as AdminDevice & { protocol_type?: string }).protocol_type ?? d.protocolType,
        ),
      )
      setHost(d.ip ?? '')
      setPort(String(d.port ?? 502))
      setSlaveId(String(d.slaveId ?? 1))
      setPollingSec(String(d.pollingIntervalSec ?? 5))
      setTimeoutMs(String(d.timeoutMs ?? 2000))
      setTagCount(Number(d.tagCount ?? 0))
      if (d.groupName) {
        const g = list.find((x) => x.name === d.groupName)
        setGroupId(g?.id ?? '')
      } else {
        setGroupId('')
      }
      const row = overview.devices.find((x) => x.deviceId === deviceId)
      const pt = row?.primaryTags?.[0]?.tagName
      setPrimaryTag(pt ?? '—')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load device')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const performSave = useCallback(async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Device name is required')
    }
    if (isNew && !isModbusTcp(protocolType)) {
      window.alert('신규 등록은 MODBUS_TCP만 지원합니다.')
      throw new Error('Unsupported protocol')
    }
    const bodyBase = {
      name: trimmedName,
      description: description.trim() === '' ? '' : description.trim(),
      ip: host.trim(),
      port: parseInt(port, 10),
      slave_id: parseInt(slaveId, 10),
      polling_interval_sec: parseInt(pollingSec, 10),
      timeout_ms: parseInt(timeoutMs, 10),
      ...(groupId ? { device_group_id: groupId } : {}),
    }
    if (isNew) {
      const created = await apiPost<AdminDevice>('/api/v1/admin/devices', bodyBase)
      navigate(`/admin/devices/${created.deviceId}/edit`, { replace: true })
      return
    }
    await apiPatch<AdminDevice>(`/api/v1/admin/devices/${deviceId}`, {
      ...bodyBase,
      is_active: active,
      device_group_id: groupId || '',
      protocol_type: normalizeProtocolType(protocolType),
    })
    await loadPage()
  }, [
    active,
    description,
    deviceId,
    groupId,
    host,
    isNew,
    loadPage,
    name,
    navigate,
    pollingSec,
    port,
    protocolType,
    slaveId,
    timeoutMs,
  ])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await performSave()
    } catch (e) {
      if (e instanceof Error && e.message === 'Unsupported protocol') return
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !isNew) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
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
          <span>Admin</span>
          <span className="text-slate-600">{'>'}</span>
          <span className="text-slate-300">Devices</span>
          <span className="text-slate-600">{'>'}</span>
          <span className="text-slate-300">{isNew ? 'New' : 'Edit'}</span>
        </nav>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-50">
          {isNew ? 'New Device' : 'Edit Device'}
        </h1>
        <div className="mt-1 text-sm text-slate-500">{pathText}</div>
      </div>

      {error ? (
        <div className="border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden border border-[#24303a] bg-[#131b23]">
          <div className="flex items-center justify-between border-b border-[#24303a] px-4 py-3">
            <div>
              <div className="text-base font-semibold text-slate-100">
                {isNew ? 'New Device' : 'Edit Device'}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                기본 정보와 연결 설정을 입력한 뒤 저장합니다.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/admin/devices')}
                className="border border-[#24303a] bg-[#131b23] px-3 py-2 text-sm text-slate-300 hover:bg-[#18212a]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="inline-flex items-center gap-2 border border-[#4d7885] bg-[#1a2a33] px-3 py-2 text-sm text-[#d3eef4] hover:bg-[#20333d] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Device
              </button>
            </div>
          </div>

          <div className="space-y-6 p-5">
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-slate-400" aria-hidden />
                <h2 className="text-base font-semibold text-slate-100">Basic Info</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Device Name">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Boiler-01"
                  />
                </Field>
                <Field label="Device Code" hint="신규 저장 시 서버에서 자동 생성됩니다.">
                  <Input
                    value={isNew ? '' : code}
                    placeholder={isNew ? '저장 후 표시' : undefined}
                    readOnly
                    className="text-slate-400"
                  />
                </Field>
                <Field label="Group">
                  <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    <option value="">No group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Use Status" hint="Inactive 설비는 운영 목록에서 제외할 수 있습니다.">
                  <Select
                    value={active ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setActive(e.target.value === 'ACTIVE')}
                    disabled={isNew}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </Select>
                </Field>
              </div>
              <Field label="Description">
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="설비 설명 또는 운영 메모"
                />
              </Field>
            </section>

            <section className="space-y-4 border-t border-[#24303a] pt-5">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-slate-400" aria-hidden />
                <h2 className="text-base font-semibold text-slate-100">Connection</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Protocol"
                  hint={
                    isNew
                      ? '신규 설비는 MODBUS_TCP만 선택할 수 있습니다.'
                      : 'MODBUS_TCP만 스케줄 Modbus 폴링 대상입니다. SIMULATOR·MODBUS_RTU는 DB 표기용·추후 확장용입니다.'
                  }
                >
                  <Select
                    value={normalizeProtocolType(protocolType)}
                    onChange={(e) => setProtocolType(normalizeProtocolType(e.target.value))}
                  >
                    {protocolSelectOptions(isNew, protocolType).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Host / IP">
                  <Input
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.0.35"
                  />
                </Field>
                <Field label="Port">
                  <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="502" />
                </Field>
                <Field label="Slave ID">
                  <Input value={slaveId} onChange={(e) => setSlaveId(e.target.value)} placeholder="1" />
                </Field>
                <Field label="Polling Interval (sec)">
                  <Input
                    value={pollingSec}
                    onChange={(e) => setPollingSec(e.target.value)}
                    placeholder="5"
                  />
                </Field>
                <Field label="Timeout (ms)">
                  <Input
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(e.target.value)}
                    placeholder="2000"
                  />
                </Field>
              </div>
            </section>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="border border-[#24303a] bg-[#131b23] p-5">
            <h2 className="text-base font-semibold text-slate-100">Tag Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Registered Tags</dt>
                <dd className="mt-1 text-slate-100">{tagCount}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Primary Tag</dt>
                <dd className="mt-1 text-slate-100">{primaryTag}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Current Mode</dt>
                <dd className="mt-1 text-slate-100">
                  {isNew ? 'Create new device' : 'Edit existing device'}
                </dd>
              </div>
            </dl>
            {deviceId && !isNew ? (
              <Link
                to={`/admin/devices/${deviceId}/tags`}
                className="mt-5 flex w-full justify-center border border-[#315463] bg-[#16252f] px-3 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
              >
                Manage Tags
              </Link>
            ) : (
              <div className="mt-5 text-xs text-slate-500">저장 후 태그 관리로 이동할 수 있습니다.</div>
            )}
          </div>
        </aside>
      </section>
    </div>
  )
}
