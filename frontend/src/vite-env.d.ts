/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 설정 시 브라우저가 API를 이 출처로 직접 호출 (Docker + 호스트 브라우저에 권장). 미설정 시 상대 경로 `/api` → Vite 프록시 */
  readonly VITE_API_ORIGIN?: string
  readonly VITE_MQTT_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
