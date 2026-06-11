import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RequireYetki from './components/RequireYetki'
import { useAuth } from './lib/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Ogrenciler from './pages/Ogrenciler'
import OgrenciIceAktar from './pages/OgrenciIceAktar'
import OgretmenEkle from './pages/OgretmenEkle'
import Onboarding from './pages/Onboarding'
import Devamsizlik from './pages/Devamsizlik'
import DevamsizlikRapor from './pages/DevamsizlikRapor'
import Siniflar from './pages/Siniflar'
import Signup from './pages/Signup'

function SessionOnlyRoute({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (profile) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/onboarding"
        element={
          <SessionOnlyRoute>
            <Onboarding />
          </SessionOnlyRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/ogretmenler"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi']} gerekenYetki="kullanici_yonet">
              <OgretmenEkle />
            </RequireYetki>
          }
        />
        <Route path="/ogrenciler" element={<Ogrenciler />} />
        <Route
          path="/ogrenci-ice-aktar"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi']} gerekenYetki="ogrenci_yonet">
              <OgrenciIceAktar />
            </RequireYetki>
          }
        />
        <Route path="/siniflar" element={<Siniflar />} />
        <Route
          path="/devamsizlik"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi', 'ogretmen']} gerekenYetki="devamsizlik_yonet">
              <Devamsizlik />
            </RequireYetki>
          }
        />
        <Route path="/devamsizlik-rapor" element={<DevamsizlikRapor />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
