import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api'

type Thresholds = {
  warning: number | null
  critical: number | null
  deadband: number | null
}

type TagRow = {
  tagId: string
  name: string
  address: number
  functionCode: string
  dataType: string
  unit: string | null
  displayOrder: number
  byteSwap: boolean
  wordSwap: boolean
  thresholds: Thresholds
}

type AdminDeviceBrief = {
  deviceId: string
  name: string
  code: string
}

function readProp(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) return obj[k]
  }
  return undefined
}

function normalizeTag(raw: unknown): TagRow | null {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o) return null
  const tagId = readProp(o, 'tagId', 'tag_id')
  if (typeof tagId !== 'string' || !tagId) return null
  const thRaw = readProp(o, 'thresholds', 'threshold')
  const th =
    thRaw !== null && typeof thRaw === 'object'
      ? (thRaw as Record<string, unknown>)
      : {}
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null

  return {
    tagId,
    name: String(readProp(o, 'name') ?? ''),
    address: typeof readProp(o, 'address') === 'number' ? (readProp(o, 'address') as number) : 0,
    functionCode: String(readProp(o, 'functionCode', 'function_code') ?? '3'),
    dataType: String(readProp(o, 'dataType', 'data_type') ?? 'FLOAT32'),
    unit: readProp(o, 'unit') != null ? String(readProp(o, 'unit')) : null,
    displayOrder:
      typeof readProp(o, 'displayOrder', 'display_order') === 'number'
        ? (readProp(o, 'displayOrder', 'display_order') as number)
        : 0,
    byteSwap: Boolean(readProp(o, 'byteSwap', 'byte_swap')),
    wordSwap: Boolean(readProp(o, 'wordSwap', 'word_swap')),
    thresholds: {
      warning: num(readProp(th, 'warning')),
      critical: num(readProp(th, 'critical')),
      deadband: num(readProp(th, 'deadband')),
    },
  }
}

function normalizeDeviceBrief(raw: unknown): AdminDeviceBrief | null {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!o) return null
  const id = readProp(o, 'deviceId', 'device_id')
  if (typeof id !== 'string' || !id) return null
  return {
    deviceId: id,
    name: String(readProp(o, 'name') ?? ''),
    code: String(readProp(o, 'code') ?? ''),
  }
}

function MessageModal({
  open,
  title,
  body,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  onClose: () => void
}) {
  const titleId = useId()
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
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden border border-[#24303a] bg-[#11181f] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#24303a] px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-slate-50">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200">
            Close
          </button>
        </div>
        <div className="max-h-[min(50vh,360px)] overflow-y-auto px-4 py-3 text-sm text-slate-200 whitespace-pre-wrap">
          {body}
        </div>
        <div className="flex justify-end border-t border-[#24303a] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({
  open,
  title,
  body,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
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
          <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-200">
            Close
          </button>
        </div>
        <div className="px-4 py-3 text-sm text-slate-200">{body}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#24303a] px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="border border-rose-900/60 bg-[#2c1819] px-4 py-2 text-sm text-rose-100 hover:bg-[#3a2022]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

type TagFormState = {
  name: string
  address: string
  functionCode: string
  dataType: string
  unit: string
  displayOrder: string
  byteSwap: boolean
  wordSwap: boolean
  warning: string
  critical: string
  deadband: string
}

function emptyForm(): TagFormState {
  return {
    name: '',
    address: '0',
    functionCode: '3',
    dataType: 'FLOAT32',
    unit: '',
    displayOrder: '0',
    byteSwap: false,
    wordSwap: false,
    warning: '',
    critical: '',
    deadband: '',
  }
}

function tagToForm(t: TagRow): TagFormState {
  return {
    name: t.name,
    address: String(t.address),
    functionCode: t.functionCode,
    dataType: t.dataType,
    unit: t.unit ?? '',
    displayOrder: String(t.displayOrder),
    byteSwap: t.byteSwap,
    wordSwap: t.wordSwap,
    warning: t.thresholds.warning != null ? String(t.thresholds.warning) : '',
    critical: t.thresholds.critical != null ? String(t.thresholds.critical) : '',
    deadband: t.thresholds.deadband != null ? String(t.thresholds.deadband) : '',
  }
}

export default function AdminDeviceTagsPage() {
  const { deviceId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [device, setDevice] = useState<AdminDeviceBrief | null>(null)
  const [tags, setTags] = useState<TagRow[]>([])
  const [messageModal, setMessageModal] = useState<{ title: string; body: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TagRow | null>(null)
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; form: TagFormState; tagId?: string } | null>(
    null,
  )

  const load = useCallback(async () => {
    if (!deviceId) return
    setError(null)
    setLoading(true)
    try {
      const [dRaw, listRaw] = await Promise.all([
        apiGet<unknown>(`/api/v1/admin/devices/${deviceId}`),
        apiGet<unknown>(`/api/v1/admin/devices/${deviceId}/tags`),
      ])
      setDevice(normalizeDeviceBrief(dRaw))
      const listObj =
        listRaw !== null && typeof listRaw === 'object' ? (listRaw as Record<string, unknown>) : {}
      const rawTags = listObj.tags
      const arr = Array.isArray(rawTags) ? rawTags : []
      setTags(arr.map(normalizeTag).filter((x): x is TagRow => x != null))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load')
      setDevice(null)
      setTags([])
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditor({ mode: 'create', form: emptyForm() })
  }

  const openEdit = (t: TagRow) => {
    setEditor({ mode: 'edit', tagId: t.tagId, form: tagToForm(t) })
  }

  const closeEditor = () => setEditor(null)

  const submitEditor = async () => {
    if (!editor || !deviceId) return
    const f = editor.form
    const name = f.name.trim()
    if (!name) {
      setMessageModal({ title: 'Validation', body: 'Tag name is required.' })
      return
    }
    const address = parseInt(f.address, 10)
    if (!Number.isFinite(address)) {
      setMessageModal({ title: 'Validation', body: 'Address must be a number.' })
      return
    }
    const displayOrder = parseInt(f.displayOrder, 10) || 0
    const parseOptNum = (s: string) => {
      const t = s.trim()
      if (t === '') return null
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    }

    const body: Record<string, unknown> = {
      name,
      address,
      function_code: f.functionCode,
      data_type: f.dataType.trim() || 'FLOAT32',
      unit: f.unit.trim() === '' ? null : f.unit.trim(),
      display_order: displayOrder,
      byte_swap: f.byteSwap,
      word_swap: f.wordSwap,
      warning_threshold: parseOptNum(f.warning),
      critical_threshold: parseOptNum(f.critical),
      deadband: parseOptNum(f.deadband),
    }

    setSaving(true)
    setError(null)
    try {
      if (editor.mode === 'create') {
        await apiPost(`/api/v1/admin/devices/${deviceId}/tags`, body)
      } else if (editor.tagId) {
        await apiPatch(`/api/v1/admin/tags/${editor.tagId}`, body)
      }
      closeEditor()
      await load()
    } catch (e) {
      setMessageModal({
        title: 'Save failed',
        body: e instanceof ApiError ? e.message : 'Request failed',
      })
    } finally {
      setSaving(false)
    }
  }

  const executeDelete = async (t: TagRow) => {
    setSaving(true)
    setError(null)
    try {
      await apiDelete(`/api/v1/admin/tags/${t.tagId}`)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const t = deleteTarget
    setDeleteTarget(null)
    void executeDelete(t)
  }

  const titleLine = useMemo(() => {
    if (!device) return '—'
    return `${device.name} (${device.code})`
  }, [device])

  if (!deviceId) {
    return (
      <div className="px-4 py-12 text-sm text-slate-500">Missing device id.</div>
    )
  }

  return (
    <div className="space-y-4 text-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#24303a] pb-4">
        <button
          type="button"
          onClick={() => navigate(`/admin/devices/${deviceId}/edit`)}
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
          <span className="text-slate-300">Tag/Mapping</span>
        </nav>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Tag mapping</h1>
        <p className="mt-1 text-sm text-slate-400">{titleLine}</p>
      </div>

      {error ? (
        <div className="border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}

      <div className="overflow-hidden border border-[#24303a] bg-[#131b23]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24303a] px-4 py-3">
          <div>
            <div className="text-base font-semibold text-slate-100">Tags</div>
            <div className="mt-1 text-sm text-slate-500">Modbus 주소·데이터 타입·임계값을 설정합니다.</div>
          </div>
          <button
            type="button"
            disabled={loading || saving}
            onClick={openCreate}
            className="inline-flex items-center gap-2 border border-[#4d7885] bg-[#1a2a33] px-3 py-2 text-sm text-[#d3eef4] hover:bg-[#20333d] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add tag
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead className="bg-[#18212a] text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="border-b border-[#24303a] px-4 py-3">Name</th>
                  <th className="border-b border-[#24303a] px-4 py-3">FC</th>
                  <th className="border-b border-[#24303a] px-4 py-3">Addr</th>
                  <th className="border-b border-[#24303a] px-4 py-3">Type</th>
                  <th className="border-b border-[#24303a] px-4 py-3">Unit</th>
                  <th className="border-b border-[#24303a] px-4 py-3">Order</th>
                  <th className="border-b border-[#24303a] px-4 py-3">Thresholds</th>
                  <th className="border-b border-[#24303a] px-4 py-3 w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tags.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      등록된 태그가 없습니다. Add tag로 추가하세요.
                    </td>
                  </tr>
                ) : (
                  tags.map((t) => (
                    <tr key={t.tagId} className="border-b border-[#24303a] hover:bg-[#17212a]">
                      <td className="px-4 py-3 font-medium text-slate-100">{t.name}</td>
                      <td className="px-4 py-3 text-slate-400">{t.functionCode}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{t.address}</td>
                      <td className="px-4 py-3 text-slate-300">{t.dataType}</td>
                      <td className="px-4 py-3 text-slate-400">{t.unit ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{t.displayOrder}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        W {t.thresholds.warning ?? '—'} / C {t.thresholds.critical ?? '—'} / D{' '}
                        {t.thresholds.deadband ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => openEdit(t)}
                            className="inline-flex items-center gap-1 border border-[#315463] bg-[#16252f] px-2 py-1 text-xs text-[#b8d2da] hover:bg-[#1b2c37] disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setDeleteTarget(t)}
                            className="inline-flex items-center gap-1 border border-[#3f3132] bg-[#24191a] px-2 py-1 text-xs text-rose-200 hover:bg-[#2c2021] disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editor ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => !saving && closeEditor()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tag-editor-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[#24303a] bg-[#11181f] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#24303a] px-4 py-3">
              <h2 id="tag-editor-title" className="text-base font-semibold text-slate-50">
                {editor.mode === 'create' ? 'Add tag' : 'Edit tag'}
              </h2>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <label className="block space-y-1">
                <span className="text-slate-400">Name / code</span>
                <input
                  value={editor.form.name}
                  onChange={(e) => setEditor({ ...editor, form: { ...editor.form, name: e.target.value } })}
                  className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-slate-100 outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-slate-400">Function code</span>
                  <select
                    value={editor.form.functionCode}
                    onChange={(e) =>
                      setEditor({ ...editor, form: { ...editor.form, functionCode: e.target.value } })
                    }
                    className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-slate-100 outline-none"
                  >
                    <option value="3">3 Holding registers</option>
                    <option value="4">4 Input registers</option>
                    <option value="1">1 Coils</option>
                    <option value="2">2 Discrete inputs</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400">Address</span>
                  <input
                    value={editor.form.address}
                    onChange={(e) =>
                      setEditor({ ...editor, form: { ...editor.form, address: e.target.value } })
                    }
                    className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 font-mono text-slate-100 outline-none"
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-slate-400">Data type</span>
                <input
                  value={editor.form.dataType}
                  onChange={(e) =>
                    setEditor({ ...editor, form: { ...editor.form, dataType: e.target.value } })
                  }
                  placeholder="FLOAT32, UINT16, …"
                  className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-slate-100 outline-none"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-slate-400">Unit</span>
                  <input
                    value={editor.form.unit}
                    onChange={(e) => setEditor({ ...editor, form: { ...editor.form, unit: e.target.value } })}
                    className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-slate-100 outline-none"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400">Display order</span>
                  <input
                    value={editor.form.displayOrder}
                    onChange={(e) =>
                      setEditor({ ...editor, form: { ...editor.form, displayOrder: e.target.value } })
                    }
                    className="w-full border border-[#24303a] bg-[#10171d] px-3 py-2 text-slate-100 outline-none"
                  />
                </label>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={editor.form.byteSwap}
                    onChange={(e) =>
                      setEditor({ ...editor, form: { ...editor.form, byteSwap: e.target.checked } })
                    }
                  />
                  Byte swap
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={editor.form.wordSwap}
                    onChange={(e) =>
                      setEditor({ ...editor, form: { ...editor.form, wordSwap: e.target.checked } })
                    }
                  />
                  Word swap
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Warn max</span>
                  <input
                    value={editor.form.warning}
                    onChange={(e) =>
                      setEditor({ ...editor, form: { ...editor.form, warning: e.target.value } })
                    }
                    className="w-full border border-[#24303a] bg-[#10171d] px-2 py-1.5 text-slate-100 outline-none"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Critical max</span>
                  <input
                    value={editor.form.critical}
                    onChange={(e) =>
                      setEditor({ ...editor, form: { ...editor.form, critical: e.target.value } })
                    }
                    className="w-full border border-[#24303a] bg-[#10171d] px-2 py-1.5 text-slate-100 outline-none"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-slate-500">Deadband</span>
                  <input
                    value={editor.form.deadband}
                    onChange={(e) =>
                      setEditor({ ...editor, form: { ...editor.form, deadband: e.target.value } })
                    }
                    className="w-full border border-[#24303a] bg-[#10171d] px-2 py-1.5 text-slate-100 outline-none"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#24303a] px-4 py-3">
              <button
                type="button"
                disabled={saving}
                onClick={closeEditor}
                className="border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitEditor()}
                className="border border-[#4d7885] bg-[#1a2a33] px-4 py-2 text-sm text-[#d3eef4] hover:bg-[#20333d] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MessageModal
        open={messageModal != null}
        title={messageModal?.title ?? ''}
        body={messageModal?.body ?? ''}
        onClose={() => setMessageModal(null)}
      />
      <ConfirmModal
        open={deleteTarget != null}
        title="Delete tag"
        body={deleteTarget ? `Delete tag "${deleteTarget.name}"? This cannot be undone.` : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
