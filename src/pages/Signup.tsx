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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="text-2xl font-semibold text-slate-900">Kayıt Ol</h1>
        <p className="mt-2 text-sm text-slate-600">Yeni hesabını oluştur.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              placeholder="ornek@mail.com"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Şifre
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
              placeholder="******"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {authError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {authError}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Kayıt oluşturuluyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Zaten hesabın var mı?{' '}
          <Link className="font-medium text-slate-900 underline" to="/login">
            Giriş yap
          </Link>
        </p>
      </div>
    </div>
  )
}
