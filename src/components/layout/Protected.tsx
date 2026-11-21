import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuth } from '../../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="flex items-center gap-2.5 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Loading your study space…
        </div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
