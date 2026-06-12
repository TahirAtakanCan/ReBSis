import { useMemo } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import AbonelikKoruma from './AbonelikKoruma'
import { kullaniciYetkiliMi, useAuth } from '../lib/auth'

type MenuItem = {
  to: string
  label: string
  gerekenRoller?: string[]
  gerekenYetki?: string
  end?: boolean
}

type MenuSection = {
  title?: string
  items: MenuItem[]
}

const MUHASEBE_YETKI = {
  gerekenRoller: ['kurum_sahibi', 'muhasebeci'] as string[],
  gerekenYetki: 'muhasebe_yonet',
}

const BILDIRIM_DEVAMSIZLIK_YETKI = {
  gerekenRoller: ['kurum_sahibi', 'ogretmen'] as string[],
  gerekenYetki: 'bildirim_gonder',
}

const BILDIRIM_ODEME_YETKI = {
  gerekenRoller: ['kurum_sahibi', 'muhasebeci'] as string[],
  gerekenYetki: 'bildirim_gonder',
}

const BILDIRIM_GECMIS_YETKI = {
  gerekenRoller: ['kurum_sahibi', 'ogretmen', 'muhasebeci'] as string[],
  gerekenYetki: 'bildirim_gonder',
}

const menuSections: MenuSection[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', gerekenRoller: ['kurum_sahibi', 'yonetici', 'ogretmen'], end: true },
      {
        to: '/ogretmenler',
        label: 'Öğretmenler',
        gerekenRoller: ['kurum_sahibi'],
        gerekenYetki: 'kullanici_yonet',
      },
      {
        to: '/ogrenci-ice-aktar',
        label: 'Öğrenci İçe Aktar',
        gerekenRoller: ['kurum_sahibi'],
        gerekenYetki: 'ogrenci_yonet',
      },
      { to: '/ogrenciler', label: 'Öğrenciler', gerekenRoller: ['kurum_sahibi', 'yonetici', 'ogretmen'] },
      { to: '/siniflar', label: 'Sınıflar', gerekenRoller: ['kurum_sahibi', 'yonetici', 'ogretmen'] },
      {
        to: '/devamsizlik',
        label: 'Devamsızlık',
        gerekenRoller: ['kurum_sahibi', 'ogretmen'],
        gerekenYetki: 'devamsizlik_yonet',
      },
      {
        to: '/devamsizlik-rapor',
        label: 'Devamsızlık Raporu',
        gerekenRoller: ['kurum_sahibi', 'yonetici', 'ogretmen'],
      },
    ],
  },
  {
    title: 'Muhasebe',
    items: [
      { to: '/muhasebe', label: 'Özet', ...MUHASEBE_YETKI, end: true },
      { to: '/muhasebe/sozlesmeler', label: 'Sözleşmeler', ...MUHASEBE_YETKI },
      { to: '/muhasebe/tahsilatlar', label: 'Tahsilat Geçmişi', ...MUHASEBE_YETKI },
      { to: '/muhasebe/giderler', label: 'Giderler', ...MUHASEBE_YETKI },
    ],
  },
  {
    title: 'Bildirimler',
    items: [
      { to: '/bildirim/devamsizlik', label: 'Devamsızlık Bildirimi', ...BILDIRIM_DEVAMSIZLIK_YETKI },
      { to: '/bildirim/odeme-hatirlatma', label: 'Ödeme Hatırlatma', ...BILDIRIM_ODEME_YETKI },
      { to: '/bildirim/gecmis', label: 'Bildirim Geçmişi', ...BILDIRIM_GECMIS_YETKI },
    ],
  },
]

function getDisplayName(ad: string | null, soyad: string | null, fallback: string) {
  const fullName = [ad, soyad].filter(Boolean).join(' ').trim()
  return fullName || fallback
}

export default function Layout() {
  const { profile, kurumAd, user, signOut } = useAuth()

  const visibleSections = useMemo(
    () =>
      menuSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            kullaniciYetkiliMi(profile, {
              gerekenRoller: item.gerekenRoller,
              gerekenYetki: item.gerekenYetki,
            }),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [profile],
  )

  const kullaniciAdi = getDisplayName(profile?.ad ?? null, profile?.soyad ?? null, user?.email ?? 'Kullanıcı')
  const kurumAdi = kurumAd || 'Kurum'

  return (
    <AbonelikKoruma>
    <div className="flex min-h-screen bg-slate-100">
      <aside className="w-64 border-r border-slate-200 bg-white p-4">
        <h1 className="mb-6 text-lg font-semibold text-slate-900">ReBSis</h1>
        <nav className="space-y-4">
          {visibleSections.map((section) => (
            <div key={section.title ?? 'main'}>
              {section.title && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
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
    </AbonelikKoruma>
  )
}
