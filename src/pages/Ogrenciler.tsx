import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type Sinif = {
  id: string
  ad: string
}

type Ogrenci = {
  id: string
  kurum_id: string
  sinif_id: string | null
  ad: string
  soyad: string
  veli_ad: string | null
  veli_telefon: string | null
  durum: 'aday' | 'aktif' | 'pasif'
  created_at: string
  siniflar: { ad: string } | null
}

const ogrenciSchema = z.object({
  ad: z.string().trim().min(1, 'Ad zorunludur.'),
  soyad: z.string().trim().min(1, 'Soyad zorunludur.'),
  sinif_id: z.string().optional(),
  veli_ad: z.string().trim().optional(),
  veli_telefon: z.string().trim().optional(),
  durum: z.enum(['aday', 'aktif', 'pasif']),
})

type OgrenciFormValues = z.infer<typeof ogrenciSchema>

async function fetchOgrenciler() {
  const { data, error } = await supabase
    .from('ogrenciler')
    .select('*, siniflar(ad)')
    .order('soyad')

  if (error) {
    throw error
  }

  return (data as Ogrenci[]) ?? []
}

async function fetchSiniflar() {
  const { data, error } = await supabase.from('siniflar').select('id, ad').order('ad')

  if (error) {
    throw error
  }

  return (data as Sinif[]) ?? []
}

export default function Ogrenciler() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OgrenciFormValues>({
    resolver: zodResolver(ogrenciSchema),
    defaultValues: {
      ad: '',
      soyad: '',
      sinif_id: '',
      veli_ad: '',
      veli_telefon: '',
      durum: 'aday',
    },
  })

  const {
    data: ogrenciler = [],
    isLoading: ogrencilerLoading,
    error: ogrencilerError,
  } = useQuery({
    queryKey: ['ogrenciler'],
    queryFn: fetchOgrenciler,
  })

  const {
    data: siniflar = [],
    isLoading: siniflarLoading,
    error: siniflarError,
  } = useQuery({
    queryKey: ['siniflar'],
    queryFn: fetchSiniflar,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: OgrenciFormValues) => {
      if (!profile?.kurum_id) {
        throw new Error('Kurum bilgisi bulunamadı. Önce onboarding tamamlanmalı.')
      }

      const payload = {
        kurum_id: profile.kurum_id,
        ad: values.ad.trim(),
        soyad: values.soyad.trim(),
        sinif_id: values.sinif_id?.trim() ? values.sinif_id : null,
        veli_ad: values.veli_ad?.trim() ? values.veli_ad.trim() : null,
        veli_telefon: values.veli_telefon?.trim() ? values.veli_telefon.trim() : null,
        durum: values.durum,
      }

      if (editingId) {
        const { error: updateError } = await supabase.from('ogrenciler').update(payload).eq('id', editingId)

        if (updateError) {
          throw updateError
        }
        return
      }

      const { error: insertError } = await supabase.from('ogrenciler').insert(payload)

      if (insertError) {
        throw insertError
      }
    },
    onSuccess: async () => {
      setFormError(null)
      setEditingId(null)
      reset({
        ad: '',
        soyad: '',
        sinif_id: '',
        veli_ad: '',
        veli_telefon: '',
        durum: 'aday',
      })
      await queryClient.invalidateQueries({ queryKey: ['ogrenciler'] })
    },
    onError: (mutationError) => {
      setFormError(
        mutationError instanceof Error ? mutationError.message : 'Öğrenci kaydedilirken hata oluştu.'
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from('ogrenciler').delete().eq('id', id)

      if (deleteError) {
        throw deleteError
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ogrenciler'] })
    },
  })

  const editingRecord = useMemo(
    () => ogrenciler.find((ogrenci) => ogrenci.id === editingId) ?? null,
    [editingId, ogrenciler]
  )

  useEffect(() => {
    if (!editingRecord) {
      return
    }

    reset({
      ad: editingRecord.ad,
      soyad: editingRecord.soyad,
      sinif_id: editingRecord.sinif_id ?? '',
      veli_ad: editingRecord.veli_ad ?? '',
      veli_telefon: editingRecord.veli_telefon ?? '',
      durum: editingRecord.durum,
    })
  }, [editingRecord, reset])

  const onSubmit = async (values: OgrenciFormValues) => {
    setFormError(null)
    await saveMutation.mutateAsync(values)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormError(null)
    reset({
      ad: '',
      soyad: '',
      sinif_id: '',
      veli_ad: '',
      veli_telefon: '',
      durum: 'aday',
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          {editingId ? 'Öğrenci Düzenle' : 'Öğrenci Ekle'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">Öğrenci bilgilerini kaydet veya güncelle.</p>

        <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="ad">
              Ad
            </label>
            <input
              id="ad"
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('ad')}
            />
            {errors.ad && <p className="mt-1 text-xs text-red-600">{errors.ad.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="soyad">
              Soyad
            </label>
            <input
              id="soyad"
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('soyad')}
            />
            {errors.soyad && <p className="mt-1 text-xs text-red-600">{errors.soyad.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="sinif_id">
              Sınıf
            </label>
            <select
              id="sinif_id"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('sinif_id')}
            >
              <option value="">Sınıf seçilmedi</option>
              {siniflar.map((sinif) => (
                <option key={sinif.id} value={sinif.id}>
                  {sinif.ad}
                </option>
              ))}
            </select>
            {siniflarLoading && <p className="mt-1 text-xs text-slate-500">Sınıflar yükleniyor...</p>}
            {siniflarError && (
              <p className="mt-1 text-xs text-red-600">
                {siniflarError instanceof Error ? siniflarError.message : 'Sınıflar yüklenemedi.'}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="durum">
              Durum
            </label>
            <select
              id="durum"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('durum')}
            >
              <option value="aday">Aday</option>
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </select>
            {errors.durum && <p className="mt-1 text-xs text-red-600">{errors.durum.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="veli_ad">
              Veli Adı
            </label>
            <input
              id="veli_ad"
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('veli_ad')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="veli_telefon">
              Veli Telefon
            </label>
            <input
              id="veli_telefon"
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('veli_telefon')}
            />
          </div>

          {formError && (
            <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting || saveMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                İptal
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Öğrenci Listesi</h2>

        {ogrencilerLoading && <p className="mt-4 text-sm text-slate-600">Öğrenciler yükleniyor...</p>}

        {ogrencilerError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {ogrencilerError instanceof Error ? ogrencilerError.message : 'Öğrenciler yüklenemedi.'}
          </p>
        )}

        {!ogrencilerLoading && !ogrencilerError && ogrenciler.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">Henüz öğrenci eklenmedi.</p>
        )}

        {!ogrencilerLoading && !ogrencilerError && ogrenciler.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Ad Soyad</th>
                  <th className="px-3 py-2 font-medium">Sınıf</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Veli</th>
                  <th className="px-3 py-2 font-medium">Telefon</th>
                  <th className="px-3 py-2 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {ogrenciler.map((ogrenci) => (
                  <tr key={ogrenci.id}>
                    <td className="px-3 py-2 text-slate-800">
                      {ogrenci.ad} {ogrenci.soyad}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{ogrenci.siniflar?.ad ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{ogrenci.durum}</td>
                    <td className="px-3 py-2 text-slate-700">{ogrenci.veli_ad ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{ogrenci.veli_telefon ?? '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(ogrenci.id)
                            setFormError(null)
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(ogrenci.id)}
                          disabled={deleteMutation.isPending}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
