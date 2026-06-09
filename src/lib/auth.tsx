import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

import { supabase } from './supabase'

export type Profile = {
  id: string
  kurum_id: string | null
  kurum_adi?: string | null
  rol: string | null
  yetkiler?: Record<string, boolean> | null
  ad: string | null
  soyad: string | null
  eposta: string | null
}

type YetkiKontrolParams = {
  gerekenRoller?: string[]
  gerekenYetki?: string
}

export function kullaniciYetkiliMi(
  profile: Profile | null,
  { gerekenRoller, gerekenYetki }: YetkiKontrolParams = {}
) {
  if (!profile) return false
  if (profile.rol === 'kurum_sahibi') return true

  const rolUygun =
    Array.isArray(gerekenRoller) && gerekenRoller.length > 0
      ? gerekenRoller.includes(profile.rol ?? '')
      : false
  const yetkiUygun = gerekenYetki
    ? profile.yetkiler?.[gerekenYetki] === true
    : false

  if (!gerekenRoller?.length && !gerekenYetki) return true
  return rolUygun || yetkiUygun
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
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileFetched, setProfileFetched] = useState(false)

  const refreshProfile = useCallback(async (): Promise<Profile | null> => {
    if (!user?.id) {
      setProfile(null)
      setProfileLoading(false)
      setProfileFetched(true)
      return null
    }

    setProfileFetched(false)
    setProfileLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      setProfile(null)
      setProfileLoading(false)
      setProfileFetched(true)
      throw error
    }

    const nextProfile = (data as Profile | null) ?? null
    setProfile(nextProfile)
    setProfileLoading(false)
    setProfileFetched(true)
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
      } else {
        setSession(data.session)
        setUser(data.session?.user ?? null)
      }

      setAuthLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setProfileFetched(false)
        setProfileLoading(false)
      } else if (nextSession?.user) {
        setProfileFetched(false)
      }
      setAuthLoading(false)
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
    let isCancelled = false

    const loadProfile = async () => {
      if (!user?.id) {
        if (!isCancelled) {
          setProfile(null)
          setProfileFetched(true)
          setProfileLoading(false)
        }
        return
      }

      if (!isCancelled) {
        setProfileLoading(true)
        setProfileFetched(false)
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (isCancelled) return

      if (error) {
        setProfile(null)
      } else {
        setProfile((data as Profile | null) ?? null)
      }
      setProfileFetched(true)
      setProfileLoading(false)
    }

    void loadProfile()

    return () => {
      isCancelled = true
    }
  }, [user?.id])

  const loading = authLoading || profileLoading || (!!user && !profileFetched)

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
