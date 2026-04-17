import type { ScadaLiveState } from '../hooks/useScadaMqtt'

/** REST 대시보드 설비 한 줄(필드는 실제 API 응답에 맞게 조정) */
export type DashboardDeviceRow = {
  deviceId: string
  name?: string
  status?: string
  lastSeen?: string | null
  /** 최악 알람 색 등 — 이미 API에서 계산된 값 */
  alarmState?: string
}

/**
 * REST로 받은 설비 목록 위에 MQTT 라이브 조각을 얹는다.
 * - status / lastSeen 은 `/scada/{id}/status` 가 오면 덮어씀
 * - 태그 요약이 필요하면 live.byDevice[id].tags 를 따로 매핑
 */
export function mergeDevicesWithLive(
  devices: DashboardDeviceRow[],
  live: ScadaLiveState,
): DashboardDeviceRow[] {
  return devices.map((d) => {
    const patch = live.byDevice[d.deviceId]
    if (!patch?.status) {
      return d
    }
    return {
      ...d,
      status: patch.status.status ?? d.status,
      lastSeen: patch.status.lastSeen ?? d.lastSeen,
    }
  })
}
