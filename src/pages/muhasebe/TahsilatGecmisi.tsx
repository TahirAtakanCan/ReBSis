import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { indirMakbuzPdf } from '../../components/muhasebe/MakbuzPDF'
import { useAuth } from '../../lib/auth'
import { EMPTY_ARRAY } from '../../lib/constants'
import { ODEME_YONTEMI_ETIKET, paraFormatla, tarihFormatla } from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'
import type { Makbuz, OdemeYontemi } from '../../lib/types'

type TahsilatKaydi = {
  id: string
  tutar: number
  odeme_yontemi: OdemeYontemi
  odeme_tarihi: string
  aciklama: string | null
  created_at: string
  taksitler: {
    taksit_no: number
    tutar: number
    vade_tarihi: string
    sozlesmeler: {
      donem: string
      ogrenciler: { ad: string; soyad: string } | null
    } | null
  } | null
}

async function fetchTahsilatGecmisi() {
  const { data, error } = await supabase
    .from('tahsilatlar')
    .select('*, taksitler(taksit_no, tutar, vade_tarihi, sozlesmeler(donem, ogrenciler(ad, soyad)))')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return (data as unknown as TahsilatKaydi[]) ?? []
}

async function fetchMakbuz(tahsilatId: string) {
  const { data, error } = await supabase
    .from('makbuzlar')
    .select('*')
    .eq('tahsilat_id', tahsilatId)
    .single()

  if (error) throw error
  return data as Makbuz
}

export default function TahsilatGecmisi() {
  const { profile } = useAuth()
  const [indirilenId, setIndirilenId] = useState<string | null>(null)
  const [indirmeHata, setIndirmeHata] = useState<string | null>(null)

  const { data: tahsilatlarData, isLoading, error } = useQuery({
    queryKey: ['tahsilatlar'],
    queryFn: fetchTahsilatGecmisi,
  })
  const tahsilatlar = tahsilatlarData ?? EMPTY_ARRAY

  const makbuzIndir = async (kayit: TahsilatKaydi) => {
    setIndirmeHata(null)
    setIndirilenId(kayit.id)

    try {
      const makbuz = await fetchMakbuz(kayit.id)
      const taksit = kayit.taksitler
      const ogrenci = taksit?.sozlesmeler?.ogrenciler

      if (!taksit || !ogrenci) {
        throw new Error('Makbuz için gerekli bilgiler bulunamadı.')
      }

      await indirMakbuzPdf({
        makbuz: {
          sira_no: makbuz.sira_no,
          olusturma_tarihi: makbuz.olusturma_tarihi,
        },
        tahsilat: {
          tutar: kayit.tutar,
          odeme_yontemi: kayit.odeme_yontemi,
          odeme_tarihi: kayit.odeme_tarihi,
          aciklama: kayit.aciklama,
        },
        taksit: {
          taksit_no: taksit.taksit_no,
          tutar: taksit.tutar,
          vade_tarihi: taksit.vade_tarihi,
        },
        ogrenci,
        kurum: { ad: profile?.kurum_adi ?? profile?.kurum_id ?? 'Kurum' },
      })
    } catch (err) {
      setIndirmeHata(err instanceof Error ? err.message : 'Makbuz indirilemedi.')
    } finally {
      setIndirilenId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Tahsilat Geçmişi</h1>
        <p className="mt-1 text-sm text-slate-600">Son 100 tahsilat kaydı.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {indirmeHata && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {indirmeHata}
          </p>
        )}

        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Tahsilatlar yüklenemedi.'}
          </p>
        )}

        {!isLoading && !error && tahsilatlar.length === 0 && (
          <p className="text-sm text-slate-600">Henüz tahsilat kaydı yok.</p>
        )}

        {!isLoading && !error && tahsilatlar.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Öğrenci
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Dönem
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Taksit No
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tutar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Yöntem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {tahsilatlar.map((kayit) => {
                  const ogrenci = kayit.taksitler?.sozlesmeler?.ogrenciler
                  return (
                    <tr key={kayit.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                        {tarihFormatla(kayit.odeme_tarihi)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                        {ogrenci ? `${ogrenci.ad} ${ogrenci.soyad}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                        {kayit.taksitler?.sozlesmeler?.donem ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-700">
                        {kayit.taksitler?.taksit_no ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-900">
                        {paraFormatla(kayit.tutar)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {ODEME_YONTEMI_ETIKET[kayit.odeme_yontemi] ?? kayit.odeme_yontemi}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void makbuzIndir(kayit)}
                          disabled={indirilenId === kayit.id}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {indirilenId === kayit.id ? 'İndiriliyor...' : 'Makbuzu İndir'}
                        </button>
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
