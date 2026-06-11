import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RequireYetki from './components/RequireYetki'
import SuperAdminRoute from './components/SuperAdminRoute'
import { useAuth } from './lib/auth'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Ogrenciler from './pages/Ogrenciler'
import OgrenciIceAktar from './pages/OgrenciIceAktar'
import OgretmenEkle from './pages/OgretmenEkle'
import Onboarding from './pages/Onboarding'
import Devamsizlik from './pages/Devamsizlik'
import DevamsizlikRapor from './pages/DevamsizlikRapor'
import GiderListesi from './pages/muhasebe/GiderListesi'
import MuhasebeDashboard from './pages/muhasebe/MuhasebeDashboard'
import SozlesmeDetay from './pages/muhasebe/SozlesmeDetay'
import SozlesmeListesi from './pages/muhasebe/SozlesmeListesi'
import TahsilatGecmisi from './pages/muhasebe/TahsilatGecmisi'
import Siniflar from './pages/Siniflar'
import Signup from './pages/Signup'
import KurumYonetimi from './pages/superadmin/KurumYonetimi'
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminLogin from './pages/superadmin/SuperAdminLogin'
import SuperAdminLog from './pages/superadmin/SuperAdminLog'
import BildirimGecmisi from './pages/bildirim/BildirimGecmisi'
import DevamsizlikBildirimi from './pages/bildirim/DevamsizlikBildirimi'
import OdemeHatirlatma from './pages/bildirim/OdemeHatirlatma'

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
      <Route path="/superadmin/login" element={<SuperAdminLogin />} />

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
        <Route
          path="/muhasebe"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi', 'muhasebeci']} gerekenYetki="muhasebe_yonet">
              <MuhasebeDashboard />
            </RequireYetki>
          }
        />
        <Route
          path="/muhasebe/sozlesmeler"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi', 'muhasebeci']} gerekenYetki="muhasebe_yonet">
              <SozlesmeListesi />
            </RequireYetki>
          }
        />
        <Route
          path="/muhasebe/sozlesmeler/:id"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi', 'muhasebeci']} gerekenYetki="muhasebe_yonet">
              <SozlesmeDetay />
            </RequireYetki>
          }
        />
        <Route
          path="/muhasebe/tahsilatlar"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi', 'muhasebeci']} gerekenYetki="muhasebe_yonet">
              <TahsilatGecmisi />
            </RequireYetki>
          }
        />
        <Route
          path="/muhasebe/giderler"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi', 'muhasebeci']} gerekenYetki="muhasebe_yonet">
              <GiderListesi />
            </RequireYetki>
          }
        />
        <Route
          path="/bildirim/devamsizlik"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi', 'ogretmen']} gerekenYetki="bildirim_gonder">
              <DevamsizlikBildirimi />
            </RequireYetki>
          }
        />
        <Route
          path="/bildirim/odeme-hatirlatma"
          element={
            <RequireYetki gerekenRoller={['kurum_sahibi', 'muhasebeci']} gerekenYetki="bildirim_gonder">
              <OdemeHatirlatma />
            </RequireYetki>
          }
        />
        <Route
          path="/bildirim/gecmis"
          element={
            <RequireYetki
              gerekenRoller={['kurum_sahibi', 'ogretmen', 'muhasebeci']}
              gerekenYetki="bildirim_gonder"
            >
              <BildirimGecmisi />
            </RequireYetki>
          }
        />
      </Route>

      <Route
        path="/superadmin"
        element={
          <SuperAdminRoute>
            <SuperAdminLayout />
          </SuperAdminRoute>
        }
      >
        <Route index element={<KurumYonetimi />} />
        <Route path="kurumlar" element={<KurumYonetimi />} />
        <Route path="log" element={<SuperAdminLog />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
