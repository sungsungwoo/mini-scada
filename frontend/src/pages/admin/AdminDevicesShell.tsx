import { Outlet } from 'react-router-dom'

export default function AdminDevicesShell() {
  return (
    <div className="min-h-0 w-full text-slate-200">
      <Outlet />
    </div>
  )
}
