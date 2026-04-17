import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import ScadaLayout from './layout/ScadaLayout'
import MiniScadaLoginScreen from './pages/MiniScadaLoginScreen'
import MiniScadaDashboardScreen from './pages/MiniScadaDashboardScreen'
import DevicesListPage from './pages/DevicesListPage'
import AlarmsPage from './pages/AlarmsPage'
import MiniScadaRegisterScreen from './pages/MiniScadaRegisterScreen'
import AdminDataPoliciesPage from './pages/admin/AdminDataPoliciesPage'
import AdminDevicesShell from './pages/admin/AdminDevicesShell'
import AdminDeviceListPage from './pages/admin/AdminDeviceListPage'
import AdminDeviceFormPage from './pages/admin/AdminDeviceFormPage'
import AdminDeviceTagsPage from './pages/admin/AdminDeviceTagsPage'
import AdminDeviceConnectionTestPage from './pages/admin/AdminDeviceConnectionTestPage'
import AdminDeviceChangeHistoryPage from './pages/admin/AdminDeviceChangeHistoryPage'
import MiniScadaDeviceDetailScreen from './pages/MiniScadaDeviceDetailScreen'
import ForbiddenPage from './pages/ForbiddenPage'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, ready } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#10161c] text-slate-400">
        Loading…
      </div>
    )
  }
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'ADMIN') {
    return <ForbiddenPage />
  }
  return children
}

function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { token, ready } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] text-slate-400">
        Loading…
      </div>
    )
  }
  if (token) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnlyRoute>
            <MiniScadaLoginScreen />
          </GuestOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnlyRoute>
            <MiniScadaRegisterScreen />
          </GuestOnlyRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ScadaLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<MiniScadaDashboardScreen />} />
        <Route path="devices/:deviceId" element={<MiniScadaDeviceDetailScreen />} />
        <Route path="devices" element={<DevicesListPage />} />
        <Route path="alarms" element={<AlarmsPage />} />
        <Route
          path="admin/devices"
          element={
            <AdminRoute>
              <AdminDevicesShell />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDeviceListPage />} />
          <Route path="new" element={<AdminDeviceFormPage />} />
          <Route path=":deviceId/tags" element={<AdminDeviceTagsPage />} />
          <Route path=":deviceId/history" element={<AdminDeviceChangeHistoryPage />} />
          <Route path=":deviceId/connection-test" element={<AdminDeviceConnectionTestPage />} />
          <Route path=":deviceId/edit" element={<AdminDeviceFormPage />} />
        </Route>
        <Route
          path="admin/policies"
          element={
            <AdminRoute>
              <AdminDataPoliciesPage />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
