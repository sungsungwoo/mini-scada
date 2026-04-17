import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ApiError,
  apiPost,
  clearAuth,
  getStoredToken,
  getStoredUser,
  parseJwtExpiresAtMs,
  SESSION_EXPIRED_EVENT,
  setAuthSession,
  type StoredUser,
} from '../lib/api'

type AuthState = {
  user: StoredUser | null
  token: string | null
  ready: boolean
}

type AuthContextValue = AuthState & {
  login: (username: string, password: string, remember: boolean) => Promise<void>
  register: (
    username: string,
    password: string,
    name: string | undefined,
    email: string | undefined,
    remember: boolean,
  ) => Promise<void>
  logout: () => Promise<void>
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

type LoginEnvelope = {
  user: StoredUser
  accessToken: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const sessionModalTitleId = useId()
  const [user, setUser] = useState<StoredUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false)

  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      setToken(null)
      setSessionExpiredOpen(true)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  useEffect(() => {
    const t = getStoredToken()
    const u = getStoredUser()
    if (t && u) {
      const expMs = parseJwtExpiresAtMs(t)
      if (expMs != null && expMs <= Date.now()) {
        clearAuth()
        setSessionExpiredOpen(true)
        setReady(true)
        return
      }
      setToken(t)
      setUser(u)
    }
    setReady(true)
  }, [])

  /** JWT 만료 시각에 맞춰 백그라운드에서 만료 처리 (탭이 열린 채로 만료되는 경우). */
  useEffect(() => {
    if (!token) return
    const expMs = parseJwtExpiresAtMs(token)
    if (expMs == null) return
    const delay = expMs - Date.now()
    if (delay <= 0) {
      clearAuth()
      setUser(null)
      setToken(null)
      setSessionExpiredOpen(true)
      return
    }
    const id = window.setTimeout(() => {
      clearAuth()
      setUser(null)
      setToken(null)
      setSessionExpiredOpen(true)
    }, delay)
    return () => window.clearTimeout(id)
  }, [token])

  const register = useCallback(
    async (
      username: string,
      password: string,
      name: string | undefined,
      email: string | undefined,
      remember: boolean,
    ) => {
      setError(null)
      try {
        const data = await apiPost<LoginEnvelope>('/api/v1/auth/register', {
          username: username.trim(),
          password,
          name: name?.trim() || undefined,
          email: email?.trim() || undefined,
        })
        setAuthSession(data.accessToken, data.user, remember)
        setToken(data.accessToken)
        setUser(data.user)
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Registration failed'
        setError(msg)
        throw e
      }
    },
    [],
  )

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    setError(null)
    try {
      const data = await apiPost<LoginEnvelope>('/api/v1/auth/login', {
        username,
        password,
      })
      setAuthSession(data.accessToken, data.user, remember)
      setToken(data.accessToken)
      setUser(data.user)
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Login failed'
      setError(msg)
      throw e
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/v1/auth/logout')
    } catch {
      /* ignore */
    }
    clearAuth()
    setToken(null)
    setUser(null)
    setSessionExpiredOpen(false)
  }, [])

  const closeSessionExpiredModal = useCallback(() => {
    setSessionExpiredOpen(false)
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!sessionExpiredOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSessionExpiredModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sessionExpiredOpen, closeSessionExpiredModal])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo(
    () =>
      ({
        user,
        token,
        ready,
        login,
        register,
        logout,
        error,
        clearError,
      }) satisfies AuthContextValue,
    [user, token, ready, login, register, logout, error, clearError],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {sessionExpiredOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={closeSessionExpiredModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={sessionModalTitleId}
            className="w-full max-w-md border border-[#24303a] bg-[#11181f] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#24303a] px-4 py-3">
              <h2 id={sessionModalTitleId} className="text-base font-semibold text-slate-50">
                세션 만료
              </h2>
            </div>
            <div className="px-4 py-3 text-sm leading-relaxed text-slate-300">
              로그인 세션이 만료되었거나 더 이상 유효하지 않습니다. 확인을 누르면 로그인 화면으로 이동합니다.
            </div>
            <div className="flex justify-end border-t border-[#24303a] px-4 py-3">
              <button
                type="button"
                onClick={closeSessionExpiredModal}
                className="border border-[#315463] bg-[#16252f] px-4 py-2 text-sm text-[#b8d2da] hover:bg-[#1b2c37]"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
