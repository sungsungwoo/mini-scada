import type { ComponentType, ReactNode } from 'react'

/** 대시보드·설비 상세에서 공유하는 패널/뱃지. 한 파일에서 톤을 통일합니다. */

export function Panel({
  title,
  subtitle,
  rightSlot,
  children,
  className = '',
  /** 대시보드 그리드 셀처럼 부모 높이를 채울 때 true(기본). 스크롤 페이지에서는 false. */
  fillHeight = true,
}: {
  title: string
  subtitle?: string
  rightSlot?: ReactNode
  children: ReactNode
  className?: string
  fillHeight?: boolean
}) {
  return (
    <section
      className={`overflow-hidden border border-[#24303a] bg-[#131b23] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.14)] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[0.02em] text-slate-50">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </div>
      <div className={fillHeight ? 'min-h-0 h-[calc(100%-56px)]' : 'min-h-0'}>{children}</div>
    </section>
  )
}

export function MiniSummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="border border-[#24303a] bg-[#131b23] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
          <div className="mt-2 text-lg font-semibold text-slate-100">{value}</div>
        </div>
        <div className="border border-[#24303a] bg-[#151d25] p-2 text-slate-400">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </div>
  )
}

export function InlineBadge({
  text,
  tone,
  compact = false,
  fixed = false,
}: {
  text: string
  tone: string
  compact?: boolean
  fixed?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center justify-center border text-[11px] font-semibold tracking-[0.12em] ${tone} ${
        fixed
          ? 'h-7 w-[132px] px-2'
          : compact
            ? 'h-6 min-w-[84px] px-2'
            : 'h-7 min-w-[92px] px-2.5'
      }`}
    >
      {text}
    </span>
  )
}

export function StatusPill({
  text,
  tone,
}: {
  text: string
  tone: 'critical' | 'normal'
}) {
  return (
    <div
      className={`border px-3 py-1.5 text-xs font-semibold ${
        tone === 'critical'
          ? 'border-[#6b4a4a] bg-[#352223] text-[#dbb4b4]'
          : 'border-[#315e60] bg-[#183034] text-[#b9d8cf]'
      }`}
    >
      {text}
    </div>
  )
}

export function statusTone(status: string) {
  switch (status) {
    case 'ONLINE':
      return 'border-[#315e60] bg-[#183034] text-[#b9d8cf]'
    case 'OFFLINE':
      return 'border-[#6b4a4a] bg-[#352223] text-[#dbb4b4]'
    case 'UNKNOWN':
    case 'DISABLED':
      return 'border-[#454f58] bg-[#202830] text-[#bdc5cb]'
    default:
      return 'border-[#454f58] bg-[#202830] text-[#bdc5cb]'
  }
}

export function alarmTone(state: string) {
  switch (state) {
    case 'CRITICAL':
      return 'border-[#6b4a4a] bg-[#352223] text-[#dbb4b4]'
    case 'WARNING':
      return 'border-[#6a5b40] bg-[#322b1f] text-[#d8c6a3]'
    case 'NORMAL':
      return 'border-[#315e60] bg-[#183034] text-[#b9d8cf]'
    case 'INFO':
      return 'border-sky-500/35 bg-sky-950/35 text-sky-100'
    case 'UNKNOWN':
      return 'border-[#454f58] bg-[#202830] text-[#bdc5cb]'
    default:
      return 'border-[#315463] bg-[#16252f] text-[#b8d2da]'
  }
}

export function qualityTone(quality: string) {
  switch (quality) {
    case 'GOOD':
      return 'border-[#315e60] bg-[#183034] text-[#b9d8cf]'
    case 'BAD':
      return 'border-[#6a5b40] bg-[#322b1f] text-[#d8c6a3]'
    case 'UNCERTAIN':
    case 'UNKNOWN':
      return 'border-[#454f58] bg-[#202830] text-[#bdc5cb]'
    case 'TIMEOUT':
      return 'border-[#6b4a4a] bg-[#352223] text-[#dbb4b4]'
    default:
      return 'border-[#454f58] bg-[#202830] text-[#bdc5cb]'
  }
}

export function pollingTone(result: string) {
  switch (result) {
    case 'SUCCESS':
      return 'border-[#315e60] bg-[#183034] text-[#b9d8cf]'
    case 'PARTIAL_SUCCESS':
      return 'border-[#6a5b40] bg-[#322b1f] text-[#d8c6a3]'
    case 'TIMEOUT':
    case 'ERROR':
      return 'border-[#6b4a4a] bg-[#352223] text-[#dbb4b4]'
    default:
      return 'border-[#454f58] bg-[#202830] text-[#bdc5cb]'
  }
}
