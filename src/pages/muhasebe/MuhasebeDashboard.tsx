import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../lib/auth'
import { EMPTY_ARRAY } from '../../lib/constants'
import {
  AY_ADLARI,
  bugununTarihi,
  donemAraligi,
  GIDER_KATEGORI_ETIKET,
  paraFormatla,
  tarihFormatla,
  taksitBorcu,
} from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'
import type { Gider } from '../../lib/types'

type TahsilatOzet = { tutar: number; odeme_tarihi: string }
type GiderOzet = { tutar: number; tarih: string }

type GecikenTaksit = {
  tutar: number
  gecikme_ucreti: number
  sozlesmeler: {
    ogrenciler: { ad: string; soyad: string } | null
  } | null
}

type SonTahsilat = {
  id: string
  tutar: number
  odeme_tarihi: string
  taksitler: {
    sozlesmeler: {
      ogrenciler: { ad: string; soyad: string } | null
    } | null
  } | null
}

async function guncelleGecikenTaksitler(kurumId: string, bugun: string) {
  const { error } = await supabase
    .from('taksitler')
    .update({ durum: 'gecikti' })
    .eq('kurum_id', kurumId)
    .eq('durum', 'bekliyor')
    .lt('vade_tarihi', bugun)

  if (error) throw error
}

async function fetchDashboardVerileri(
  kurumId: string,
  donemBaslangic: string,
  donemBitis: string,
  bugun: string
) {
  await guncelleGecikenTaksitler(kurumId, bugun)

  const [tahsilatRes, giderRes, gecikenRes, sonTahsilatRes, sonGiderRes] = await Promise.all([
    supabase
      .from('tahsilatlar')
      .select('tutar, odeme_tarihi')
      .eq('kurum_id', kurumId)
      .gte('odeme_tarihi', donemBaslangic)
      .lte('odeme_tarihi', donemBitis),
    supabase
      .from('giderler')
      .select('tutar, tarih')
      .eq('kurum_id', kurumId)
      .gte('tarih', donemBaslangic)
      .lte('tarih', donemBitis),
    supabase
      .from('taksitler')
      .select('tutar, gecikme_ucreti, sozlesmeler(ogrenciler(ad, soyad))')
      .eq('kurum_id', kurumId)
      .eq('durum', 'gecikti'),
    supabase
      .from('tahsilatlar')
      .select('id, tutar, odeme_tarihi, taksitler(sozlesmeler(ogrenciler(ad, soyad)))')
      .eq('kurum_id', kurumId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('giderler')
      .select('*')
      .eq('kurum_id', kurumId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (tahsilatRes.error) throw tahsilatRes.error
  if (giderRes.error) throw giderRes.error
  if (gecikenRes.error) throw gecikenRes.error
  if (sonTahsilatRes.error) throw sonTahsilatRes.error
  if (sonGiderRes.error) throw sonGiderRes.error

  return {
    tahsilatlar: (tahsilatRes.data as TahsilatOzet[]) ?? [],
    giderler: (giderRes.data as GiderOzet[]) ?? [],
    gecikenTaksitler: (gecikenRes.data as unknown as GecikenTaksit[]) ?? [],
    sonTahsilatlar: (sonTahsilatRes.data as unknown as SonTahsilat[]) ?? [],
    sonGiderler: (sonGiderRes.data as Gider[]) ?? [],
  }
}

const simdikiYil = new Date().getFullYear()
const YILLAR = Array.from({ length: 5 }, (_, i) => simdikiYil - 2 + i)

function OzetKart({
  baslik,
  tutar,
  adet,
  altMetin,
  renk = 'slate',
}: {
  baslik: string
  tutar?: string
  adet?: number
  altMetin?: string
  renk?: 'slate' | 'emerald' | 'red' | 'amber'
}) {
  const renkSiniflari = {
    slate: 'border-slate-200 bg-white',
    emerald: 'border-emerald-200 bg-emerald-50',
    red: 'border-red-200 bg-red-50',
    amber: 'border-amber-200 bg-amber-50',
  }

  return (
    <div className={`rounded-xl border p-5 shadow-sm ${renkSiniflari[renk]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{baslik}</p>
      {tutar && <p className="mt-2 text-2xl font-semibold text-slate-900">{tutar}</p>}
      {adet !== undefined && (
        <p className="mt-1 text-sm text-slate-600">
          {adet} kayıt{altMetin ? ` · ${altMetin}` : ''}
        </p>
      )}
    </div>
  )
}

export default function MuhasebeDashboard() {
  const { profile } = useAuth()
  const [filtreAy, setFiltreAy] = useState(new Date().getMonth() + 1)
  const [filtreYil, setFiltreYil] = useState(simdikiYil)

  const { baslangic: donemBaslangic, bitis: donemBitis } = useMemo(
    () => donemAraligi(filtreYil, filtreAy),
    [filtreYil, filtreAy]
  )

  const bugun = useMemo(() => bugununTarihi(), [])

  const { data, isLoading, error } = useQuery({
    queryKey: ['muhasebe-dashboard', profile?.kurum_id, donemBaslangic, donemBitis, bugun],
    queryFn: () => fetchDashboardVerileri(profile!.kurum_id!, donemBaslangic, donemBitis, bugun),
    enabled: Boolean(profile?.kurum_id),
  })

  const tahsilatlar = data?.tahsilatlar ?? EMPTY_ARRAY
  const giderler = data?.giderler ?? EMPTY_ARRAY
  const gecikenTaksitler = data?.gecikenTaksitler ?? EMPTY_ARRAY

  const toplamTahsilat = useMemo(
    () => tahsilatlar.reduce((acc, t) => acc + Number(t.tutar), 0),
    [tahsilatlar],
  )

  const toplamGider = useMemo(
    () => giderler.reduce((acc, g) => acc + Number(g.tutar), 0),
    [giderler],
  )

  const netBakiye = Math.round((toplamTahsilat - toplamGider) * 100) / 100

  const gecikenToplam = useMemo(
    () => gecikenTaksitler.reduce((acc, t) => acc + taksitBorcu(t), 0),
    [gecikenTaksitler],
  )

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Muhasebe Özeti</h1>
            <p className="mt-1 text-sm text-slate-600">Dönemsel finansal durum.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={filtreAy}
              onChange={(e) => setFiltreAy(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              {AY_ADLARI.map((ad, i) => (
                <option key={ad} value={i + 1}>
                  {ad}
                </option>
              ))}
            </select>
            <select
              value={filtreYil}
              onChange={(e) => setFiltreYil(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              {YILLAR.map((yil) => (
                <option key={yil} value={yil}>
                  {yil}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error instanceof Error ? error.message : 'Özet yüklenemedi.'}
        </p>
      )}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OzetKart
              baslik="Toplam Tahsilat"
              tutar={paraFormatla(toplamTahsilat)}
              adet={tahsilatlar.length}
              renk="emerald"
            />
            <OzetKart
              baslik="Toplam Gider"
              tutar={paraFormatla(toplamGider)}
              adet={giderler.length}
            />
            <OzetKart
              baslik="Net Bakiye"
              tutar={paraFormatla(netBakiye)}
              renk={netBakiye >= 0 ? 'emerald' : 'red'}
            />
            <OzetKart
              baslik="Geciken Taksitler"
              tutar={paraFormatla(gecikenToplam)}
              adet={gecikenTaksitler.length}
              altMetin="vadesi geçmiş"
              renk="red"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Son Tahsilatlar</h2>
                <Link
                  to="/muhasebe/tahsilatlar"
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Tümünü Gör →
                </Link>
              </div>

              {data.sonTahsilatlar.length === 0 ? (
                <p className="text-sm text-slate-600">Henüz tahsilat yok.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {data.sonTahsilatlar.map((t) => {
                    const ogrenci = t.taksitler?.sozlesmeler?.ogrenciler
                    return (
                      <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">
                            {ogrenci ? `${ogrenci.ad} ${ogrenci.soyad}` : '—'}
                          </p>
                          <p className="text-slate-500">{tarihFormatla(t.odeme_tarihi)}</p>
                        </div>
                        <span className="font-semibold text-emerald-700">{paraFormatla(t.tutar)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Son Giderler</h2>
                <Link
                  to="/muhasebe/giderler"
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Tümünü Gör →
                </Link>
              </div>

              {data.sonGiderler.length === 0 ? (
                <p className="text-sm text-slate-600">Henüz gider yok.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {data.sonGiderler.map((g) => (
                    <li key={g.id} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">
                          {GIDER_KATEGORI_ETIKET[g.kategori] ?? g.kategori}
                        </p>
                        <p className="text-slate-500">
                          {tarihFormatla(g.tarih)}
                          {g.aciklama ? ` · ${g.aciklama}` : ''}
                        </p>
                      </div>
                      <span className="font-semibold text-slate-900">{paraFormatla(g.tutar)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
