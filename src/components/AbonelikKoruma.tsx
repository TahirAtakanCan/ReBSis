import type { ReactNode } from 'react'

import { useAuth } from '../lib/auth'

type AbonelikKorumaProps = {
  children: ReactNode
}

export default function AbonelikKoruma({ children }: AbonelikKorumaProps) {
  const { profile, kurumAktif, kurumAktifLoading } = useAuth()

  if (kurumAktifLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    )
  }

  if (!kurumAktif) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-700">
            ⚠
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Aboneliğiniz sona ermiştir</h1>
          <p className="mt-3 text-sm text-slate-600">
            Kurumunuzun aboneliği aktif değil. Sisteme erişim geçici olarak kısıtlanmıştır.
          </p>
          <p className="mt-2 text-sm text-slate-500">Lütfen yöneticinizle iletişime geçin.</p>
          {profile?.rol === 'kurum_sahibi' && (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Aboneliği yenilemek için:{' '}
              <a href="mailto:info@rebsis.com" className="font-medium text-slate-900 underline">
                info@rebsis.com
              </a>
            </p>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
