/**
 * MQTT.js WebSocket URL.
 * - `VITE_MQTT_WS_URL` 이 있으면 그대로 사용 (로컬에서 브로커 직접 접속 등).
 * - 없으면 페이지와 동일한 호스트의 `/mqtt` 로 접속 → Nginx/Vite 가 Mosquitto 로 프록시.
 *   HTTPS 페이지에서는 `wss://` 가 되어 mixed content(ws) 문제를 피함.
 */
export function getMqttWebSocketUrl(): string | undefined {
  const fromEnv = import.meta.env.VITE_MQTT_WS_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window === 'undefined') return undefined
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}//${window.location.host}/mqtt`
}
