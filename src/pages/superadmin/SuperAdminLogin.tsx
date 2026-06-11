import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

const loginSchema = z.object({
  email: z.email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function SuperAdminLogin() {
  const navigate = useNavigate()
  const { session, profile, loading, signOut, refreshProfile } = useAuth()
  const [authError, setAuthError] = useState<string | null>(null)
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    if (!loading && session && profile?.is_superadmin) {
      navigate('/superadmin', { replace: true })
    }
  }, [loading, session, profile, navigate])

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null)
    setKontrolEdiliyor(true)

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setAuthError(error.message)
      setKontrolEdiliyor(false)
      return
    }

    const userId = signInData.user?.id
    if (!userId) {
      setAuthError('Giriş başarısız.')
      setKontrolEdiliyor(false)
      return
    }

    const { data: prof, error: profError } = await supabase
      .from('profiles')
      .select('is_superadmin')
      .eq('id', userId)
      .single()

    if (profError || !prof?.is_superadmin) {
      await signOut()
      setAuthError('Yetkisiz erişim. Bu panel yalnızca süper-admin kullanıcılar içindir.')
      setKontrolEdiliyor(false)
      return
    }

    await refreshProfile()
    setKontrolEdiliyor(false)
    navigate('/superadmin')
  }

  const formYukleniyor = isSubmitting || kontrolEdiliyor

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-800 p-8 shadow-xl">
        <h1 className="text-center text-2xl font-bold text-gray-100">ReBSis Admin</h1>
        <p className="mt-2 text-center text-sm text-gray-400">Süper-admin girişi</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300" htmlFor="email">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-600"
              placeholder="admin@rebsis.com"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300" htmlFor="password">
              Şifre
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-600"
              placeholder="******"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          {authError && <p className="text-sm text-red-400">{authError}</p>}

          <button
            type="submit"
            disabled={formYukleniyor}
            className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {formYukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
