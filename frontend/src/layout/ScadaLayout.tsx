import type { ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Bell,
  ChevronRight,
  Database,
  LayoutDashboard,
  LogOut,
  Server,
  ShieldCheck,
  User,
  Wifi,
  Wrench,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

function headerCenter(pathname: string): { kicker: string; title: string } {
  if (pathname.startsWith('/dashboard')) {
    return { kicker: 'Dashboard', title: 'Operations Overview' }
  }
  if (pathname.startsWith('/alarms')) {
    return { kicker: 'Alarms', title: 'Alarm History' }
  }
  if (pathname.startsWith('/admin/devices')) {
    return { kicker: 'Admin', title: 'Admin Devices' }
  }
  if (pathname.startsWith('/admin/policies')) {
    return { kicker: 'Admin', title: 'Data Policies' }
  }
  if (pathname === '/devices') {
    return { kicker: 'Devices', title: 'Device List' }
  }
  if (pathname.startsWith('/devices/')) {
    return { kicker: 'Devices', title: 'Device Detail' }
  }
  return { kicker: 'Mini SCADA', title: 'Facility Monitoring' }
}

function navActive(menuPath: string, pathname: string): boolean {
  if (menuPath === '/dashboard') return pathname.startsWith('/dashboard')
  if (menuPath === '/devices') return pathname === '/devices' || pathname.startsWith('/devices/')
  if (menuPath === '/alarms') return pathname.startsWith('/alarms')
  if (menuPath === '/admin/devices') return pathname.startsWith('/admin/devices')
  if (menuPath === '/admin/policies') return pathname.startsWith('/admin/policies')
  return false
}

export default function ScadaLayout({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { kicker, title } = headerCenter(location.pathname)
  const isAdmin = user?.role === 'ADMIN'
  const displayLogin = user?.username ?? user?.name ?? '—'
  const RoleIcon = isAdmin ? ShieldCheck : User

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const now = new Date()
  const timeLabel = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Seoul',
  }).format(now)

  return (
    <div className="h-screen overflow-hidden bg-[#10161c] text-slate-100">
      <BackgroundDecor />

      <div className="relative flex h-full flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#24303a] bg-[#11181f]/96 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center border border-[#315e60] bg-[#173235] text-[#9fd0c4]">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Mini SCADA</div>
              <div className="text-sm font-semibold text-slate-100">Facility Monitoring System</div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.24em] text-[#87b6af]">{kicker}</div>
            <div className="mt-1 text-lg font-semibold text-slate-50">{title}</div>
          </div>

          <div className="flex items-center gap-3">
            <InfoBox>{timeLabel}</InfoBox>

            <InfoBox>
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border ${
                    isAdmin
                      ? 'border-amber-500/50 bg-amber-950/40 text-amber-100'
                      : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-100/95'
                  }`}
                  title={isAdmin ? '관리자 (Admin)' : '운영자 (Operator)'}
                  aria-label={isAdmin ? '관리자' : '운영자'}
                >
                  <RoleIcon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100" title={displayLogin}>
                    {displayLogin}
                  </div>
                  {user?.name && user.name !== displayLogin ? (
                    <div className="truncate text-[11px] text-slate-500" title={user.name}>
                      {user.name}
                    </div>
                  ) : null}
                </div>
              </div>
            </InfoBox>

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-11 min-w-[188px] cursor-pointer items-center border border-[#24303a] bg-[#151d25] px-3 text-sm text-slate-300 transition hover:bg-[#1a232d]"
            >
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Logout
              </div>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <Sidebar isAdmin={isAdmin} pathname={location.pathname} />
          <main className="min-h-0 flex-1 overflow-y-auto p-5">{children ?? <Outlet />}</main>
        </div>
      </div>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-11 min-w-[188px] items-center border border-[#24303a] bg-[#151d25] px-3 text-sm text-slate-300">
      {children}
    </div>
  )
}

function Sidebar({ isAdmin, pathname }: { isAdmin: boolean; pathname: string }) {
  const operatorItems: { to: string; label: string; icon: typeof LayoutDashboard }[] = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/devices', label: 'Devices', icon: Server },
    { to: '/alarms', label: 'Alarms', icon: Bell },
  ]

  const adminItems: { to: string; label: string; icon: typeof Wrench }[] = [
    { to: '/admin/devices', label: 'Admin Devices', icon: Wrench },
    { to: '/admin/policies', label: 'Data Policies', icon: Database },
  ]

  return (
    <aside className="w-[240px] shrink-0 border-r border-[#24303a] bg-[#0d1319] px-4 py-5">
      <div className="flex h-full flex-col">
        <nav className="space-y-2" aria-label="주 메뉴">
          {operatorItems.map((item) => {
            const active = navActive(item.to, pathname)
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex w-full items-center gap-3 border px-4 py-3 text-left text-sm transition ${
                  active
                    ? 'border-[#315e60] bg-[#162328] text-[#c3ddd8]'
                    : 'border-transparent text-slate-300 hover:border-[#24303a] hover:bg-[#141c24] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {active ? <ChevronRight className="h-4 w-4" aria-hidden /> : null}
              </Link>
            )
          })}

          {isAdmin
            ? adminItems.map((item) => {
                const active = navActive(item.to, pathname)
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex w-full items-center gap-3 border px-4 py-3 text-left text-sm transition ${
                      active
                        ? 'border-[#315e60] bg-[#162328] text-[#c3ddd8]'
                        : 'border-transparent text-slate-300 hover:border-[#24303a] hover:bg-[#141c24] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {active ? <ChevronRight className="h-4 w-4" aria-hidden /> : null}
                  </Link>
                )
              })
            : null}
        </nav>

        <div className="mt-5 border border-[#24303a] bg-[#151d25] p-4 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Realtime</div>
          <div className="mt-2 flex items-center gap-2 font-medium text-slate-100">
            <Wifi className="h-4 w-4 text-[#9fd0c4]" aria-hidden />
            Live sync enabled
          </div>
          <div className="mt-1 text-xs text-slate-500">MQTT + DB resync ready</div>
        </div>
      </div>
    </aside>
  )
}

function BackgroundDecor() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(111,156,147,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(116,144,162,0.07),transparent_24%)]" />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
        }}
      />
    </>
  )
}
