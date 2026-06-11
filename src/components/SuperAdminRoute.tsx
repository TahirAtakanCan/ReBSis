import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../lib/auth'

type SuperAdminRouteProps = {
  children: ReactNode
}

export default function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-gray-200" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/superadmin/login" replace />
  }

  if (!profile?.is_superadmin) {
    return <Navigate to="/superadmin/login" replace />
  }

  return <>{children}</>
}
