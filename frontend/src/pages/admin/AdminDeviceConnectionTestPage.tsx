import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { ApiError, apiPost } from '../../lib/api'

type SampleRead = {
  tagId: string
  name: string
  addressLabel: string
  valueDisplay: string
  result: string
  errorMessage: string | null
}

type ConnectionTestPayload = {
  success: boolean
  reachable: boolean
  responseTimeMs: number | null
  message: string
  deviceId: string
  name: string
  code: string
  groupName: string | null
  protocolType: string
  target: string
  slaveId: number | null
  pollingIntervalSec: number
  timeoutMs: number
  sampleReads: SampleRead[]
  logLines: string[]
  tagsOk: number
  tagsTotal: number
}

function readProp(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) return obj[k]
  }
  return undefined
}

function normalizePayload(raw: unknown): ConnectionTestPayload | null {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o) return null
  const sampleRaw = readProp(o, 'sampleReads', 'sample_reads')
  const samples: SampleRead[] = []
  if (Array.isArray(sampleRaw)) {
    for (const row of sampleRaw) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const tagId = readProp(r, 'tagId', 'tag_id')
      if (typeof tagId !== 'string') continue
      samples.push({
        tagId,
        name: String(readProp(r, 'name') ?? ''),
        addressLabel: String(readProp(r, 'addressLabel', 'address_label') ?? ''),
        valueDisplay: String(readProp(r, 'valueDisplay', 'value_display') ?? '—'),
        result: String(readProp(r, 'result') ?? ''),
        errorMessage:
          readProp(r, 'errorMessage', 'error_message') != null
            ? String(readProp(r, 'errorMessage', 'error_message'))
            : null,
      })
    }
  }
  const logsRaw = readProp(o, 'logLines', 'log_lines')
  const logLines = Array.isArray(logsRaw) ? logsRaw.map((x) => String(x)) : []

  return {
    success: Boolean(readProp(o, 'success')),
    reachable: Boolean(readProp(o, 'reachable')),
    responseTimeMs: (() => {
      const rt = readProp(o, 'responseTimeMs', 'response_time_ms')
      return typeof rt === 'number' ? rt : null
    })(),
    message: String(readProp(o, 'message') ?? ''),
    deviceId: String(readProp(o, 'deviceId', 'device_id') ?? ''),
    name: String(readProp(o, 'name') ?? ''),
    code: String(readProp(o, 'code') ?? ''),
    groupName:
      readProp(o, 'groupName', 'group_name') != null ? String(readProp(o, 'groupName', 'group_name')) : null,
    protocolType: String(readProp(o, 'protocolType', 'protocol_type') ?? ''),
    target: String(readProp(o, 'target') ?? ''),
    slaveId:
      typeof readProp(o, 'slaveId', 'slave_id') === 'number'
        ? (readProp(o, 'slaveId', 'slave_id') as number)
        : null,
    pollingIntervalSec:
      typeof readProp(o, 'pollingIntervalSec', 'polling_interval_sec') === 'number'
        ? (readProp(o, 'pollingIntervalSec', 'polling_interval_sec') as number)
        : 0,
    timeoutMs:
      typeof readProp(o, 'timeoutMs', 'timeout_ms') === 'number'
        ? (readProp(o, 'timeoutMs', 'timeout_ms') as number)
        : 0,
    sampleReads: samples,
    logLines,
    tagsOk: typeof readProp(o, 'tagsOk', 'tags_ok') === 'number' ? (readProp(o, 'tagsOk', 'tags_ok') as number) : 0,
    tagsTotal:
      typeof readProp(o, 'tagsTotal', 'tags_total') === 'number'
        ? (readProp(o, 'tagsTotal', 'tags_total') as number)
        : 0,
  }
}

function toneForResult(value: string) {
  const v = value.toUpperCase()
  if (v === 'SUCCESS' || v === 'OK') return 'border-emerald-500/35 bg-emerald-950/35 text-emerald-100'
  if (v === 'FAILED' || v === 'NOT_ATTEMPTED') return 'border-rose-500/35 bg-rose-950/35 text-rose-100'
  if (v === 'PARTIAL' || v === 'SKIPPED') return 'border-amber-500/35 bg-amber-950/35 text-amber-100'
  return 'border-slate-600 bg-slate-800/80 text-slate-200'
}

function Badge({ text, tone }: { text: string; tone: string }) {
  return (
    <span
      className={`inline-flex min-w-[88px] items-center justify-center border px-2 py-1 text-xs leading-none ${tone}`}
    >
      {text}
    </span>
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

function headlineResult(d: ConnectionTestPayload): string {
  if (!d.reachable) return 'FAILED'
  if (d.success) return 'SUCCESS'
  return 'PARTIAL'
}

export default function AdminDeviceConnectionTestPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const latestDeviceIdRef = useRef<string | undefined>(deviceId)
  latestDeviceIdRef.current = deviceId
  const [runCount, setRunCount] = useState(0)
  const [sessionLogs, setSessionLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ConnectionTestPayload | null>(null)

  const runTest = useCallback(async () => {
    if (!deviceId) {
      setLoading(false)
      setError('Missing device ID')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const raw = await apiPost<unknown>(`/api/v1/admin/devices/${deviceId}/connection-test`)
      const n = normalizePayload(raw)
      if (!n) {
        setData(null)
        setError('Invalid response from server')
        return
      }
      if (n.deviceId !== latestDeviceIdRef.current) {
        return
      }
      setData(n)
      setError(null)
      const lines = n.logLines.length > 0 ? n.logLines : ['(서버 응답에 로그 줄이 없습니다)']
      setSessionLogs((prev) => (prev.length === 0 ? lines : [...prev, '', ...lines]))
      setRunCount((c) => c + 1)
    } catch (e) {
      setData(null)
      setError(e instanceof ApiError ? e.message : 'Connection test failed')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    setSessionLogs([])
  }, [deviceId])

  useEffect(() => {
    if (!deviceId) {
      setLoading(false)
      setError('Missing device ID')
      return
    }
    void runTest()
  }, [deviceId, runTest])

  const summaryLabel = data ? headlineResult(data) : '—'

  const visibleLogs = sessionLogs.filter((line) => line !== '' && !line.startsWith('━━━'))

  return (
    <div className="space-y-4 text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24303a] pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/devices')}
            className="inline-flex shrink-0 items-center gap-1.5 border border-[#24303a] bg-[#151d25] px-2.5 py-1.5 text-sm text-slate-300 hover:bg-[#1a232d]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back
          </button>
          <nav className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
            <Link to="/admin/devices" className="hover:text-slate-300">
              Admin
            </Link>
            <span className="text-slate-600" aria-hidden>
              {'>'}
            </span>
            <Link to="/admin/devices" className="hover:text-slate-300">
              Devices
            </Link>
            <span className="text-slate-600" aria-hidden>
              {'>'}
            </span>
            <span className="text-slate-300">Connection Test</span>
          </nav>
        </div>
        <button
          type="button"
          disabled={loading || !deviceId}
          onClick={() => void runTest()}
          className="inline-flex shrink-0 items-center gap-2 border border-[#315463] bg-[#16252f] px-3 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Run test again
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Connection Test</h1>
        <div className="mt-1 font-mono text-xs text-slate-500">/admin/devices/{deviceId}/connection-test</div>
      </div>

        {error ? (
          <div className="border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}

        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            Running connection test…
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Result" value={summaryLabel} />
              <StatCard
                label="Response time"
                value={data.responseTimeMs != null ? `${data.responseTimeMs} ms` : '—'}
              />
              <StatCard label="Sample tags" value={`${data.tagsOk} / ${data.tagsTotal}`} />
              <StatCard label="Run count" value={runCount} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <section className="overflow-hidden border border-[#24303a] bg-[#131b23]">
                  <div className="border-b border-[#24303a] px-4 py-3">
                    <div className="text-base font-semibold text-slate-100">Connection result</div>
                    <div className="mt-1 text-sm text-slate-500">
                      저장된 IP·포트·슬레이브로 접속해 등록된 태그 레지스터를 읽습니다 (MODBUS_TCP).
                    </div>
                  </div>
                  <div className="space-y-5 p-5">
                    <div className="rounded border border-[#24303a] bg-[#10171d] p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge text={summaryLabel} tone={toneForResult(summaryLabel)} />
                        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-300">
                          {data.success && data.reachable ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                          ) : null}
                          <span className="break-words">{data.message || '—'}</span>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Target</div>
                          <div className="mt-1 font-mono text-slate-200">{data.target || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Protocol</div>
                          <div className="mt-1 text-slate-200">{data.protocolType || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Slave ID</div>
                          <div className="mt-1 text-slate-200">{data.slaveId ?? '—'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded border border-[#24303a]">
                      <div className="border-b border-[#24303a] bg-[#18212a] px-4 py-3 text-sm font-medium text-slate-200">
                        Sample tag reads
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                          <thead className="bg-[#141b22] text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="border-b border-[#24303a] px-4 py-3">Tag</th>
                              <th className="border-b border-[#24303a] px-4 py-3">Address</th>
                              <th className="border-b border-[#24303a] px-4 py-3">Value</th>
                              <th className="border-b border-[#24303a] px-4 py-3">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.sampleReads.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                  등록된 태그가 없습니다. Tag mapping에서 태그를 추가하세요.
                                </td>
                              </tr>
                            ) : (
                              data.sampleReads.map((row) => (
                                <tr key={row.tagId} className="border-b border-[#24303a] last:border-b-0">
                                  <td className="px-4 py-3 text-slate-100">{row.name}</td>
                                  <td className="px-4 py-3 font-mono text-slate-400">{row.addressLabel}</td>
                                  <td className="px-4 py-3 text-slate-300">{row.valueDisplay}</td>
                                  <td className="px-4 py-3">
                                    <Badge text={row.result} tone={toneForResult(row.result)} />
                                    {row.errorMessage ? (
                                      <div className="mt-1 max-w-xs text-xs text-slate-500">{row.errorMessage}</div>
                                    ) : null}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded border border-[#24303a] bg-[#10171d] p-4">
                      <div className="text-sm font-medium text-slate-200">Test log</div>
                      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
                        {visibleLogs.length === 0 ? (
                          <div className="text-slate-600">테스트를 실행하면 로그가 여기에 쌓입니다. Run test again으로 반복 실행 시 이전 기록이 유지됩니다.</div>
                        ) : (
                          visibleLogs.map((line, i) => (
                            <div key={`${i}-${line}`}>{line}</div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <aside className="space-y-5">
                <section className="border border-[#24303a] bg-[#131b23] p-5">
                  <h2 className="text-base font-semibold text-slate-100">Device info</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">Device</dt>
                      <dd className="mt-1 text-slate-100">{data.name}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">Code</dt>
                      <dd className="mt-1 font-mono text-slate-300">{data.code}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">Group</dt>
                      <dd className="mt-1 text-slate-300">{data.groupName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">Polling</dt>
                      <dd className="mt-1 text-slate-300">{data.pollingIntervalSec}s</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-slate-500">Timeout</dt>
                      <dd className="mt-1 text-slate-300">{data.timeoutMs} ms</dd>
                    </div>
                  </dl>
                </section>
              </aside>
            </div>
          </>
        ) : null}
    </div>
  )
}
