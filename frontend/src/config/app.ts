/**
 * 설비 목록 페이지의 서버 페이징 크기.
 * `.env` 에 `VITE_DEVICES_LIST_PAGE_SIZE` 가 있으면 그 값을 쓰고, 없거나 유효하지 않으면 10.
 */
export const DEVICES_LIST_PAGE_SIZE = (() => {
  const raw = import.meta.env.VITE_DEVICES_LIST_PAGE_SIZE
  const n = typeof raw === 'string' ? Number(raw.trim()) : Number(raw)
  if (!Number.isFinite(n) || n < 1) return 10
  return Math.min(200, Math.floor(n))
})()

/** 알람 목록 페이지당 행 수. `VITE_ALARMS_LIST_PAGE_SIZE` 로 덮어쓰기 (기본 10). */
export const ALARMS_LIST_PAGE_SIZE = (() => {
  const raw = import.meta.env.VITE_ALARMS_LIST_PAGE_SIZE
  const n = typeof raw === 'string' ? Number(raw.trim()) : Number(raw)
  if (!Number.isFinite(n) || n < 1) return 10
  return Math.min(200, Math.floor(n))
})()

/** 대시보드 자동 새로고침 주기(초). `VITE_DASHBOARD_REFRESH_INTERVAL_SEC` — 없거나 잘못되면 10. */
export const DASHBOARD_REFRESH_INTERVAL_SEC = (() => {
  const raw = import.meta.env.VITE_DASHBOARD_REFRESH_INTERVAL_SEC
  const n = typeof raw === 'string' ? Number(raw.trim()) : Number(raw)
  if (!Number.isFinite(n) || n < 1) return 10
  return Math.min(3600, Math.floor(n))
})()
