import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import GiderForm from '../../components/muhasebe/GiderForm'
import { EMPTY_ARRAY } from '../../lib/constants'
import {
  AY_ADLARI,
  GIDER_KATEGORI_ETIKET,
  ODEME_YONTEMI_ETIKET,
  paraFormatla,
  tarihFormatla,
} from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'
import type { Gider, GiderKategori } from '../../lib/types'

async function fetchGiderler() {
  const { data, error } = await supabase
    .from('giderler')
    .select('*, profiles(ad, soyad)')
    .order('tarih', { ascending: false })

  if (error) throw error
  return (data as unknown as Gider[]) ?? []
}

const simdikiYil = new Date().getFullYear()
const YILLAR = Array.from({ length: 5 }, (_, i) => simdikiYil - 2 + i)

export default function GiderListesi() {
  const queryClient = useQueryClient()
  const [formAcik, setFormAcik] = useState(false)
  const [filtreAy, setFiltreAy] = useState(new Date().getMonth() + 1)
  const [filtreYil, setFiltreYil] = useState(simdikiYil)
  const [filtreKategori, setFiltreKategori] = useState<GiderKategori | ''>('')

  const { data: giderlerData, isLoading, error } = useQuery({
    queryKey: ['giderler'],
    queryFn: fetchGiderler,
  })
  const giderler = giderlerData ?? EMPTY_ARRAY

  const filtrelenmis = useMemo(() => {
    return giderler.filter((g) => {
      const [yil, ay] = g.tarih.split('-').map(Number)
      if (yil !== filtreYil || ay !== filtreAy) return false
      if (filtreKategori && g.kategori !== filtreKategori) return false
      return true
    })
  }, [giderler, filtreAy, filtreYil, filtreKategori])

  const toplamTutar = useMemo(
    () => filtrelenmis.reduce((acc, g) => acc + Number(g.tutar), 0),
    [filtrelenmis]
  )

  const silMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from('giderler').delete().eq('id', id)
      if (deleteError) throw deleteError
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['giderler'] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Giderler</h1>
            <p className="mt-1 text-sm text-slate-600">Kurum gider kayıtları.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormAcik(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Yeni Gider
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Ay</span>
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
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Yıl</span>
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
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Kategori</span>
            <select
              value={filtreKategori}
              onChange={(e) => setFiltreKategori(e.target.value as GiderKategori | '')}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="">Tümü</option>
              {(Object.entries(GIDER_KATEGORI_ETIKET) as [GiderKategori, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          </div>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Giderler yüklenemedi.'}
          </p>
        )}

        {!isLoading && !error && filtrelenmis.length === 0 && (
          <p className="text-sm text-slate-600">Seçilen dönemde gider kaydı bulunamadı.</p>
        )}

        {!isLoading && !error && filtrelenmis.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Kategori
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Açıklama
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Tutar
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Yöntem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Ekleyen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filtrelenmis.map((gider) => (
                  <tr key={gider.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {tarihFormatla(gider.tarih)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                      {GIDER_KATEGORI_ETIKET[gider.kategori] ?? gider.kategori}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{gider.aciklama ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-slate-900">
                      {paraFormatla(gider.tutar)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {ODEME_YONTEMI_ETIKET[gider.odeme_yontemi] ?? gider.odeme_yontemi}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {gider.profiles
                        ? `${gider.profiles.ad} ${gider.profiles.soyad}`
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => silMutation.mutate(gider.id)}
                        disabled={silMutation.isPending}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-600">
            Filtrelenmiş toplam:{' '}
            <span className="font-semibold text-slate-900">{paraFormatla(toplamTutar)}</span>
            <span className="ml-2 text-slate-500">({filtrelenmis.length} kayıt)</span>
          </p>
        </div>
      </div>

      {formAcik && (
        <GiderForm onClose={() => setFormAcik(false)} onSuccess={() => setFormAcik(false)} />
      )}
    </div>
  )
}
