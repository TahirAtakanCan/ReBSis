import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { EMPTY_ARRAY } from '../lib/constants'
import { supabase } from '../lib/supabase'
import type { DevamsizlikDurum } from '../lib/types'

type Sinif = {
  id: string
  ad: string
}

type DevamsizlikRaporKaydi = {
  durum: DevamsizlikDurum
  tarih: string
  ogrenciler: {
    id: string
    ad: string
    soyad: string
    sinif_id: string | null
  } | null
}

type OgrenciOzet = {
  ogrenciId: string
  ad: string
  soyad: string
  yok: number
  gec: number
  izinli: number
}

function ayinIlkGunu() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function bugununTarihi() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchSiniflar() {
  const { data, error } = await supabase.from('siniflar').select('id, ad').order('ad')
  if (error) throw error
  return (data as Sinif[]) ?? []
}

async function fetchDevamsizlikRapor(baslangic: string, bitis: string) {
  const { data, error } = await supabase
    .from('devamsizlik')
    .select('durum, tarih, ogrenciler(id, ad, soyad, sinif_id)')
    .gte('tarih', baslangic)
    .lte('tarih', bitis)

  if (error) throw error
  return (data as unknown as DevamsizlikRaporKaydi[]) ?? []
}

function ogrenciBazindaGrupla(kayitlar: DevamsizlikRaporKaydi[]): OgrenciOzet[] {
  const harita = new Map<string, OgrenciOzet>()

  for (const kayit of kayitlar) {
    const ogrenci = kayit.ogrenciler
    if (!ogrenci) continue

    let ozet = harita.get(ogrenci.id)
    if (!ozet) {
      ozet = { ogrenciId: ogrenci.id, ad: ogrenci.ad, soyad: ogrenci.soyad, yok: 0, gec: 0, izinli: 0 }
      harita.set(ogrenci.id, ozet)
    }

    if (kayit.durum === 'yok') ozet.yok += 1
    else if (kayit.durum === 'gec') ozet.gec += 1
    else if (kayit.durum === 'izinli') ozet.izinli += 1
  }

  return Array.from(harita.values()).sort((a, b) =>
    a.soyad.localeCompare(b.soyad, 'tr') || a.ad.localeCompare(b.ad, 'tr')
  )
}

export default function DevamsizlikRapor() {
  const [baslangic, setBaslangic] = useState(ayinIlkGunu)
  const [bitis, setBitis] = useState(bugununTarihi)
  const [sinifId, setSinifId] = useState('')

  const { data: siniflarData } = useQuery({
    queryKey: ['siniflar'],
    queryFn: fetchSiniflar,
  })
  const siniflar = siniflarData ?? EMPTY_ARRAY

  const {
    data: kayitlarData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['devamsizlik-rapor', baslangic, bitis],
    queryFn: () => fetchDevamsizlikRapor(baslangic, bitis),
    enabled: Boolean(baslangic && bitis && baslangic <= bitis),
  })
  const kayitlar = kayitlarData ?? EMPTY_ARRAY

  const filtrelenmisKayitlar = useMemo(() => {
    if (!sinifId) return kayitlar
    return kayitlar.filter((k) => k.ogrenciler?.sinif_id === sinifId)
  }, [kayitlar, sinifId])

  const ozetler = useMemo(() => ogrenciBazindaGrupla(filtrelenmisKayitlar), [filtrelenmisKayitlar])

  const toplamlar = useMemo(
    () =>
      ozetler.reduce(
        (acc, o) => ({
          yok: acc.yok + o.yok,
          gec: acc.gec + o.gec,
          izinli: acc.izinli + o.izinli,
        }),
        { yok: 0, gec: 0, izinli: 0 }
      ),
    [ozetler]
  )

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Devamsızlık Raporu</h1>
        <p className="mt-1 text-sm text-slate-600">Tarih aralığına göre öğrenci bazında özet.</p>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Başlangıç</span>
            <input
              type="date"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Bitiş</span>
            <input
              type="date"
              value={bitis}
              onChange={(e) => setBitis(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Sınıf (opsiyonel)</span>
            <select
              value={sinifId}
              onChange={(e) => setSinifId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
            >
              <option value="">Tüm sınıflar</option>
              {siniflar.map((sinif) => (
                <option key={sinif.id} value={sinif.id}>
                  {sinif.ad}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching || baslangic > bitis}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetching ? 'Yükleniyor...' : 'Sorgula'}
          </button>
        </div>

        {baslangic > bitis && (
          <p className="mt-3 text-sm text-red-700">Başlangıç tarihi bitişten sonra olamaz.</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Özet Tablo</h2>

        {isLoading && (
          <div className="mt-6 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Rapor yüklenemedi.'}
          </p>
        )}

        {!isLoading && !error && ozetler.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">Seçilen aralıkta devamsızlık kaydı bulunamadı.</p>
        )}

        {!isLoading && !error && ozetler.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Ad Soyad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Gelmedi
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Geç
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    İzinli
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Toplam
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {ozetler.map((ozet) => (
                  <tr key={ozet.ogrenciId}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                      {ozet.ad} {ozet.soyad}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-red-700">{ozet.yok}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-amber-700">{ozet.gec}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-blue-700">{ozet.izinli}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-900">
                      {ozet.yok + ozet.gec + ozet.izinli}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">Toplam</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-red-700">{toplamlar.yok}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-amber-700">{toplamlar.gec}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-blue-700">{toplamlar.izinli}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                    {toplamlar.yok + toplamlar.gec + toplamlar.izinli}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
