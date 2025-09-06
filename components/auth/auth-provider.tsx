'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { authService, type AuthState } from '@/lib/auth'
import type { User } from '@supabase/supabase-js'
import { recoveryManager } from '@/lib/utils/recovery-manager'

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ data: any; error: any }>
  signInWithMagicLink: (email: string) => Promise<{ data: any; error: any }>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ data: any; error: any }>
  signOut: () => Promise<{ error: any }>
  updateProfile: (updates: { email?: string; password?: string; data?: any }) => Promise<{ data: any; error: any }>
  authError: string | null
  clearAuthError: () => void
  refreshSession: () => Promise<void>
  forceTokenRefresh: () => Promise<boolean> // Add force token refresh method
  handleLongSuspensionRecovery: () => Promise<boolean> // Add long suspension recovery method
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const isRefreshing = useRef(false)
  const lastTokenCheck = useRef<number>(0)
  const lastVisibilityChange = useRef<number>(0)

  // Refresh session function with better error handling
  const refreshSession = async () => {
    // Prevent multiple concurrent refresh attempts
    if (isRefreshing.current) {
      console.log('Session refresh already in progress, skipping')
      return
    }
    
    try {
      isRefreshing.current = true
      console.log('🔄 Refreshing user session...')
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Auth session refresh error:', error)
        setAuthError(error.message)
        setUser(null)
      } else {
        setUser(session?.user ?? null)
        setAuthError(null)
        console.log('✅ Session refreshed successfully')
        lastTokenCheck.current = Date.now()
      }
    } catch (error: any) {
      console.error('Auth session refresh exception:', error)
      setAuthError('Failed to refresh session')
      setUser(null)
    } finally {
      isRefreshing.current = false
      setLoading(false)
    }
  }

  // Force token refresh to handle expired tokens after long suspension
  const forceTokenRefresh = async (): Promise<boolean> => {
    try {
      console.log('🔄 Forcing token refresh...')
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('Force token refresh error:', error)
        return false
      }
      
      if (data?.session) {
        console.log('✅ Token refreshed successfully')
        setUser(data.session.user)
        lastTokenCheck.current = Date.now()
        return true
      }
      
      console.log('⚠️ No session returned from token refresh')
      return false
    } catch (error) {
      console.error('Force token refresh exception:', error)
      return false
    }
  }

  // Handle recovery after long suspension (more than 60 seconds)
  const handleLongSuspensionRecovery = async (): Promise<boolean> => {
    try {
      console.log('🔄 Handling long suspension recovery...')
      
      // Check if recovery is already in progress globally
      if (recoveryManager.isRecoveryInProgress()) {
        console.log('🔄 Global recovery already in progress, skipping auth recovery')
        return false
      }
      
      // First, try force reconnect through Supabase client
      if (typeof supabase._forceReconnect === 'function') {
        const reconnected = await supabase._forceReconnect()
        if (reconnected) {
          console.log('✅ Complete reconnection through Supabase client')
          // Refresh session to update UI
          await refreshSession()
          return true
        }
      }
      
      // Fallback to force token refresh
      if (typeof supabase._forceTokenRefresh === 'function') {
        const tokenRefreshed = await supabase._forceTokenRefresh()
        if (tokenRefreshed) {
          console.log('✅ Token refreshed through Supabase client')
          // Refresh session to update UI
          await refreshSession()
          return true
        }
      }
      
      // Final fallback to direct force refresh
      const success = await forceTokenRefresh()
      if (success) {
        console.log('✅ Token refreshed through auth provider')
        return true
      }
      
      console.log('⚠️ Failed to refresh token during long suspension recovery')
      return false
    } catch (error) {
      console.error('Error during long suspension recovery:', error)
      return false
    }
  }

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
          if (session) {
            lastTokenCheck.current = Date.now()
          }
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
      
      // Detailed token debugging
      if (session?.access_token) {
        const tokenExpiry = new Date(session.expires_at! * 1000)
        const now = new Date()
        const timeUntilExpiry = tokenExpiry.getTime() - now.getTime()
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60))
        
        console.log('🔑 Token Debug:', {
          event,
          hasToken: !!session.access_token,
          tokenLength: session.access_token.length,
          expiresAt: tokenExpiry.toISOString(),
          timeUntilExpiry: `${minutesUntilExpiry} minutes`,
          isExpired: timeUntilExpiry < 0,
          hasRefreshToken: !!session.refresh_token
        })
      }
      
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
        
        // Handle session expiration
        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Session token refreshed')
          lastTokenCheck.current = Date.now()
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out')
        }
      } catch (error: any) {
        console.error('Auth state change error:', error)
        setAuthError(error.message)
      }
    })

    // Handle page visibility changes to recover from browser suspension
    const handleVisibilityChange = async () => {
      const now = Date.now()
      lastVisibilityChange.current = now
      
      if (!document.hidden && !loading) {
        console.log('Page visible - checking auth state and token validity')
        
        // Check if this was a long suspension
        const timeSinceLastCheck = now - lastTokenCheck.current
        const timeSinceLastVisibility = now - lastVisibilityChange.current
        
        // If was hidden for more than 60 seconds, it's a long suspension
        if (timeSinceLastVisibility > 60000) {
          console.log('Long suspension detected, initiating comprehensive recovery')
          const recoverySuccess = await handleLongSuspensionRecovery()
          if (!recoverySuccess) {
            console.warn('Failed to recover from long suspension')
          }
        }
        // Check if token might be expired (more than 1 hour since last check)
        else if (lastTokenCheck.current > 0 && timeSinceLastCheck > 3600000) { // 1 hour
          console.log('Token may be expired, forcing refresh')
          const success = await forceTokenRefresh()
          if (!success) {
            console.warn('Failed to refresh expired token')
          }
        }
        // Standard refresh for shorter suspensions
        else {
          refreshSession()
        }
      }
    }

    // Handle Supabase recovery events
    const handleSupabaseRecovered = () => {
      console.log('Supabase recovered - refreshing session')
      refreshSession()
    }

    // Handle Supabase recovery failure
    const handleSupabaseRecoveryFailed = async () => {
      console.log('Supabase recovery failed - attempting force reconnect')
      const success = await handleLongSuspensionRecovery()
      if (!success) {
        console.error('All recovery attempts failed')
        setAuthError('Connection lost. Please refresh the page.')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('supabaseRecovered', handleSupabaseRecovered)
    window.addEventListener('supabaseRecoveryFailed', handleSupabaseRecoveryFailed)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('supabaseRecovered', handleSupabaseRecovered)
      window.removeEventListener('supabaseRecoveryFailed', handleSupabaseRecoveryFailed)
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
    refreshSession,
    forceTokenRefresh, // Expose forceTokenRefresh method
    handleLongSuspensionRecovery // Expose long suspension recovery method
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