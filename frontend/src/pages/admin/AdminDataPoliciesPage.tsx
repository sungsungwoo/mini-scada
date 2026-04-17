import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Database,
  FileClock,
  Lock,
  RefreshCw,
  Save,
  Shield,
  Trash2,
} from 'lucide-react'
import { ApiError, apiGet, apiPatch, apiPost } from '../../lib/api'

type DataPolicy = {
  rawRetentionDays: number
  aggregateRetentionDays: number
  downsamplingInterval: string
}

function readProp(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) return obj[k]
  }
  return undefined
}

function normalizePolicy(raw: unknown): DataPolicy | null {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o) return null
  const rawDays = readProp(o, 'rawRetentionDays', 'raw_retention_days')
  const aggDays = readProp(o, 'aggregateRetentionDays', 'aggregate_retention_days')
  const ds = readProp(o, 'downsamplingInterval', 'downsampling_interval')
  if (typeof rawDays !== 'number' || typeof aggDays !== 'number') return null
  return {
    rawRetentionDays: rawDays,
    aggregateRetentionDays: aggDays,
    downsamplingInterval: typeof ds === 'string' ? ds : String(ds ?? '10m'),
  }
}

/** API 문자열(10m, 1h 등) → UI용 분 단위 숫자 문자열 */
function intervalToMinutesDisplay(iso: string): string {
  const s = String(iso ?? '').trim().toLowerCase()
  const m = /^(\d+)m$/.exec(s)
  if (m) return m[1]
  const h = /^(\d+)h$/.exec(s)
  if (h) return String(parseInt(h[1], 10) * 60)
  const d = /^(\d+)d$/.exec(s)
  if (d) return String(parseInt(d[1], 10) * 24 * 60)
  if (/^\d+$/.test(s)) return s
  return '10'
}

/** 분 숫자만 받아 API용 `Nm` 로 직렬화 */
function minutesDisplayToApi(minStr: string): string {
  const n = parseInt(minStr.replace(/\D/g, ''), 10)
  if (!Number.isFinite(n) || n < 1) return '10m'
  return `${n}m`
}

function SectionCard({
  title,
  description,
  children,
  inactive,
}: {
  title: string
  description: string
  children: ReactNode
  /** API 미연동 등: 전체 비활성 표시 */
  inactive?: boolean
}) {
  return (
    <section
      className={`overflow-hidden border border-[#24303a] bg-[#131b23] ${inactive ? 'opacity-[0.92]' : ''}`}
    >
      <div className="border-b border-[#24303a] px-5 py-4">
        <div className="text-base font-semibold text-slate-100">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{description}</div>
      </div>
      <div className={`space-y-5 p-5 ${inactive ? 'pointer-events-none select-none' : ''}`}>{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <div className="text-sm font-medium text-slate-200">{label}</div>
      {children}
      {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="text"
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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-14 border transition ${checked ? 'border-[#4d7885] bg-[#1a2a33]' : 'border-[#24303a] bg-[#10171d]'} ${disabled ? 'opacity-50' : ''}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1 h-5 w-5 transition ${checked ? 'left-8 bg-[#d3eef4]' : 'left-1 bg-slate-500'}`}
      />
    </button>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#24303a] bg-[#131b23] p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  )
}

function Badge({ text, tone }: { text: string; tone: string }) {
  return (
    <span className={`inline-flex min-w-[96px] items-center justify-center border px-2 py-1 text-xs leading-none ${tone}`}>
      {text}
    </span>
  )
}

/** 미지원 필드: 값만 취소선으로 표시 */
function UnsupportedTextInput({ value }: { value: string }) {
  return (
    <TextInput
      readOnly
      disabled
      tabIndex={-1}
      value={value}
      aria-readonly
      className="cursor-not-allowed text-slate-400 line-through"
    />
  )
}

export default function AdminDataPoliciesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  const [rawDays, setRawDays] = useState('7')
  const [aggDays, setAggDays] = useState('365')
  /** 다운샘플링: 분 단위 숫자만 (UI). 저장 시 `Nm` 로 전송 */
  const [downsampleMinutes, setDownsampleMinutes] = useState('10')

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const raw = await apiGet<unknown>('/api/v1/admin/policies/data')
      const p = normalizePolicy(raw)
      if (!p) {
        setError('Invalid policy response')
        return
      }
      setRawDays(String(p.rawRetentionDays))
      setAggDays(String(p.aggregateRetentionDays))
      setDownsampleMinutes(intervalToMinutesDisplay(p.downsamplingInterval))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load policies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const rawR = parseInt(rawDays, 10)
      const rawA = parseInt(aggDays, 10)
      if (!Number.isFinite(rawR) || !Number.isFinite(rawA)) {
        setError('Retention days must be numbers')
        return
      }
      const ds = minutesDisplayToApi(downsampleMinutes)
      await apiPatch<unknown>('/api/v1/admin/policies/data', {
        raw_retention_days: rawR,
        aggregate_retention_days: rawA,
        downsampling_interval: ds,
      })
      setLastSavedAt(
        new Intl.DateTimeFormat('ko-KR', {
          dateStyle: 'medium',
          timeStyle: 'medium',
          timeZone: 'Asia/Seoul',
        }).format(new Date()),
      )
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = async () => {
    if (!window.confirm('기본값으로 되돌릴까요? (raw 7일, aggregate 365일, downsampling 10분)')) return
    setSaving(true)
    setError(null)
    try {
      await apiPost<unknown>('/api/v1/admin/policies/data/reset')
      setLastSavedAt(
        new Intl.DateTimeFormat('ko-KR', {
          dateStyle: 'medium',
          timeStyle: 'medium',
          timeZone: 'Asia/Seoul',
        }).format(new Date()),
      )
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

  const statRaw = loading ? '—' : `${rawDays} days`
  const statAgg = loading ? '—' : `${aggDays} days`
  const statDs = loading ? '—' : downsampleMinutes ? `${downsampleMinutes} 분` : '—'
  const statExtended = '—'

  return (
    <div className="space-y-4 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24303a] pb-4">
        <div>
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
            <Link to="/admin/devices" className="hover:text-slate-300">
              Admin
            </Link>
            <span className="text-slate-600">{'>'}</span>
            <span className="text-slate-300">Data Policies</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50">Data Policies</h1>
          <p className="mt-1 text-sm text-slate-400">데이터 보존, 마스킹, 삭제, 감사 추적 정책 관리</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void load()}
            className="inline-flex items-center gap-2 border border-[#315463] bg-[#16252f] px-3 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Reload
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 border border-[#4d7885] bg-[#1a2a33] px-3 py-2 text-sm text-[#d3eef4] hover:bg-[#20333d] disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden />
            Save Policies
          </button>
        </div>
      </div>

      {error ? (
        <div className="border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Raw retention" value={statRaw} />
        <StatCard label="Aggregate retention" value={statAgg} />
        <StatCard label="Downsampling" value={statDs} />
        <StatCard label="Extended metrics" value={statExtended} />
      </div>
      <p className="text-xs text-slate-500">상단 네 번째 카드는 알람·로그 보존 등 추가 지표용 표시 슬롯입니다.</p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <SectionCard
            title="Retention Policy"
            description="Raw·집계 시계열 보존, 다운샘플링(API 연동). 알람·운영 로그·삭제 유예는 별도 저장소/API 미연동(참고 표시)."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Raw retention (days)" hint="원시 시계열 데이터 보존 일수 (최소 1)">
                <TextInput
                  inputMode="numeric"
                  value={rawDays}
                  onChange={(e) => setRawDays(e.target.value.replace(/[^\d]/g, ''))}
                  disabled={loading}
                  autoComplete="off"
                />
              </Field>
              <Field label="Aggregate retention (days)" hint="집계 데이터 보존 일수 (raw 이상이어야 함)">
                <TextInput
                  inputMode="numeric"
                  value={aggDays}
                  onChange={(e) => setAggDays(e.target.value.replace(/[^\d]/g, ''))}
                  disabled={loading}
                  autoComplete="off"
                />
              </Field>
              <Field label="Downsampling interval" hint="분 단위 숫자만 (저장 시 서버에 Nm 형식으로 전송)">
                <TextInput
                  inputMode="numeric"
                  value={downsampleMinutes}
                  onChange={(e) => setDownsampleMinutes(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="10"
                  disabled={loading}
                  autoComplete="off"
                />
              </Field>
              <Field label="Alarm retention (days)" hint="알람·이벤트 이력 (미연동)">
                <UnsupportedTextInput value="730" />
              </Field>
              <Field label="System log retention (days)" hint="감사·작업 로그 (미연동)">
                <UnsupportedTextInput value="180" />
              </Field>
              <Field label="Delete grace window (days)" hint="삭제 전 복구 유예 (미연동)">
                <UnsupportedTextInput value="90" />
              </Field>
            </div>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void resetToDefaults()}
              className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              기본값으로 초기화 (API reset)
            </button>
          </SectionCard>

          <SectionCard
            inactive
            title="Purge / Cleanup"
            description="보존 초과 데이터 자동 정리 스케줄."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Purge schedule">
                <UnsupportedTextInput value="02:00" />
              </Field>
              <Field label="Cleanup scope">
                <Select
                  defaultValue="telemetry,alarms,logs"
                  disabled
                  className="text-slate-400 line-through opacity-80"
                >
                  <option value="telemetry,alarms,logs">Telemetry + Alarms + Logs</option>
                  <option value="telemetry,alarms">Telemetry + Alarms</option>
                  <option value="logs">Logs only</option>
                </Select>
              </Field>
            </div>
            <div className="rounded border border-[#24303a] bg-[#10171d] p-4 text-sm text-slate-400">
              매일 지정 시각에 보존 기간이 지난 데이터를 순차 삭제합니다. (백엔드 스케줄 미연동)
            </div>
          </SectionCard>

          <SectionCard inactive title="Privacy / Masking" description="민감 정보·내보내기 정책.">
            <div className="space-y-4">
              <div className="flex items-center justify-between border border-[#24303a] bg-[#10171d] px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">Anonymize operator metadata</div>
                  <div className="mt-1 text-xs text-slate-500">이력 조회 시 사용자 식별자 익명화</div>
                </div>
                <Toggle checked={false} onChange={() => {}} disabled />
              </div>
              <div className="flex items-center justify-between border border-[#24303a] bg-[#10171d] px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">Mask device IP / host in audit exports</div>
                  <div className="mt-1 text-xs text-slate-500">감사 내보내기에서 장비 주소 마스킹</div>
                </div>
                <Toggle checked={false} onChange={() => {}} disabled />
              </div>
              <div className="flex items-center justify-between border border-[#24303a] bg-[#10171d] px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">Require approval for policy export</div>
                  <div className="mt-1 text-xs text-slate-500">정책·감사 로그 내보내기 승인 절차</div>
                </div>
                <Toggle checked={false} onChange={() => {}} disabled />
              </div>
            </div>
          </SectionCard>

          <SectionCard inactive title="Audit Trail" description="정책 변경·삭제·내보내기 추적.">
            <div className="flex items-center justify-between border border-[#24303a] bg-[#10171d] px-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-100">Enable policy audit trail</div>
                <div className="mt-1 text-xs text-slate-500">저장·삭제·내보내기 이력 저장</div>
              </div>
              <Toggle checked={false} onChange={() => {}} disabled />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Audit retention class">
                <Select defaultValue="standard" disabled className="text-slate-400 line-through opacity-80">
                  <option value="standard">Standard</option>
                  <option value="extended">Extended</option>
                  <option value="critical">Critical Only</option>
                </Select>
              </Field>
              <Field label="Audit export format">
                <Select defaultValue="csv+json" disabled className="text-slate-400 line-through opacity-80">
                  <option value="csv+json">CSV + JSON</option>
                  <option value="csv">CSV only</option>
                  <option value="json">JSON only</option>
                </Select>
              </Field>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-5">
          <section className="border border-[#24303a] bg-[#131b23] p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" aria-hidden />
              <h2 className="text-base font-semibold text-slate-100">Policy Status</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Raw / Aggregate</span>
                <Badge text="ACTIVE" tone="border-emerald-500/35 bg-emerald-950/35 text-emerald-100" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Downsampling</span>
                <Badge text="CONFIGURED" tone="border-emerald-500/35 bg-emerald-950/35 text-emerald-100" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Masking</span>
                <Badge text="N/A" tone="border-slate-600 bg-slate-800/80 text-slate-200" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Audit Trail</span>
                <Badge text="N/A" tone="border-slate-600 bg-slate-800/80 text-slate-200" />
              </div>
            </div>
          </section>

          <section className="border border-[#24303a] bg-[#131b23] p-5">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-400" aria-hidden />
              <h2 className="text-base font-semibold text-slate-100">Affected Data</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>• Raw / aggregated telemetry (현재 API 범위)</li>
              <li className="text-slate-400 line-through">• Alarm / event history</li>
              <li className="text-slate-400 line-through">• Change history / audit logs</li>
              <li className="text-slate-400 line-through">• Export packages</li>
            </ul>
          </section>

          <section className="border border-[#24303a] bg-[#131b23] p-5">
            <div className="flex items-center gap-2">
              <FileClock className="h-4 w-4 text-slate-400" aria-hidden />
              <h2 className="text-base font-semibold text-slate-100">Last saved (client)</h2>
            </div>
            <div className="mt-4 text-sm text-slate-300">{lastSavedAt ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-500">
              저장/초기화 성공 시각(브라우저). 서버 `updated_at`은 현재 응답에 포함되지 않습니다.
            </div>
          </section>

          <section className="relative overflow-hidden border border-[#24303a] bg-[#131b23] p-5 opacity-90">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-400" aria-hidden />
              <h2 className="text-base font-semibold text-slate-100">Danger Zone</h2>
            </div>
            <div className="mt-4 text-sm text-slate-400">
              즉시 데이터 정리 실행은 되돌릴 수 없습니다. 백엔드 배치·권한 연동 전까지 비활성입니다.
            </div>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 border border-[#3f3132] bg-[#24191a] px-3 py-2 text-sm text-rose-200/70 opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Run Purge Now
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
