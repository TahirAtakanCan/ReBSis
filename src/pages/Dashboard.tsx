import { useAuth } from '../lib/auth'

export default function Dashboard() {
  const { profile } = useAuth()

  const kurumAdi = profile?.kurum_adi ?? profile?.kurum_id ?? '-'
  const rol = profile?.rol ?? '-'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <div className="mt-3 rounded bg-red-500 p-4 text-white">test</div>
      <p className="mt-2 text-sm text-slate-600">
        Auth + RLS kontrolü için profil bilgileri:
      </p>

      <div className="mt-4 space-y-2 text-sm text-slate-800">
        <p>
          <span className="font-medium">Kurum:</span> {kurumAdi}
        </p>
        <p>
          <span className="font-medium">Rol:</span> {rol}
        </p>
      </div>
    </div>
  )
}
