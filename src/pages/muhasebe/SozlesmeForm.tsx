import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { useAuth } from '../../lib/auth'
import { EMPTY_ARRAY } from '../../lib/constants'
import { hesaplaNetTutar, hesaplaTaksitler, paraFormatla } from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'
import OgrenciSecici from './OgrenciSecici'

const sozlesmeSchema = z
  .object({
    ogrenci_id: z.string().min(1, 'Öğrenci seçilmelidir.'),
    donem: z.string().trim().min(1, 'Dönem zorunludur.'),
    brut_tutar: z.number().positive('Brüt tutar 0\'dan büyük olmalıdır.'),
    indirim_tutari: z.number().min(0, 'İndirim negatif olamaz.'),
    taksit_tipi: z.enum(['sabit', 'serbest']),
    taksit_sayisi: z.number().int().min(1, 'En az 1 taksit').max(24, 'En fazla 24 taksit'),
    ilk_vade_tarihi: z.string().min(1, 'İlk vade tarihi zorunludur.'),
    notlar: z.string().optional(),
  })
  .refine((data) => data.indirim_tutari <= data.brut_tutar, {
    message: 'İndirim brüt tutardan büyük olamaz.',
    path: ['indirim_tutari'],
  })

type SozlesmeFormValues = z.infer<typeof sozlesmeSchema>

type Ogrenci = {
  id: string
  ad: string
  soyad: string
}

async function fetchAktifOgrenciler() {
  const { data, error } = await supabase
    .from('ogrenciler')
    .select('id, ad, soyad')
    .eq('durum', 'aktif')
    .order('soyad')

  if (error) throw error
  return (data as Ogrenci[]) ?? []
}

type SozlesmeFormProps = {
  onClose: () => void
  onSuccess: (sozlesmeId: string) => void
}

export default function SozlesmeForm({ onClose, onSuccess }: SozlesmeFormProps) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const { data: ogrencilerData, isLoading: ogrencilerLoading } = useQuery({
    queryKey: ['ogrenciler', 'aktif'],
    queryFn: fetchAktifOgrenciler,
  })
  const ogrenciler = ogrencilerData ?? EMPTY_ARRAY

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SozlesmeFormValues>({
    resolver: zodResolver(sozlesmeSchema),
    defaultValues: {
      ogrenci_id: '',
      donem: '',
      brut_tutar: 0,
      indirim_tutari: 0,
      taksit_tipi: 'sabit',
      taksit_sayisi: 1,
      ilk_vade_tarihi: new Date().toISOString().slice(0, 10),
      notlar: '',
    },
  })

  const brutTutar = watch('brut_tutar')
  const indirimTutari = watch('indirim_tutari')
  const ogrenciId = watch('ogrenci_id')

  const netTutar = useMemo(
    () => hesaplaNetTutar(Number(brutTutar) || 0, Number(indirimTutari) || 0),
    [brutTutar, indirimTutari]
  )

  const kaydetMutation = useMutation({
    mutationFn: async (values: SozlesmeFormValues) => {
      if (!profile?.kurum_id || !profile.id) {
        throw new Error('Kurum bilgisi bulunamadı. Önce onboarding tamamlanmalı.')
      }

      const net = hesaplaNetTutar(values.brut_tutar, values.indirim_tutari)

      const { data: sozlesme, error: sozlesmeError } = await supabase
        .from('sozlesmeler')
        .insert({
          kurum_id: profile.kurum_id,
          ogrenci_id: values.ogrenci_id,
          donem: values.donem.trim(),
          brut_tutar: values.brut_tutar,
          indirim_tutari: values.indirim_tutari,
          taksit_tipi: values.taksit_tipi,
          taksit_sayisi: values.taksit_sayisi,
          notlar: values.notlar?.trim() ? values.notlar.trim() : null,
          olusturan_id: profile.id,
        })
        .select('id')
        .single()

      if (sozlesmeError) throw sozlesmeError

      const taksitTaslaklari = hesaplaTaksitler(
        values.taksit_tipi,
        net,
        values.taksit_sayisi,
        values.ilk_vade_tarihi
      )

      const taksitRows = taksitTaslaklari.map((t) => ({
        kurum_id: profile.kurum_id!,
        sozlesme_id: sozlesme.id,
        taksit_no: t.taksit_no,
        tutar: t.tutar,
        vade_tarihi: t.vade_tarihi,
        durum: 'bekliyor' as const,
      }))

      const { error: taksitError } = await supabase.from('taksitler').insert(taksitRows)

      if (taksitError) {
        await supabase.from('sozlesmeler').delete().eq('id', sozlesme.id)
        throw new Error(`Taksitler oluşturulamadı: ${taksitError.message}`)
      }

      return sozlesme.id as string
    },
    onSuccess: async (sozlesmeId) => {
      await queryClient.invalidateQueries({ queryKey: ['sozlesmeler'] })
      onSuccess(sozlesmeId)
    },
  })

  const onSubmit = (values: SozlesmeFormValues) => {
    kaydetMutation.mutate(values)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Yeni Sözleşme</h2>
            <p className="mt-1 text-sm text-slate-600">Sözleşme ve taksit planını oluşturun.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={kaydetMutation.isPending}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Öğrenci</label>
            <OgrenciSecici
              ogrenciler={ogrenciler}
              value={ogrenciId}
              onChange={(id) => setValue('ogrenci_id', id, { shouldValidate: true })}
              error={errors.ogrenci_id?.message}
              disabled={ogrencilerLoading || kaydetMutation.isPending}
            />
            {ogrencilerLoading && <p className="mt-1 text-xs text-slate-500">Öğrenciler yükleniyor...</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="donem">
              Dönem
            </label>
            <input
              id="donem"
              type="text"
              placeholder="2024-2025 Güz"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('donem')}
            />
            {errors.donem && <p className="mt-1 text-xs text-red-600">{errors.donem.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="brut_tutar">
              Brüt Tutar (₺)
            </label>
            <input
              id="brut_tutar"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('brut_tutar', { valueAsNumber: true })}
            />
            {errors.brut_tutar && <p className="mt-1 text-xs text-red-600">{errors.brut_tutar.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="indirim_tutari">
              İndirim Tutarı (₺)
            </label>
            <input
              id="indirim_tutari"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('indirim_tutari', { valueAsNumber: true })}
            />
            {errors.indirim_tutari && (
              <p className="mt-1 text-xs text-red-600">{errors.indirim_tutari.message}</p>
            )}
          </div>

          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">Net Tutar</p>
            <p className="text-lg font-semibold text-slate-900">{paraFormatla(netTutar)}</p>
          </div>

          <div className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Taksit Tipi</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" value="sabit" {...register('taksit_tipi')} />
                Sabit (eşit taksitler)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" value="serbest" {...register('taksit_tipi')} />
                Serbest (manuel tutar)
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="taksit_sayisi">
              Taksit Sayısı
            </label>
            <input
              id="taksit_sayisi"
              type="number"
              min="1"
              max="24"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('taksit_sayisi', { valueAsNumber: true })}
            />
            {errors.taksit_sayisi && (
              <p className="mt-1 text-xs text-red-600">{errors.taksit_sayisi.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="ilk_vade_tarihi">
              İlk Vade Tarihi
            </label>
            <input
              id="ilk_vade_tarihi"
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('ilk_vade_tarihi')}
            />
            {errors.ilk_vade_tarihi && (
              <p className="mt-1 text-xs text-red-600">{errors.ilk_vade_tarihi.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="notlar">
              Notlar
            </label>
            <textarea
              id="notlar"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              {...register('notlar')}
            />
          </div>

          {kaydetMutation.error && (
            <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {kaydetMutation.error instanceof Error
                ? kaydetMutation.error.message
                : 'Sözleşme kaydedilirken hata oluştu.'}
            </div>
          )}

          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={kaydetMutation.isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={kaydetMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {kaydetMutation.isPending ? 'Kaydediliyor...' : 'Sözleşme Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
