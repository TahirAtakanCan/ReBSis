import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { useAuth } from '../../lib/auth'
import { bugununTarihi, GIDER_KATEGORI_ETIKET, ODEME_YONTEMI_ETIKET } from '../../lib/muhasebe'
import { supabase } from '../../lib/supabase'
import type { GiderKategori, OdemeYontemi } from '../../lib/types'

const giderSchema = z.object({
  kategori: z.enum(['kira', 'maas', 'fatura', 'malzeme', 'diger']),
  tutar: z.number().positive('Tutar 0\'dan büyük olmalıdır.'),
  tarih: z.string().min(1, 'Tarih zorunludur.'),
  aciklama: z.string().optional(),
  odeme_yontemi: z.enum(['nakit', 'havale', 'kart']),
})

type GiderFormValues = z.infer<typeof giderSchema>

type GiderFormProps = {
  onClose: () => void
  onSuccess: () => void
}

export default function GiderForm({ onClose, onSuccess }: GiderFormProps) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GiderFormValues>({
    resolver: zodResolver(giderSchema),
    defaultValues: {
      kategori: 'diger',
      tutar: 0,
      tarih: bugununTarihi(),
      aciklama: '',
      odeme_yontemi: 'nakit',
    },
  })

  const kaydetMutation = useMutation({
    mutationFn: async (values: GiderFormValues) => {
      if (!profile?.kurum_id || !profile.id) {
        throw new Error('Kurum bilgisi bulunamadı.')
      }

      const { error } = await supabase.from('giderler').insert({
        kurum_id: profile.kurum_id,
        kategori: values.kategori,
        tutar: values.tutar,
        tarih: values.tarih,
        aciklama: values.aciklama?.trim() ? values.aciklama.trim() : null,
        odeme_yontemi: values.odeme_yontemi,
        olusturan_id: profile.id,
      })

      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['giderler'] })
      onSuccess()
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Yeni Gider</h2>
            <p className="mt-1 text-sm text-slate-600">Gider kaydı oluşturun.</p>
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

        <form className="space-y-4" onSubmit={handleSubmit((v) => kaydetMutation.mutate(v))}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="kategori">
              Kategori
            </label>
            <select
              id="kategori"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              {...register('kategori')}
            >
              {(Object.entries(GIDER_KATEGORI_ETIKET) as [GiderKategori, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tutar">
              Tutar (₺)
            </label>
            <input
              id="tutar"
              type="number"
              step="0.01"
              min="0.01"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              {...register('tutar', { valueAsNumber: true })}
            />
            {errors.tutar && <p className="mt-1 text-xs text-red-600">{errors.tutar.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tarih">
              Tarih
            </label>
            <input
              id="tarih"
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              {...register('tarih')}
            />
            {errors.tarih && <p className="mt-1 text-xs text-red-600">{errors.tarih.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="aciklama">
              Açıklama
            </label>
            <input
              id="aciklama"
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              {...register('aciklama')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="odeme_yontemi">
              Ödeme Yöntemi
            </label>
            <select
              id="odeme_yontemi"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              {...register('odeme_yontemi')}
            >
              {(Object.entries(ODEME_YONTEMI_ETIKET) as [OdemeYontemi, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </div>

          {kaydetMutation.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {kaydetMutation.error instanceof Error
                ? kaydetMutation.error.message
                : 'Gider kaydedilemedi.'}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={kaydetMutation.isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={kaydetMutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {kaydetMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
