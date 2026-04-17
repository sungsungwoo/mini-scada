import { type FormEvent, type ReactNode, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Check, Lock, Mail, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export default function MiniScadaRegisterScreen() {
  const { register, error, clearError } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const userId = useId()
  const passId = useId()
  const pass2Id = useId()
  const nameId = useId()
  const emailId = useId()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    clearError()
    setLocalError(null)
    if (password !== password2) {
      setLocalError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      setLocalError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    setSubmitting(true)
    try {
      await register(
        username.trim(),
        password,
        name.trim() || undefined,
        email.trim() || undefined,
        rememberMe,
      )
      navigate('/dashboard', { replace: true })
    } catch {
      /* context error */
    } finally {
      setSubmitting(false)
    }
  }

  const displayError = localError ?? error

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.14),_transparent_24%),linear-gradient(135deg,_#0f172a_0%,_#12324a_42%,_#0f766e_100%)] text-white">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-xs tracking-[0.22em] text-white/75 uppercase backdrop-blur-sm">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              New account
            </div>
            <h1 className="text-2xl font-semibold tracking-wide text-white">회원가입</h1>
            <p className="mt-2 text-sm text-white/70">가입 시 역할은 <strong className="text-emerald-200/90">Operator</strong>로 부여됩니다.</p>
          </div>

          <div className="rounded-[28px] border border-white/12 bg-slate-950/22 px-8 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-md">
            <h2 className="mb-6 text-center text-2xl font-light tracking-[0.08em] text-white/95">Register</h2>

            {displayError ? (
              <div
                className="mb-4 rounded-lg border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100"
                role="alert"
              >
                {displayError}
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
                minLength={3}
              />
              <InputField
                id={nameId}
                name="name"
                autoComplete="name"
                icon={<User className="h-4 w-4" aria-hidden />}
                label="이름 (선택)"
                placeholder="표시 이름"
                type="text"
                value={name}
                onChange={setName}
              />
              <InputField
                id={emailId}
                name="email"
                autoComplete="email"
                icon={<Mail className="h-4 w-4" aria-hidden />}
                label="이메일 (선택)"
                placeholder="you@example.com"
                type="text"
                value={email}
                onChange={setEmail}
              />
              <InputField
                id={passId}
                name="new-password"
                autoComplete="new-password"
                icon={<Lock className="h-4 w-4" aria-hidden />}
                label="Password"
                placeholder="8자 이상"
                type="password"
                value={password}
                onChange={setPassword}
                required
                minLength={8}
              />
              <InputField
                id={pass2Id}
                name="confirm-password"
                autoComplete="new-password"
                icon={<Lock className="h-4 w-4" aria-hidden />}
                label="Password 확인"
                placeholder="비밀번호 재입력"
                type="password"
                value={password2}
                onChange={setPassword2}
                required
                minLength={8}
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
                    {rememberMe ? <Check className="h-3 w-3 text-emerald-100" aria-hidden /> : null}
                  </span>
                  Remember Me
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-3 w-full rounded-full bg-gradient-to-r from-emerald-300/90 to-cyan-200/90 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:scale-[1.01] hover:from-emerald-200 hover:to-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '가입 중…' : '가입하기'}
              </button>

              <p className="pt-2 text-center text-sm text-white/70">
                이미 계정이 있나요?{' '}
                <Link to="/login" className="text-cyan-100/90 underline hover:text-white">
                  로그인
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
  label: string
  placeholder: string
  type: string
  value: string
  onChange: (v: string) => void
  icon: ReactNode
  required?: boolean
  minLength?: number
  autoComplete?: string
}

function InputField({
  id,
  name,
  label,
  placeholder,
  type,
  value,
  onChange,
  required,
  minLength,
  autoComplete,
  icon,
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
          minLength={minLength}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-white placeholder:text-white/55 focus:outline-none"
        />
      </div>
    </div>
  )
}
