import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const onboardingSchema = z.object({
  kurumAdi: z.string().trim().min(1, 'Kurum adı zorunludur.'),
  ad: z.string().trim().optional(),
  soyad: z.string().trim().optional(),
})

type OnboardingFormValues = z.infer<typeof onboardingSchema>

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      kurumAdi: '',
      ad: '',
      soyad: '',
    },
  })

  const onSubmit = async (values: OnboardingFormValues) => {
    setSubmitError(null)

    if (!user) {
      setSubmitError('Oturum bulunamadı. Lütfen tekrar giriş yap.')
      return
    }

    const ad = values.ad?.trim() || null
    const soyad = values.soyad?.trim() || null

    const { error } = await supabase.rpc('kurum_olustur', {
      p_kurum_adi: values.kurumAdi.trim(),
      p_ad: ad,
      p_soyad: soyad,
    })

    if (error) {
      setSubmitError(error.message)
      return
    }

    try {
      await refreshProfile()
      navigate('/')
    } catch (profileError) {
      const message =
        profileError instanceof Error
          ? profileError.message
          : 'Profil yenilenirken bir hata oluştu.'
      setSubmitError(message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <h1 className="text-center text-2xl font-bold text-gray-900">Kurum Kurulumu</h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          Devam etmek için kurum bilgilerini tamamla.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="kurumAdi">
              Kurum Adı
            </label>
            <input
              id="kurumAdi"
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="Örn: ReBSis Teknoloji"
              {...register('kurumAdi')}
            />
            {errors.kurumAdi && (
              <p className="mt-1 text-xs text-red-600">{errors.kurumAdi.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="ad">
              Ad (Opsiyonel)
            </label>
            <input
              id="ad"
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="Adınız"
              {...register('ad')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="soyad">
              Soyad (Opsiyonel)
            </label>
            <input
              id="soyad"
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="Soyadınız"
              {...register('soyad')}
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Kurum oluşturuluyor...' : 'Kurumu Oluştur'}
          </button>
        </form>
      </div>
    </div>
  )
}
