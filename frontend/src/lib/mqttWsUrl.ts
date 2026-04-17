/**
 * MQTT.js WebSocket URL.
 * - `VITE_MQTT_WS_URL` 이 있으면 그대로 사용 (운영에서 Nginx `/mqtt` 프록시 등).
 * - 개발(`import.meta.env.DEV`): 동일 호스트 `/mqtt` → Vite 프록시 → Mosquitto.
 * - 운영 빌드: 기본값 없음(MQTT 끔). 브로커를 쓰면 빌드 시 `VITE_MQTT_WS_URL` 로 주입.
 */
export function getMqttWebSocketUrl(): string | undefined {
  const fromEnv = import.meta.env.VITE_MQTT_WS_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window === 'undefined') return undefined
  if (import.meta.env.PROD) return undefined
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}//${window.location.host}/mqtt`
}
