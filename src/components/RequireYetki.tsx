import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { kullaniciYetkiliMi, useAuth } from '../lib/auth'

type RequireYetkiProps = {
  children: ReactNode
  gerekenRoller?: string[]
  gerekenYetki?: string
}

export default function RequireYetki({ children, gerekenRoller, gerekenYetki }: RequireYetkiProps) {
  const { loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
      </div>
    )
  }

  if (!kullaniciYetkiliMi(profile, { gerekenRoller, gerekenYetki })) {
    return <Navigate to="/" replace state={{ uyari: 'Bu sayfaya erisiminiz yok.' }} />
  }

  return <>{children}</>
}
