import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from './supabase'

export type Profile = {
  id: string
  kurum_id: string | null
  rol: string | null
  ad: string | null
  soyad: string | null
  eposta: string | null
}

type AuthContextValue = {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const userId = user?.id

    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return null
    }

    setProfileLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      setProfile(null)
      setProfileLoading(false)
      throw error
    }

    const nextProfile = (data as Profile | null) ?? null
    setProfile(nextProfile)
    setProfileLoading(false)
    return nextProfile
  }, [user?.id])

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) return

      if (error) {
        setSession(null)
        setUser(null)
        setProfile(null)
        setProfileLoading(false)
      } else {
        setSession(data.session)
        const nextUser = data.session?.user ?? null
        setUser(nextUser)
        if (!nextUser) {
          setProfile(null)
          setProfileLoading(false)
        }
      }

      setLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (!nextSession?.user) {
        setProfile(null)
        setProfileLoading(false)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    void refreshProfile().catch(() => {
      setProfile(null)
    })
  }, [refreshProfile, user])

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      profileLoading,
      signOut,
      refreshProfile,
    }),
    [loading, profile, profileLoading, refreshProfile, session, signOut, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
