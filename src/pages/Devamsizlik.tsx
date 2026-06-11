import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Devamsizlik, DevamsizlikDurum, YoklamaDurum } from '../lib/types'

type Sinif = {
  id: string
  ad: string
}

type Ogrenci = {
  id: string
  ad: string
  soyad: string
  ogrenci_no: string | null
}

function bugununTarihi() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchSiniflar() {
  const { data, error } = await supabase.from('siniflar').select('id, ad').order('ad')
  if (error) throw error
  return (data as Sinif[]) ?? []
}

async function fetchOgrenciler(sinifId: string) {
  const { data, error } = await supabase
    .from('ogrenciler')
    .select('id, ad, soyad, ogrenci_no')
    .eq('sinif_id', sinifId)
    .eq('durum', 'aktif')
    .order('soyad')

  if (error) throw error
  return (data as Ogrenci[]) ?? []
}

async function fetchDevamsizlik(ogrenciIds: string[], tarih: string) {
  if (ogrenciIds.length === 0) return []

  const { data, error } = await supabase
    .from('devamsizlik')
    .select('*')
    .in('ogrenci_id', ogrenciIds)
    .eq('tarih', tarih)

  if (error) throw error
  return (data as Devamsizlik[]) ?? []
}

function kayitlardanDurumHaritasi(
  ogrenciler: Ogrenci[],
  kayitlar: Devamsizlik[]
): Record<string, YoklamaDurum> {
  const kayitMap = new Map(kayitlar.map((k) => [k.ogrenci_id, k.durum]))
  const harita: Record<string, YoklamaDurum> = {}

  for (const ogrenci of ogrenciler) {
    harita[ogrenci.id] = kayitMap.get(ogrenci.id) ?? 'geldi'
  }

  return harita
}

const DURUM_BUTONLARI: { durum: YoklamaDurum; label: string }[] = [
  { durum: 'geldi', label: 'Geldi' },
  { durum: 'yok', label: 'Gelmedi' },
  { durum: 'gec', label: 'Geç' },
  { durum: 'izinli', label: 'İzinli' },
]

export default function Devamsizlik() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [tarih, setTarih] = useState(bugununTarihi)
  const [sinifId, setSinifId] = useState('')
  const [secimler, setSecimler] = useState<Record<string, YoklamaDurum>>({})
  const [kayitliSecimler, setKayitliSecimler] = useState<Record<string, YoklamaDurum>>({})
  const [bildirim, setBildirim] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: siniflar = [], isLoading: siniflarLoading } = useQuery({
    queryKey: ['siniflar'],
    queryFn: fetchSiniflar,
  })

  const { data: ogrenciler = [], isLoading: ogrencilerLoading } = useQuery({
    queryKey: ['ogrenciler', sinifId],
    queryFn: () => fetchOgrenciler(sinifId),
    enabled: Boolean(sinifId),
  })

  const ogrenciIds = useMemo(() => ogrenciler.map((o) => o.id), [ogrenciler])

  const { data: devamsizlikKayitlari = [], isLoading: devamsizlikLoading } = useQuery({
    queryKey: ['devamsizlik', sinifId, tarih],
    queryFn: () => fetchDevamsizlik(ogrenciIds, tarih),
    enabled: Boolean(sinifId) && ogrenciIds.length > 0,
  })

  useEffect(() => {
    if (ogrenciler.length === 0) {
      setSecimler({})
      setKayitliSecimler({})
      return
    }

    const harita = kayitlardanDurumHaritasi(ogrenciler, devamsizlikKayitlari)
    setSecimler(harita)
    setKayitliSecimler(harita)
  }, [ogrenciler, devamsizlikKayitlari])

  const degisiklikVar = useMemo(() => {
    const tumIdler = new Set([...Object.keys(secimler), ...Object.keys(kayitliSecimler)])
    for (const id of tumIdler) {
      if (secimler[id] !== kayitliSecimler[id]) return true
    }
    return false
  }, [secimler, kayitliSecimler])

  const kaydetMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.kurum_id || !profile.id) {
        throw new Error('Kurum bilgisi bulunamadı. Önce onboarding tamamlanmalı.')
      }

      const upsertRows = ogrenciler
        .filter((o) => secimler[o.id] && secimler[o.id] !== 'geldi')
        .map((o) => ({
          kurum_id: profile.kurum_id!,
          ogrenci_id: o.id,
          tarih,
          durum: secimler[o.id] as DevamsizlikDurum,
          olusturan_id: profile.id,
        }))

      const geldiYapilanlar = ogrenciler
        .filter((o) => secimler[o.id] === 'geldi' && kayitliSecimler[o.id] !== 'geldi')
        .map((o) => o.id)

      if (upsertRows.length > 0) {
        const { error: upsertError } = await supabase
          .from('devamsizlik')
          .upsert(upsertRows, { onConflict: 'ogrenci_id,tarih' })

        if (upsertError) throw upsertError
      }

      if (geldiYapilanlar.length > 0) {
        const { error: deleteError } = await supabase
          .from('devamsizlik')
          .delete()
          .in('ogrenci_id', geldiYapilanlar)
          .eq('tarih', tarih)

        if (deleteError) throw deleteError
      }
    },
    onSuccess: async () => {
      setFormError(null)
      setBildirim('Kaydedildi')
      setKayitliSecimler({ ...secimler })
      await queryClient.invalidateQueries({ queryKey: ['devamsizlik'] })
      setTimeout(() => setBildirim(null), 2500)
    },
    onError: (error) => {
      setBildirim(null)
      setFormError(error instanceof Error ? error.message : 'Kayıt sırasında hata oluştu.')
    },
  })

  const durumSec = (ogrenciId: string, durum: YoklamaDurum) => {
    setSecimler((prev) => ({ ...prev, [ogrenciId]: durum }))
    setBildirim(null)
  }

  const tumunuGeldiYap = () => {
    const harita: Record<string, YoklamaDurum> = {}
    for (const ogrenci of ogrenciler) {
      harita[ogrenci.id] = 'geldi'
    }
    setSecimler(harita)
    setBildirim(null)
  }

  const listeYukleniyor = Boolean(sinifId) && (ogrencilerLoading || devamsizlikLoading)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Devamsızlık</h1>
        <p className="mt-1 text-sm text-slate-600">Günlük yoklama girişi.</p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Tarih</span>
            <input
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Sınıf</span>
            <select
              value={sinifId}
              onChange={(e) => setSinifId(e.target.value)}
              disabled={siniflarLoading}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 disabled:opacity-60"
            >
              <option value="">Sınıf seçin</option>
              {siniflar.map((sinif) => (
                <option key={sinif.id} value={sinif.id}>
                  {sinif.ad}
                </option>
              ))}
            </select>
          </label>
        </div>

        {bildirim && (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {bildirim}
          </div>
        )}

        {formError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
      </div>

      {sinifId && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Öğrenci Listesi</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={tumunuGeldiYap}
                disabled={ogrenciler.length === 0 || listeYukleniyor}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tümünü Geldi yap
              </button>
              <button
                type="button"
                onClick={() => kaydetMutation.mutate()}
                disabled={!degisiklikVar || kaydetMutation.isPending || listeYukleniyor}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  degisiklikVar
                    ? 'bg-emerald-600 ring-2 ring-emerald-300 hover:bg-emerald-700'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {kaydetMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>

          {listeYukleniyor && (
            <div className="mt-6 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
            </div>
          )}

          {!listeYukleniyor && ogrenciler.length === 0 && (
            <p className="mt-4 text-sm text-slate-600">Bu sınıfta aktif öğrenci bulunamadı.</p>
          )}

          {!listeYukleniyor && ogrenciler.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Ad Soyad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Durum
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {ogrenciler.map((ogrenci) => {
                    const secili = secimler[ogrenci.id] ?? 'geldi'
                    return (
                      <tr key={ogrenci.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                          {ogrenci.ogrenci_no ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                          {ogrenci.ad} {ogrenci.soyad}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                            {DURUM_BUTONLARI.map(({ durum, label }) => {
                              const aktif = secili === durum
                              return (
                                <button
                                  key={durum}
                                  type="button"
                                  onClick={() => durumSec(ogrenci.id, durum)}
                                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:px-3 ${
                                    aktif
                                      ? durum === 'geldi'
                                        ? 'bg-emerald-600 text-white'
                                        : durum === 'yok'
                                          ? 'bg-red-600 text-white'
                                          : durum === 'gec'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-blue-600 text-white'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
