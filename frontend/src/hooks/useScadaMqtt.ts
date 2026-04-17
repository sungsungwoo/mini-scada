import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mqtt, { type MqttClient } from 'mqtt'

const DEFAULT_PREFIX = '/scada'

export type DeviceLive = {
  status?: { status: string; lastSeen: string }
  tags: Record<
    string,
    {
      value: unknown
      unit: string
      alarmState: string
      quality: string
    }
  >
}

export type ScadaLiveState = {
  /** deviceId(UUID) → 최신 MQTT로 받은 조각 */
  byDevice: Record<string, DeviceLive>
  /** /scada/alarm 마지막 페이로드들 (최근 N건) */
  recentAlarms: unknown[]
}

function parseTopic(
  topic: string,
  prefix: string,
):
  | { kind: 'alarm' }
  | { kind: 'status'; deviceId: string }
  | { kind: 'tag'; deviceId: string; tagCode: string }
  | { kind: 'unknown' } {
  if (!topic.startsWith(prefix + '/')) {
    return { kind: 'unknown' }
  }
  const rest = topic.slice(prefix.length + 1)
  if (rest === 'alarm') {
    return { kind: 'alarm' }
  }
  const i = rest.indexOf('/')
  if (i <= 0) {
    return { kind: 'unknown' }
  }
  const deviceId = rest.slice(0, i)
  const tail = rest.slice(i + 1)
  if (tail === 'status') {
    return { kind: 'status', deviceId }
  }
  if (tail.length > 0) {
    return { kind: 'tag', deviceId, tagCode: tail }
  }
  return { kind: 'unknown' }
}

function safeJsonParse(raw: ArrayBuffer | Uint8Array | string): unknown {
  try {
    const s = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
    return JSON.parse(s) as unknown
  } catch {
    return null
  }
}

export type UseScadaMqttOptions = {
  /** 예: ws://localhost:9001 (Mosquitto WebSocket 리스너) */
  wsUrl: string | undefined
  /** 기본 /scada — 백엔드 `app.mqtt.topic-prefix` 와 맞출 것 */
  topicPrefix?: string
  /** false면 연결하지 않음 (로그인 전 등) */
  enabled?: boolean
  alarmBufferSize?: number
}

/**
 * 브로커 WebSocket에 붙어 `/scada/#` 를 구독하고, 메시지를 구조화해 둔다.
 * 대시보드는 REST 스냅샷을 먼저 그린 뒤, 동일 deviceId/tag 에 대해 이 상태로 덮어쓰면 된다.
 */
export function useScadaMqtt(options: UseScadaMqttOptions) {
  const {
    wsUrl,
    topicPrefix = DEFAULT_PREFIX,
    enabled = true,
    alarmBufferSize = 20,
  } = options

  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<ScadaLiveState>({
    byDevice: {},
    recentAlarms: [],
  })
  const clientRef = useRef<MqttClient | null>(null)

  const subscribePattern = useMemo(
    () => `${topicPrefix}/#`,
    [topicPrefix],
  )

  const resetLive = useCallback(() => {
    setLive({ byDevice: {}, recentAlarms: [] })
  }, [])

  useEffect(() => {
    if (!enabled || !wsUrl?.trim()) {
      setConnected(false)
      setError(null)
      return
    }

    setError(null)
    const client = mqtt.connect(wsUrl, {
      protocolVersion: 4,
      reconnectPeriod: 3000,
      connectTimeout: 10_000,
    })
    clientRef.current = client

    client.on('connect', () => {
      setConnected(true)
      client.subscribe(subscribePattern, { qos: 0 }, (err) => {
        if (err) {
          setError(err.message)
        }
      })
    })

    client.on('reconnect', () => {
      setError(null)
    })

    client.on('error', (e: Error) => {
      setError(e.message)
      setConnected(false)
    })

    client.on('close', () => {
      setConnected(false)
    })

    client.on('message', (topic, payload) => {
      const parsed = parseTopic(topic, topicPrefix)
      const data = safeJsonParse(payload)
      if (parsed.kind === 'unknown' || data === null) {
        return
      }

      if (parsed.kind === 'alarm') {
        setLive((prev) => ({
          ...prev,
          recentAlarms: [...prev.recentAlarms, data].slice(-alarmBufferSize),
        }))
        return
      }

      setLive((prev) => {
        const byDevice = { ...prev.byDevice }
        const cur = byDevice[parsed.deviceId] ?? { tags: {} }

        if (parsed.kind === 'status') {
          const o = data as { status?: string; lastSeen?: string }
          byDevice[parsed.deviceId] = {
            ...cur,
            status:
              o.status !== undefined && o.lastSeen !== undefined
                ? { status: o.status, lastSeen: o.lastSeen }
                : cur.status,
          }
          return { ...prev, byDevice }
        }

        if (parsed.kind === 'tag') {
          const o = data as {
            value?: unknown
            unit?: string
            alarmState?: string
            quality?: string
          }
          const tags = { ...cur.tags }
          tags[parsed.tagCode] = {
            value: o.value ?? null,
            unit: o.unit ?? '',
            alarmState: o.alarmState ?? 'UNKNOWN',
            quality: o.quality ?? 'UNKNOWN',
          }
          byDevice[parsed.deviceId] = { ...cur, tags }
          return { ...prev, byDevice }
        }

        return prev
      })
    })

    return () => {
      client.end(true)
      clientRef.current = null
      setConnected(false)
    }
  }, [enabled, wsUrl, subscribePattern, topicPrefix, alarmBufferSize])

  return {
    connected,
    error,
    live,
    resetLive,
  }
}
