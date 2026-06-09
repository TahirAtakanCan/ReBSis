import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RequireYetki from './components/RequireYetki'
import { useAuth } from './lib/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Ogrenciler from './pages/Ogrenciler'
import OgretmenEkle from './pages/OgretmenEkle'
import Onboarding from './pages/Onboarding'
import Siniflar from './pages/Siniflar'
import Signup from './pages/Signup'

function SessionOnlyRoute({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth()

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
        <Route path="/siniflar" element={<Siniflar />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
