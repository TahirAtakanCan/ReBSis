import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../lib/auth'
import { EMPTY_ARRAY } from '../../lib/constants'
import { smsSend } from '../../lib/bildirim'
import { bugununTarihi, paraFormatla, tarihFormatla } from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'

type GecikenTaksit = {
  id: string
  taksit_no: number
  tutar: number
  vade_tarihi: string
  sozlesmeler: {
    donem: string
    ogrenciler: {
      ad: string
      soyad: string
      veli_telefon: string | null
    } | null
  } | null
}

type GonderimDurumu = 'bekliyor' | 'basarili' | 'hata' | null

const VARSAYILAN_SABLON =
  'Sayın veli, [ogrenci_ad] adlı öğrencinizin [tutar] TL tutarındaki [taksit_no]. taksit ödemesi [vade_tarihi] tarihinde geçmiştir. Lütfen ödeyiniz. ReBSis'

async function fetchGecikenTaksitler(bugun: string) {
  const { data, error } = await supabase
    .from('taksitler')
    .select('id, taksit_no, tutar, vade_tarihi, sozlesmeler(donem, ogrenciler(ad, soyad, veli_telefon))')
    .in('durum', ['bekliyor', 'gecikti', 'kismi'])
    .lt('vade_tarihi', bugun)
    .order('vade_tarihi')

  if (error) throw error
  return (data as unknown as GecikenTaksit[]) ?? []
}

function sablonUygula(
  sablon: string,
  ogrenciAd: string,
  tutar: number,
  taksitNo: number,
  vadeTarihi: string
) {
  return sablon
    .replace(/\[ogrenci_ad\]/g, ogrenciAd)
    .replace(/\[tutar\]/g, tutar.toFixed(2))
    .replace(/\[taksit_no\]/g, String(taksitNo))
    .replace(/\[vade_tarihi\]/g, tarihFormatla(vadeTarihi))
}

export default function OdemeHatirlatma() {
  const { profile } = useAuth()
  const bugun = bugununTarihi()
  const [sablon, setSablon] = useState(VARSAYILAN_SABLON)
  const [secimler, setSecimler] = useState<Record<string, boolean>>({})
  const [gonderimDurumlari, setGonderimDurumlari] = useState<Record<string, GonderimDurumu>>({})
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [ozet, setOzet] = useState<{ basarili: number; hata: number } | null>(null)

  const { data: taksitlerData, isLoading } = useQuery({
    queryKey: ['geciken-taksitler-bildirim', bugun],
    queryFn: () => fetchGecikenTaksitler(bugun),
  })
  const taksitler = taksitlerData ?? EMPTY_ARRAY

  const listeAnahtari = useMemo(
    () => `${bugun}|${taksitler.map((t) => t.id).join(',')}`,
    [bugun, taksitler],
  )

  const senkronAnahtarRef = useRef('')

  useEffect(() => {
    if (senkronAnahtarRef.current === listeAnahtari) return
    senkronAnahtarRef.current = listeAnahtari

    const yeniSecimler: Record<string, boolean> = {}
    for (const t of taksitler) {
      const tel = t.sozlesmeler?.ogrenciler?.veli_telefon?.trim()
      yeniSecimler[t.id] = Boolean(tel)
    }
    setSecimler(yeniSecimler)
    setGonderimDurumlari({})
    setOzet(null)
  }, [listeAnahtari, taksitler])

  const secimDegistir = (id: string, secili: boolean) => {
    setSecimler((prev) => ({ ...prev, [id]: secili }))
  }

  const smsGonder = async () => {
    if (!profile?.kurum_id) return

    const secilenler = taksitler.filter(
      (t) => secimler[t.id] && t.sozlesmeler?.ogrenciler?.veli_telefon?.trim()
    )

    if (secilenler.length === 0) return

    setGonderiliyor(true)
    setOzet(null)
    let basarili = 0
    let hata = 0

    for (const taksit of secilenler) {
      const ogrenci = taksit.sozlesmeler!.ogrenciler!
      const telefon = ogrenci.veli_telefon!.trim()
      const mesaj = sablonUygula(
        sablon,
        `${ogrenci.ad} ${ogrenci.soyad}`,
        taksit.tutar,
        taksit.taksit_no,
        taksit.vade_tarihi
      )

      setGonderimDurumlari((prev) => ({ ...prev, [taksit.id]: 'bekliyor' }))

      const sonuc = await smsSend(profile.kurum_id, telefon, mesaj, {
        ilgili_tip: 'taksit',
        ilgili_id: taksit.id,
      })

      if (sonuc.ok) {
        basarili += 1
        setGonderimDurumlari((prev) => ({ ...prev, [taksit.id]: 'basarili' }))
      } else {
        hata += 1
        setGonderimDurumlari((prev) => ({ ...prev, [taksit.id]: 'hata' }))
      }
    }

    setOzet({ basarili, hata })
    setGonderiliyor(false)
  }

  const seciliSayisi = useMemo(
    () =>
      taksitler.filter(
        (t) => secimler[t.id] && t.sozlesmeler?.ogrenciler?.veli_telefon?.trim()
      ).length,
    [taksitler, secimler]
  )

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Ödeme Hatırlatma</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vadesi geçmiş taksitler için velilere SMS hatırlatması gönderin.
        </p>
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
          Değişkenler: [ogrenci_ad], [tutar], [taksit_no], [vade_tarihi]
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Geciken Taksitler</h2>
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

        {!isLoading && taksitler.length === 0 && (
          <p className="text-sm text-slate-600">Geciken taksit bulunamadı.</p>
        )}

        {!isLoading && taksitler.length > 0 && (
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
                    Dönem
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                    Taksit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                    Tutar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Vade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Veli Tel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Durum
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {taksitler.map((taksit) => {
                  const ogrenci = taksit.sozlesmeler?.ogrenciler
                  const telefon = ogrenci?.veli_telefon?.trim()
                  const telefonYok = !telefon
                  const gonderim = gonderimDurumlari[taksit.id]

                  return (
                    <tr key={taksit.id} className={telefonYok ? 'bg-slate-50 opacity-70' : ''}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(secimler[taksit.id])}
                          disabled={telefonYok || gonderiliyor}
                          onChange={(e) => secimDegistir(taksit.id, e.target.checked)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                        {ogrenci ? `${ogrenci.ad} ${ogrenci.soyad}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {taksit.sozlesmeler?.donem ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">
                        #{taksit.taksit_no}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-900">
                        {paraFormatla(taksit.tutar)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-red-700">
                        {tarihFormatla(taksit.vade_tarihi)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {telefonYok ? (
                          <span className="flex items-center gap-1 text-amber-700">
                            <span title="Veli telefonu yok">⚠</span> Telefon yok
                          </span>
                        ) : (
                          telefon
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
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
