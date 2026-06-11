import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'

import { ABONELIK_DURUM_ETIKET, superadminCagir } from '../../lib/superadmin'
import { tarihFormatla } from '../../lib/muhasebe'

const abonelikSchema = z.object({
  abonelik_durumu: z.enum(['deneme', 'aktif', 'suresi_doldu', 'pasif']),
  abonelik_bitis: z.string().optional(),
})

type AbonelikFormValues = z.infer<typeof abonelikSchema>

type KurumOzet = {
  id: string
  ad: string
  abonelik_durumu: string
  abonelik_bitis: string | null
}

type AbonelikDuzenleModalProps = {
  kurum: KurumOzet
  onClose: () => void
  onSuccess: () => void
}

export default function AbonelikDuzenleModal({ kurum, onClose, onSuccess }: AbonelikDuzenleModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AbonelikFormValues>({
    resolver: zodResolver(abonelikSchema),
    defaultValues: {
      abonelik_durumu: kurum.abonelik_durumu as AbonelikFormValues['abonelik_durumu'],
      abonelik_bitis: kurum.abonelik_bitis?.slice(0, 10) ?? '',
    },
  })

  const kaydetMutation = useMutation({
    mutationFn: async (values: AbonelikFormValues) => {
      await superadminCagir('abonelik_guncelle', {
        kurum_id: kurum.id,
        abonelik_durumu: values.abonelik_durumu,
        abonelik_bitis: values.abonelik_bitis?.trim() ? values.abonelik_bitis : null,
      })
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Abonelik Düzenle</h2>
            <p className="mt-1 text-sm text-gray-400">{kurum.ad}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={kaydetMutation.isPending}
            className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-700"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit((v) => kaydetMutation.mutate(v))}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300" htmlFor="abonelik_durumu">
              Abonelik Durumu
            </label>
            <select
              id="abonelik_durumu"
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-400"
              {...register('abonelik_durumu')}
            >
              {Object.entries(ABONELIK_DURUM_ETIKET).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.abonelik_durumu && (
              <p className="mt-1 text-xs text-red-400">{errors.abonelik_durumu.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300" htmlFor="abonelik_bitis">
              Bitiş Tarihi
            </label>
            <input
              id="abonelik_bitis"
              type="date"
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-400"
              {...register('abonelik_bitis')}
            />
            {kurum.abonelik_bitis && (
              <p className="mt-1 text-xs text-gray-500">
                Mevcut: {tarihFormatla(kurum.abonelik_bitis.slice(0, 10))}
              </p>
            )}
          </div>

          {kaydetMutation.error && (
            <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-300">
              {kaydetMutation.error instanceof Error
                ? kaydetMutation.error.message
                : 'Güncelleme başarısız.'}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={kaydetMutation.isPending}
              className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-60"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={kaydetMutation.isPending}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-white disabled:opacity-60"
            >
              {kaydetMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
