'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { authService, type AuthState } from '@/lib/auth'
import type { User } from '@supabase/supabase-js'

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ data: any; error: any }>
  signInWithMagicLink: (email: string) => Promise<{ data: any; error: any }>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ data: any; error: any }>
  signOut: () => Promise<{ error: any }>
  updateProfile: (updates: { email?: string; password?: string; data?: any }) => Promise<{ data: any; error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)

      // Update last_login timestamp when user signs in
      if (event === 'SIGNED_IN' && session?.user) {
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const value: AuthContextType = {
    user,
    loading,
    signIn: authService.signIn,
    signUp: authService.signUp,
    signInWithMagicLink: authService.signInWithMagicLink,
    signInWithOAuth: authService.signInWithOAuth,
    signOut: authService.signOut,
    updateProfile: authService.updateProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}