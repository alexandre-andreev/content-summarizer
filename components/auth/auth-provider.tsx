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
  authError: string | null
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Get initial session with error handling
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth session error:', error)
          setAuthError(error.message)
          setUser(null)
        } else {
          setUser(session?.user ?? null)
          setAuthError(null)
        }
      } catch (error: any) {
        console.error('Auth session fetch error:', error)
        setAuthError('Failed to get session')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Listen for auth changes with error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event)
      
      try {
        setUser(session?.user ?? null)
        setAuthError(null)
        setLoading(false)

        // Update last_login timestamp when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            await supabase
              .from('users')
              .update({ last_login: new Date().toISOString() })
              .eq('id', session.user.id)
          } catch (dbError) {
            console.warn('Failed to update last_login:', dbError)
            // Don't fail auth for this
          }
        }
      } catch (error: any) {
        console.error('Auth state change error:', error)
        setAuthError(error.message)
      }
    })

    // Handle page visibility changes to recover from browser suspension
    const handleVisibilityChange = () => {
      if (!document.hidden && !user && !loading) {
        console.log('Page visible and no user - checking auth state')
        getSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const clearAuthError = () => setAuthError(null)

  const value: AuthContextType = {
    user,
    loading,
    authError,
    clearAuthError,
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