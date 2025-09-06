import { supabase } from '@/lib/supabase/client'
import type { Summary, User, UsageStats } from '@/lib/supabase/client'

// Helper function to check if Supabase connection is healthy
const isSupabaseConnected = async (): Promise<boolean> => {
  try {
    // Simple health check - try to get the current user
    const { data: { user }, error } = await supabase.auth.getUser()
    return !error && !!user
  } catch (err) {
    console.warn('Supabase connection health check failed:', err)
    return false
  }
}

// Helper function to recover Supabase connection
const recoverSupabaseConnection = async (): Promise<boolean> => {
  try {
    console.log('Attempting to recover Supabase connection...')
    
    // Check if recovery method exists
    if (typeof supabase._recoverConnection === 'function') {
      const success = await supabase._recoverConnection()
      if (success) {
        console.log('✅ Supabase connection recovered successfully')
        return true
      } else {
        console.error('❌ Failed to recover Supabase connection')
        return false
      }
    }
    
    // Fallback: try to refresh session
    const { error } = await supabase.auth.refreshSession()
    if (error) {
      console.error('❌ Failed to refresh session:', error)
      return false
    }
    
    console.log('✅ Session refreshed successfully')
    return true
  } catch (err) {
    console.error('❌ Exception during connection recovery:', err)
    return false
  }
}

// Enhanced helper function to handle long suspension recovery
const handleLongSuspensionRecovery = async (): Promise<boolean> => {
  try {
    console.log('Attempting long suspension recovery...')
    
    // Try force token refresh through Supabase client
    if (typeof supabase._forceTokenRefresh === 'function') {
      const tokenRefreshed = await supabase._forceTokenRefresh()
      if (tokenRefreshed) {
        console.log('✅ Token refreshed through Supabase client during long suspension recovery')
        return true
      }
    }
    
    // Fallback to standard recovery
    return await recoverSupabaseConnection()
  } catch (err) {
    console.error('❌ Exception during long suspension recovery:', err)
    return false
  }
}

export const databaseService = {
  // User operations
  async getUserProfile(userId: string): Promise<{ user: User | null; error: any }> {
    try {
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { user: null, error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      return { user, error }
    } catch (error) {
      console.error('Database: Error getting user profile:', error)
      return { user: null, error }
    }
  },

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<{ user: User | null; error: any }> {
    try {
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { user: null, error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      const { data: user, error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single()
      
      return { user, error }
    } catch (error) {
      console.error('Database: Error updating user profile:', error)
      return { user: null, error }
    }
  },

  // Summary operations
  async createSummary(summary: Omit<Summary, 'id' | 'created_at'>): Promise<{ summary: Summary | null; error: any }> {
    try {
      console.log('Database: Attempting to create summary with data:', {
        user_id: summary.user_id,
        youtube_url: summary.youtube_url,
        video_id: summary.video_id,
        summary_text_length: summary.summary_text?.length || 0,
        processing_time: summary.processing_time,
        is_favorite: summary.is_favorite
      })

      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { summary: null, error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      // Add timeout to prevent hanging
      const insertPromise = supabase
        .from('summaries')
        .insert(summary)
        .select()
        .single()

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database insert timeout after 10 seconds')), 10000)
      })

      const { data: summaryData, error } = await Promise.race([insertPromise, timeoutPromise]) as any
      
      if (error) {
        console.error('Database: Error creating summary:', error)
        return { summary: null, error }
      }
      
      console.log('Database: Summary created successfully:', summaryData?.id)
      return { summary: summaryData, error: null }
    } catch (err: any) {
      console.error('Database: Exception creating summary:', err.message)
      return { summary: null, error: err }
    }
  },

  async getUserSummaries(
    userId: string, 
    options?: {
      limit?: number
      offset?: number
      search?: string
      sortBy?: 'created_at' | 'video_title'
      sortOrder?: 'asc' | 'desc'
    }
  ): Promise<{ summaries: Summary[]; error: any; count?: number }> {
    try {
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            // Return empty data instead of error to keep UI functional
            return { summaries: [], error: null, count: 0 }
          }
        }
      }

      let query = supabase
        .from('summaries')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)

      // Add search filter
      if (options?.search) {
        query = query.or(`video_title.ilike.%${options.search}%,summary_text.ilike.%${options.search}%`)
      }

      // Add sorting
      const sortBy = options?.sortBy || 'created_at'
      const sortOrder = options?.sortOrder || 'desc'
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Add pagination
      if (options?.limit) {
        query = query.limit(options.limit)
      }
      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
      }

      const { data: summaries, error, count } = await query

      return { summaries: summaries || [], error, count: count || 0 }
    } catch (error) {
      console.error('Database: Error getting user summaries:', error)
      // Return empty data instead of error to keep UI functional
      return { summaries: [], error: null, count: 0 }
    }
  },

  async getSummaryById(summaryId: string, userId: string): Promise<{ summary: Summary | null; error: any }> {
    try {
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { summary: null, error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      const { data: summary, error } = await supabase
        .from('summaries')
        .select('*')
        .eq('id', summaryId)
        .eq('user_id', userId)
        .single()
      
      return { summary, error }
    } catch (error) {
      console.error('Database: Error getting summary by ID:', error)
      return { summary: null, error }
    }
  },

  async updateSummary(
    summaryId: string, 
    userId: string, 
    updates: Partial<Summary>
  ): Promise<{ summary: Summary | null; error: any }> {
    try {
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { summary: null, error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      const { data: summary, error } = await supabase
        .from('summaries')
        .update(updates)
        .eq('id', summaryId)
        .eq('user_id', userId)
        .select()
        .single()
      
      return { summary, error }
    } catch (error) {
      console.error('Database: Error updating summary:', error)
      return { summary: null, error }
    }
  },

  async deleteSummary(summaryId: string, userId: string): Promise<{ error: any }> {
    try {
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      const { error } = await supabase
        .from('summaries')
        .delete()
        .eq('id', summaryId)
        .eq('user_id', userId)
      
      return { error }
    } catch (error) {
      console.error('Database: Error deleting summary:', error)
      return { error }
    }
  },

  async toggleFavorite(summaryId: string, userId: string): Promise<{ summary: Summary | null; error: any }> {
    try {
      // First get the current state
      const { summary: currentSummary, error: fetchError } = await this.getSummaryById(summaryId, userId)
      
      if (fetchError || !currentSummary) {
        return { summary: null, error: fetchError }
      }

      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { summary: null, error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      // Toggle the favorite status
      const { data: summary, error } = await supabase
        .from('summaries')
        .update({ is_favorite: !currentSummary.is_favorite })
        .eq('id', summaryId)
        .eq('user_id', userId)
        .select()
        .single()
      
      return { summary, error }
    } catch (error) {
      console.error('Database: Error toggling favorite:', error)
      return { summary: null, error }
    }
  },

  // Usage analytics
  async trackUsage(stats: Omit<UsageStats, 'id' | 'created_at'>): Promise<{ error: any }> {
    try {
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      const { error } = await supabase
        .from('usage_stats')
        .insert(stats)
      
      return { error }
    } catch (error) {
      console.error('Database: Error tracking usage:', error)
      return { error }
    }
  },

  async getUserStats(userId: string, days: number = 30): Promise<{ stats: any; error: any }> {
    try {
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            return { stats: [], error: new Error('Failed to recover Supabase connection') }
          }
        }
      }

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data: stats, error } = await supabase
        .from('usage_stats')
        .select('action, created_at, metadata')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      return { stats, error }
    } catch (error) {
      console.error('Database: Error getting user stats:', error)
      return { stats: [], error }
    }
  },

  // Dashboard data
  async getDashboardData(userId: string): Promise<{
    totalSummaries: number
    recentSummaries: Summary[]
    favoriteCount: number
    thisWeekCount: number
    error: any
  }> {
    try {
      console.log('Database: Loading dashboard data for user:', userId)
      
      // Check connection health first
      const isConnected = await isSupabaseConnected()
      if (!isConnected) {
        console.warn('Supabase connection not healthy, attempting to recover...')
        const recoverySuccess = await recoverSupabaseConnection()
        if (!recoverySuccess) {
          // Try long suspension recovery for severe cases
          const longRecoverySuccess = await handleLongSuspensionRecovery()
          if (!longRecoverySuccess) {
            // Return default data to keep UI functional
            return {
              totalSummaries: 0,
              recentSummaries: [],
              favoriteCount: 0,
              thisWeekCount: 0,
              error: new Error('Failed to recover Supabase connection')
            }
          }
        }
      }
      
      // Add timeout wrapper - reduced from 15s to 8s for better UX
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Dashboard data timeout after 8 seconds')), 8000)
      })

      const dataPromise = (async () => {
        console.log('Database: Starting dashboard data queries in parallel...')
        
        // Run all queries in parallel for better performance
        const [totalResult, recentResult, favoriteResult, weekResult] = await Promise.all([
          // Get total summaries count
          supabase
            .from('summaries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId),
          
          // Get recent summaries (last 3 for optimal loading)
          supabase
            .from('summaries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3),
          
          // Get favorite count
          supabase
            .from('summaries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_favorite', true),
          
          // Get this week's count
          (() => {
            const oneWeekAgo = new Date()
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
            return supabase
              .from('summaries')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .gte('created_at', oneWeekAgo.toISOString())
          })()
        ])

        // Check for any errors
        if (totalResult.error) {
          console.error('Database: Error getting total count:', totalResult.error)
          throw totalResult.error
        }
        if (recentResult.error) {
          console.error('Database: Error getting recent summaries:', recentResult.error)
          throw recentResult.error
        }
        if (favoriteResult.error) {
          console.error('Database: Error getting favorite count:', favoriteResult.error)
          throw favoriteResult.error
        }
        if (weekResult.error) {
          console.error('Database: Error getting week count:', weekResult.error)
          throw weekResult.error
        }

        console.log('Database: All queries completed successfully')
        console.log('Database: Total summaries count:', totalResult.count)
        console.log('Database: Recent summaries found:', recentResult.data?.length || 0)
        console.log('Database: Favorite summaries count:', favoriteResult.count)
        console.log('Database: This week summaries count:', weekResult.count)

        return {
          totalSummaries: totalResult.count || 0,
          recentSummaries: recentResult.data || [],
          favoriteCount: favoriteResult.count || 0,
          thisWeekCount: weekResult.count || 0,
          error: null
        }
      })()

      const result = await Promise.race([dataPromise, timeoutPromise])
      console.log('Database: Dashboard data loaded successfully')
      return result as any
      
    } catch (error) {
      console.error('Database: Error loading dashboard data:', error)
      // Return default data to keep UI functional
      return {
        totalSummaries: 0,
        recentSummaries: [],
        favoriteCount: 0,
        thisWeekCount: 0,
        error
      }
    }
  }
}