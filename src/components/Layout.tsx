import { NavLink, Outlet } from 'react-router-dom'

import { kullaniciYetkiliMi, useAuth } from '../lib/auth'

type MenuItem = {
  to: string
  label: string
  gerekenRoller?: string[]
  gerekenYetki?: string
}

const menuItems: MenuItem[] = [
  { to: '/', label: 'Dashboard', gerekenRoller: ['kurum_sahibi', 'yonetici', 'ogretmen'] },
  {
    to: '/ogretmenler',
    label: 'Öğretmenler',
    gerekenRoller: ['kurum_sahibi'],
    gerekenYetki: 'kullanici_yonet',
  },
  { to: '/ogrenciler', label: 'Öğrenciler', gerekenRoller: ['kurum_sahibi', 'yonetici', 'ogretmen'] },
  { to: '/siniflar', label: 'Sınıflar', gerekenRoller: ['kurum_sahibi', 'yonetici', 'ogretmen'] },
]

function getDisplayName(ad: string | null, soyad: string | null, fallback: string) {
  const fullName = [ad, soyad].filter(Boolean).join(' ').trim()
  return fullName || fallback
}

export default function Layout() {
  const { profile, user, signOut } = useAuth()

  const visibleMenu = menuItems.filter((item) =>
    kullaniciYetkiliMi(profile, { gerekenRoller: item.gerekenRoller, gerekenYetki: item.gerekenYetki })
  )
  const kullaniciAdi = getDisplayName(profile?.ad ?? null, profile?.soyad ?? null, user?.email ?? 'Kullanıcı')
  const kurumAdi = profile?.kurum_adi ?? profile?.kurum_id ?? 'Kurum'

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-64 border-r border-slate-200 bg-white p-4">
        <h1 className="mb-6 text-lg font-semibold text-slate-900">ReBSis</h1>
        <nav className="space-y-2">
          {visibleMenu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Kurum</p>
            <p className="text-sm font-semibold text-slate-900">{kurumAdi}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{kullaniciAdi}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Çıkış
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
