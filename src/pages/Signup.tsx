import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { supabase } from '../lib/supabase'

const signupSchema = z.object({
  email: z.email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır.'),
})

type SignupFormValues = z.infer<typeof signupSchema>

export default function Signup() {
  const navigate = useNavigate()
  const [authError, setAuthError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (values: SignupFormValues) => {
    setAuthError(null)
    setSuccessMessage(null)

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setSuccessMessage('Kayıt başarılı. Yönlendiriliyorsun...')
    navigate(data.session ? '/onboarding' : '/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <h1 className="text-center text-2xl font-bold text-gray-900">Kayıt Ol</h1>
        <p className="mt-2 text-center text-sm text-gray-500">Yeni hesabını oluştur.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="ornek@mail.com"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
              Şifre
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="******"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {authError && (
            <p className="text-sm text-red-600">{authError}</p>
          )}

          {successMessage && (
            <p className="text-sm text-emerald-600">{successMessage}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Kayıt oluşturuluyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Zaten hesabın var mı?{' '}
          <Link className="font-medium text-indigo-600" to="/login">
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  )
}
