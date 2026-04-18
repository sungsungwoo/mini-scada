const TOKEN_KEY = 'mini_scada_access_token'
const USER_KEY = 'mini_scada_user'

export type StoredUser = { id: string; username?: string; name: string; role: string }

export class ApiError extends Error {
  status: number
  errorCode: string

  constructor(status: number, errorCode: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
  }
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): StoredUser | null {
  const raw = sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredUser
  } catch {
    return null
  }
}

export function setAuthSession(token: string, user: StoredUser, remember: boolean) {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  const store = remember ? localStorage : sessionStorage
  store.setItem(TOKEN_KEY, token)
  store.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** Dispatched when the access token is invalid/expired; AuthProvider shows a modal then navigates to login. */
export const SESSION_EXPIRED_EVENT = 'mini-scada:session-expired'

export function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

/** Client-side JWT `exp` (ms since epoch). Returns null if missing/unparseable. Not a security check. */
export function parseJwtExpiresAtMs(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '='.repeat(4 - pad)
    const payload = JSON.parse(atob(b64)) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function shouldNotifySessionExpired(): boolean {
  const p = window.location.pathname
  return !p.startsWith('/login') && !p.startsWith('/register')
}

/** Docker 등: 브라우저는 호스트에서 실행되므로 백엔드는 보통 `http://localhost:8080`. 로컬만 Vite 프록시 쓸 때는 비워 둠. */
function apiUrl(path: string): string {
  const origin = import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, '') ?? ''
  const p = path.startsWith('/') ? path : `/${path}`
  return origin ? `${origin}${p}` : p
}

function pathnameOnly(path: string): string {
  return path.startsWith('http') ? new URL(path).pathname : path
}

function shouldAttemptRefreshOn401(path: string): boolean {
  const p = pathnameOnly(path)
  if (p.endsWith('/auth/refresh')) return false
  if (p.endsWith('/auth/login') || p.endsWith('/auth/register')) return false
  return true
}

let refreshPromise: Promise<boolean> | null = null

async function runRefreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    const raw = await res.text()
    if (!res.ok) return false
    let json: Record<string, unknown> | null = null
    if (raw.trim()) {
      try {
        json = JSON.parse(raw) as Record<string, unknown>
      } catch {
        return false
      }
    }
    if (!json || json.success !== true) return false
    const data = json.data as { accessToken?: string; user?: StoredUser }
    if (!data?.accessToken || !data?.user) return false
    const remember = !!localStorage.getItem(TOKEN_KEY)
    setAuthSession(data.accessToken, data.user, remember)
    return true
  } catch {
    return false
  }
}

/**
 * Uses httpOnly refresh cookie. Returns true if a new access token was stored.
 */
export async function tryRefreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = runRefreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function fetchWithRefreshRetry(
  path: string,
  init: RequestInit | undefined,
  retryAfterRefresh: boolean,
): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body != null) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' })

  if (
    res.status === 401 &&
    !retryAfterRefresh &&
    shouldAttemptRefreshOn401(path) &&
    (await tryRefreshAccessToken())
  ) {
    return fetchWithRefreshRetry(path, init, true)
  }

  return res
}

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const hadToken = !!getStoredToken()
  const res = await fetchWithRefreshRetry(path, init, false)

  const raw = await res.text()
  let json: Record<string, unknown> | null = null
  if (raw.trim()) {
    try {
      json = JSON.parse(raw) as Record<string, unknown>
    } catch {
      json = null
    }
  }

  if (res.status === 401) {
    clearAuth()
    if (hadToken && shouldNotifySessionExpired()) {
      notifySessionExpired()
    }
  }

  if (!res.ok) {
    const errorCode = json && typeof json.errorCode === 'string' ? json.errorCode : 'ERROR'
    const message =
      json && typeof json.message === 'string'
        ? json.message
        : raw.trim()
          ? raw.slice(0, 240)
          : res.statusText || 'Request failed'
    throw new ApiError(res.status, errorCode, message)
  }

  if (!json || json.success !== true) {
    const errorCode = json && typeof json.errorCode === 'string' ? json.errorCode : 'ERROR'
    const message = json && typeof json.message === 'string' ? json.message : 'Request failed'
    throw new ApiError(res.status, errorCode, message)
  }

  return json.data as T
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiFetchJson<T>(path, { method: 'GET' })
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetchJson<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetchJson<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

/** DELETE with empty or JSON error body (204 No Content = success). */
export async function apiDelete(path: string): Promise<void> {
  const hadToken = !!getStoredToken()
  const res = await fetchWithRefreshRetry(path, { method: 'DELETE' }, false)
  const raw = await res.text()

  if (res.status === 401) {
    clearAuth()
    if (hadToken && shouldNotifySessionExpired()) {
      notifySessionExpired()
    }
  }

  if (!res.ok) {
    let json: Record<string, unknown> | null = null
    if (raw.trim()) {
      try {
        json = JSON.parse(raw) as Record<string, unknown>
      } catch {
        json = null
      }
    }
    const errorCode = json && typeof json.errorCode === 'string' ? json.errorCode : 'ERROR'
    const message =
      json && typeof json.message === 'string'
        ? json.message
        : raw.trim()
          ? raw.slice(0, 240)
          : res.statusText || 'Request failed'
    throw new ApiError(res.status, errorCode, message)
  }

  if (res.status === 204 || !raw.trim()) {
    return
  }

  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return
  }
  if (json && json.success === true) {
    return
  }
  const errorCode = json && typeof json.errorCode === 'string' ? json.errorCode : 'ERROR'
  const message = json && typeof json.message === 'string' ? json.message : 'Request failed'
  throw new ApiError(res.status, errorCode, message)
}
