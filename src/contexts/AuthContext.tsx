import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, errorMessage, getToken, setToken } from '../lib/api'
import type { Language, User } from '../types'

type AuthContextValue = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => void
  setUser: (user: User) => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUserState(null)
      setLoading(false)
      return
    }
    try {
      const { user: me } = await api.get<{ user: User }>('/auth/me')
      setUserState(me)
    } catch {
      setToken(null)
      setUserState(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onUnauthorized = () => setUserState(null)
    window.addEventListener('asb:unauthorized', onUnauthorized)
    return () => window.removeEventListener('asb:unauthorized', onUnauthorized)
  }, [refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { token, user: me } = await api.post<{ token: string; user: User }>('/auth/login', { email, password })
      setToken(token)
      setUserState(me)
    } catch (err) {
      throw new Error(errorMessage(err))
    }
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    try {
      const { token, user: me } = await api.post<{ token: string; user: User }>('/auth/register', { name, email, password })
      setToken(token)
      setUserState(me)
    } catch (err) {
      throw new Error(errorMessage(err))
    }
  }, [])

  const signOut = useCallback(() => {
    setToken(null)
    setUserState(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      setUser: (next) => setUserState(next),
      refresh,
    }),
    [user, loading, signIn, signUp, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function preferredLanguage(user: User | null): Language {
  return user?.language ?? 'english'
}
