import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a singleton instance with connection recovery options
export const supabase: SupabaseClient & { 
  _recoverConnection?: () => Promise<boolean>,
  _isRecovering?: boolean,
  _lastTokenCheck?: number,
  _forceTokenRefresh?: () => Promise<boolean>,
  _forceReconnect?: () => Promise<boolean>
} = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable automatic token refresh
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    // Add headers to help with debugging
    headers: {
      'X-Client-Info': 'content-summarizer'
    }
  },
  realtime: {
    // Configure realtime options for better connection handling
    heartbeatInterval: 30000, // 30 seconds
    timeout: 60000, // 60 seconds
  }
})

// Add connection recovery method
supabase._recoverConnection = async function() {
  try {
    // Prevent multiple concurrent recovery attempts
    if (this._isRecovering) {
      console.log('Recovery already in progress, skipping')
      return false
    }
    
    this._isRecovering = true
    console.log('🔄 Attempting Supabase connection recovery...')
    
    // First, try to refresh session
    console.log('Refreshing session to ensure token validity...')
    const { data: { session: refreshedSession }, error: refreshError } = await this.auth.refreshSession()
    
    if (refreshError) {
      console.error('❌ Error refreshing session:', refreshError)
      this._isRecovering = false
      return false
    }
    
    if (refreshedSession) {
      console.log('✅ Session refreshed successfully with new token')
      console.log('New token expires at:', refreshedSession.expires_at)
    } else {
      console.log('⚠️ No active session found after refresh')
    }
    
    // Force realtime reconnection by disconnecting and reconnecting
    try {
      console.log('🔄 Forcing realtime reconnection...')
      await this.realtime.disconnect()
      
      // Wait a bit for disconnection to complete
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Reconnect realtime
      await this.realtime.connect()
      console.log('✅ Realtime reconnected successfully')
    } catch (realtimeError) {
      console.warn('⚠️ Realtime reconnection failed:', realtimeError)
      // Don't fail the entire recovery for realtime issues
    }
    
    this._isRecovering = false
    this._lastTokenCheck = Date.now()
    return true
  } catch (error) {
    console.error('❌ Exception during connection recovery:', error)
    this._isRecovering = false
    return false
  }
}

// Add force token refresh method for expired tokens after long suspension
supabase._forceTokenRefresh = async function() {
  try {
    console.log('🔄 Forcing token refresh for long suspension recovery...')
    
    // Get current session first
    const { data: { session: currentSession } } = await this.auth.getSession()
    
    // If we have a session, try to refresh it
    if (currentSession) {
      console.log('Current session expires at:', currentSession.expires_at)
      
      // Force refresh regardless of expiration status
      const { data: { session: refreshedSession }, error } = await this.auth.refreshSession()
      
      if (error) {
        console.error('❌ Error during forced token refresh:', error)
        return false
      }
      
      if (refreshedSession) {
        console.log('✅ Token refreshed successfully')
        console.log('New token expires at:', refreshedSession.expires_at)
        this._lastTokenCheck = Date.now()
        return true
      }
    }
    
    console.log('⚠️ No active session to refresh')
    return false
  } catch (error) {
    console.error('❌ Exception during forced token refresh:', error)
    return false
  }
}

// Add comprehensive connection recovery method
supabase._forceReconnect = async function() {
  try {
    console.log('🔄 Forcing complete Supabase reconnection...')
    
    // Reset recovery flag to allow new recovery attempts
    this._isRecovering = false
    
    // Disconnect realtime completely
    try {
      await this.realtime.disconnect()
      console.log('✅ Realtime disconnected')
    } catch (e) {
      console.warn('⚠️ Error disconnecting realtime:', e)
    }
    
    // Wait for disconnection to complete
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Refresh session
    const { data: { session }, error: sessionError } = await this.auth.refreshSession()
    if (sessionError) {
      console.error('❌ Session refresh failed:', sessionError)
      return false
    }
    
    // Reconnect realtime
    try {
      await this.realtime.connect()
      console.log('✅ Realtime reconnected')
    } catch (realtimeError) {
      console.error('❌ Realtime reconnection failed:', realtimeError)
      return false
    }
    
    this._lastTokenCheck = Date.now()
    console.log('✅ Complete reconnection successful')
    return true
  } catch (error) {
    console.error('❌ Exception during force reconnection:', error)
    return false
  }
}

// Types for our database
export interface User {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
  last_login?: string
  is_active: boolean
}

export interface Summary {
  id: string
  user_id: string
  youtube_url: string
  video_id: string
  video_title?: string
  video_duration?: number
  transcript_text?: string
  summary_text: string
  processing_time?: number
  created_at: string
  is_favorite: boolean
  tags?: string[]
}

export interface UsageStats {
  id: string
  user_id: string
  action: string
  summary_id?: string
  metadata?: Record<string, any>
  created_at: string
}