import { type FormEvent, type ReactNode, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Check, Lock, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export default function MiniScadaLoginScreen() {
  const { login, error, clearError } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const userId = useId()
  const passId = useId()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setSubmitting(true)
    try {
      await login(username.trim(), password, rememberMe)
      navigate('/dashboard', { replace: true })
    } catch {
      /* error shown via context */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.14),_transparent_24%),linear-gradient(135deg,_#0f172a_0%,_#12324a_42%,_#0f766e_100%)] text-white">
      <ContourLines />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-xs tracking-[0.22em] text-white/75 uppercase backdrop-blur-sm">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              Smart Monitoring Platform
            </div>
            <h1 className="text-2xl font-semibold tracking-wide text-white">
              Mini SCADA for Facility Monitoring
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Monitor devices, alarms, and plant signals in one place.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/12 bg-slate-950/22 px-8 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-md">
            <h2 className="mb-6 text-center text-3xl font-light tracking-[0.08em] text-white/95">Sign In</h2>

            {error ? (
              <div
                className="mb-4 rounded-lg border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <InputField
                id={userId}
                name="username"
                autoComplete="username"
                icon={<User className="h-4 w-4" aria-hidden />}
                label="ID"
                placeholder="username"
                type="text"
                value={username}
                onChange={setUsername}
                required
              />
              <InputField
                id={passId}
                name="password"
                autoComplete="current-password"
                icon={<Lock className="h-4 w-4" aria-hidden />}
                label="Password"
                placeholder="Password"
                type="password"
                value={password}
                onChange={setPassword}
                required
              />

              <div className="flex items-center justify-between pt-1 text-xs text-white/75">
                <button
                  type="button"
                  onClick={() => setRememberMe((prev) => !prev)}
                  className="flex items-center gap-2 transition hover:text-white"
                  aria-pressed={rememberMe}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-sm border border-emerald-200/60 ${
                      rememberMe ? 'bg-emerald-300/20' : 'bg-transparent'
                    }`}
                  >
                    {rememberMe && <Check className="h-3 w-3 text-emerald-100" aria-hidden />}
                  </span>
                  Remember Me
                </button>

                <span className="text-cyan-100/70">
                  비밀번호 찾기 <span className="text-white/50">(예정)</span>
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-3 w-full rounded-full bg-gradient-to-r from-emerald-300/90 to-cyan-200/90 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:scale-[1.01] hover:from-emerald-200 hover:to-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Login'}
              </button>

              <p className="pt-3 text-center text-sm text-white/70">
                계정이 없나요?{' '}
                <Link to="/register" className="text-cyan-100/90 underline hover:text-white">
                  회원가입
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

type InputFieldProps = {
  id: string
  name: string
  icon: ReactNode
  label: string
  placeholder: string
  type: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  autoComplete?: string
}

function InputField({
  id,
  name,
  icon,
  label,
  placeholder,
  type,
  value,
  onChange,
  required,
  autoComplete,
}: InputFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-white/80">
        {label}
      </label>
      <div className="flex h-11 items-center gap-3 rounded-xl border border-white/12 bg-white/8 px-3.5 text-sm shadow-inner shadow-black/10 backdrop-blur-sm transition focus-within:border-emerald-200/50 focus-within:bg-white/12">
        <span className="text-cyan-50/75">{icon}</span>
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-white placeholder:text-white/55 focus:outline-none"
        />
      </div>
    </div>
  )
}

function ContourLines() {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="contourA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#99f6e4" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="contourB" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.16" />
            <stop offset="100%" stopColor="white" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {Array.from({ length: 9 }).map((_, idx) => (
          <path
            key={`left-${idx}`}
            d={`M ${-120 + idx * 24} ${260 - idx * 14}
                C ${120 + idx * 18} ${80 - idx * 4}, ${340 + idx * 28} ${130 + idx * 10}, ${470 + idx * 30} ${40 + idx * 16}
                S ${760 + idx * 20} ${120 + idx * 14}, ${940 + idx * 18} ${70 + idx * 18}`}
            stroke="url(#contourA)"
            strokeWidth="1.15"
            strokeDasharray={idx % 2 === 0 ? '0 0' : '6 8'}
            fill="none"
          />
        ))}

        {Array.from({ length: 10 }).map((_, idx) => (
          <path
            key={`right-${idx}`}
            d={`M ${860 - idx * 30} ${980 - idx * 28}
                C ${1040 - idx * 12} ${760 - idx * 18}, ${1260 - idx * 22} ${720 - idx * 10}, ${1440 + idx * 30} ${520 - idx * 24}`}
            stroke="url(#contourB)"
            strokeWidth="1.1"
            strokeDasharray={idx % 3 === 0 ? '10 9' : '0 0'}
            fill="none"
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute -left-28 top-24 h-[320px] w-[320px] rounded-full border border-white/8" />
      <div className="pointer-events-none absolute -left-16 top-12 h-[420px] w-[420px] rounded-full border border-white/6" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-[300px] w-[300px] rounded-full border border-amber-100/10" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-[420px] w-[420px] rounded-full border border-white/6" />
      <div className="pointer-events-none absolute left-[-100px] top-[-60px] h-[280px] w-[280px] rounded-full bg-teal-300/8 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-80px] right-[-40px] h-[260px] w-[260px] rounded-full bg-amber-200/10 blur-3xl" />
    </>
  )
}
