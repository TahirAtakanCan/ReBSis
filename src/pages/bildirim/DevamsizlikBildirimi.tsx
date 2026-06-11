import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../lib/auth'
import { smsSend } from '../../lib/bildirim'
import { tarihFormatla } from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'

type Sinif = { id: string; ad: string }

type DevamsizlikKaydi = {
  id: string
  ogrenci_id: string
  tarih: string
  ogrenciler: {
    ad: string
    soyad: string
    veli_ad: string | null
    veli_telefon: string | null
    sinif_id: string | null
  } | null
}

type GonderimDurumu = 'bekliyor' | 'basarili' | 'hata' | null

const VARSAYILAN_SABLON =
  'Sayın [veli_ad], [ogrenci_ad] adlı öğrenciniz [tarih] tarihinde okula devamsızlık yapmıştır. ReBSis'

function bugununTarihi() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchSiniflar() {
  const { data, error } = await supabase.from('siniflar').select('id, ad').order('ad')
  if (error) throw error
  return (data as Sinif[]) ?? []
}

async function fetchDevamsizlikYok(tarih: string) {
  const { data, error } = await supabase
    .from('devamsizlik')
    .select('id, ogrenci_id, tarih, ogrenciler(ad, soyad, veli_ad, veli_telefon, sinif_id)')
    .eq('tarih', tarih)
    .eq('durum', 'yok')

  if (error) throw error
  return (data as unknown as DevamsizlikKaydi[]) ?? []
}

function sablonUygula(
  sablon: string,
  veliAd: string,
  ogrenciAd: string,
  tarih: string
) {
  return sablon
    .replace(/\[veli_ad\]/g, veliAd)
    .replace(/\[ogrenci_ad\]/g, ogrenciAd)
    .replace(/\[tarih\]/g, tarihFormatla(tarih))
}

export default function DevamsizlikBildirimi() {
  const { profile } = useAuth()
  const [tarih, setTarih] = useState(bugununTarihi)
  const [sinifId, setSinifId] = useState('')
  const [sablon, setSablon] = useState(VARSAYILAN_SABLON)
  const [secimler, setSecimler] = useState<Record<string, boolean>>({})
  const [gonderimDurumlari, setGonderimDurumlari] = useState<Record<string, GonderimDurumu>>({})
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [ozet, setOzet] = useState<{ basarili: number; hata: number } | null>(null)

  const { data: siniflar = [] } = useQuery({
    queryKey: ['siniflar'],
    queryFn: fetchSiniflar,
  })

  const { data: kayitlar = [], isLoading } = useQuery({
    queryKey: ['devamsizlik-bildirim', tarih],
    queryFn: () => fetchDevamsizlikYok(tarih),
    enabled: Boolean(tarih),
  })

  const filtrelenmis = useMemo(() => {
    if (!sinifId) return kayitlar
    return kayitlar.filter((k) => k.ogrenciler?.sinif_id === sinifId)
  }, [kayitlar, sinifId])

  useEffect(() => {
    const yeniSecimler: Record<string, boolean> = {}
    for (const kayit of filtrelenmis) {
      const tel = kayit.ogrenciler?.veli_telefon?.trim()
      yeniSecimler[kayit.id] = Boolean(tel)
    }
    setSecimler(yeniSecimler)
    setGonderimDurumlari({})
    setOzet(null)
  }, [filtrelenmis])

  const secimDegistir = (id: string, secili: boolean) => {
    setSecimler((prev) => ({ ...prev, [id]: secili }))
  }

  const smsGonder = async () => {
    if (!profile?.kurum_id) return

    const secilenler = filtrelenmis.filter(
      (k) => secimler[k.id] && k.ogrenciler?.veli_telefon?.trim()
    )

    if (secilenler.length === 0) return

    setGonderiliyor(true)
    setOzet(null)
    let basarili = 0
    let hata = 0

    for (const kayit of secilenler) {
      const ogrenci = kayit.ogrenciler!
      const telefon = ogrenci.veli_telefon!.trim()
      const mesaj = sablonUygula(
        sablon,
        ogrenci.veli_ad?.trim() || 'Veli',
        `${ogrenci.ad} ${ogrenci.soyad}`,
        kayit.tarih
      )

      setGonderimDurumlari((prev) => ({ ...prev, [kayit.id]: 'bekliyor' }))

      const sonuc = await smsSend(profile.kurum_id, telefon, mesaj, {
        ilgili_tip: 'devamsizlik',
        ilgili_id: kayit.id,
      })

      if (sonuc.ok) {
        basarili += 1
        setGonderimDurumlari((prev) => ({ ...prev, [kayit.id]: 'basarili' }))
      } else {
        hata += 1
        setGonderimDurumlari((prev) => ({ ...prev, [kayit.id]: 'hata' }))
      }
    }

    setOzet({ basarili, hata })
    setGonderiliyor(false)
  }

  const seciliSayisi = filtrelenmis.filter(
    (k) => secimler[k.id] && k.ogrenciler?.veli_telefon?.trim()
  ).length

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Devamsızlık Bildirimi</h1>
        <p className="mt-1 text-sm text-slate-600">
          Devamsız öğrencilerin velilerine SMS gönderin.
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Tarih</span>
            <input
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Sınıf</span>
            <select
              value={sinifId}
              onChange={(e) => setSinifId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="">Tüm sınıflar</option>
              {siniflar.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ad}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-slate-700">SMS Şablonu</label>
        <textarea
          rows={3}
          value={sablon}
          onChange={(e) => setSablon(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          Değişkenler: [veli_ad], [ogrenci_ad], [tarih]
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Devamsız Öğrenciler</h2>
          <button
            type="button"
            onClick={() => void smsGonder()}
            disabled={gonderiliyor || seciliSayisi === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {gonderiliyor ? 'Gönderiliyor...' : `Seçilenlere SMS Gönder (${seciliSayisi})`}
          </button>
        </div>

        {ozet && (
          <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {ozet.basarili} başarılı, {ozet.hata} hata
          </p>
        )}

        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          </div>
        )}

        {!isLoading && filtrelenmis.length === 0 && (
          <p className="text-sm text-slate-600">Seçilen tarihte devamsız öğrenci yok.</p>
        )}

        {!isLoading && filtrelenmis.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Seç
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Öğrenci
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Veli Telefonu
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Durum
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtrelenmis.map((kayit) => {
                  const ogrenci = kayit.ogrenciler
                  const telefon = ogrenci?.veli_telefon?.trim()
                  const telefonYok = !telefon
                  const gonderim = gonderimDurumlari[kayit.id]

                  return (
                    <tr key={kayit.id} className={telefonYok ? 'bg-slate-50 opacity-70' : ''}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(secimler[kayit.id])}
                          disabled={telefonYok || gonderiliyor}
                          onChange={(e) => secimDegistir(kayit.id, e.target.checked)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {ogrenci ? `${ogrenci.ad} ${ogrenci.soyad}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {telefonYok ? (
                          <span className="flex items-center gap-1 text-amber-700">
                            <span title="Veli telefonu yok">⚠</span> Telefon yok
                          </span>
                        ) : (
                          telefon
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {gonderim === 'bekliyor' && (
                          <span className="text-slate-500">Gönderiliyor...</span>
                        )}
                        {gonderim === 'basarili' && (
                          <span className="text-emerald-600">✓ Gönderildi</span>
                        )}
                        {gonderim === 'hata' && (
                          <span className="text-red-600">✗ Hata</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
