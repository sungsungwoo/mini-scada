import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 border border-rose-900/40 bg-rose-950/20 p-8 text-center">
      <h1 className="text-lg font-semibold text-rose-100">403 — 권한 없음</h1>
      <p className="max-w-md text-sm text-slate-400">
        이 메뉴는 관리자(ADMIN)만 사용할 수 있습니다. IA의 <code className="text-slate-300">/403</code>{' '}
        흐름과 동일하게 안내합니다.
      </p>
      <Link to="/dashboard" className="text-sm text-[#9fd0c4] underline">
        대시보드로 돌아가기
      </Link>
    </div>
  )
}
