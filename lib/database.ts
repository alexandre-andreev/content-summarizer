import { supabase } from '@/lib/supabase/client'
import type { Summary, User, UsageStats } from '@/lib/supabase/client'

export const databaseService = {
  // User operations
  async getUserProfile(userId: string): Promise<{ user: User | null; error: any }> {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    return { user, error }
  },

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<{ user: User | null; error: any }> {
    const { data: user, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()
    
    return { user, error }
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
  },

  async getSummaryById(summaryId: string, userId: string): Promise<{ summary: Summary | null; error: any }> {
    const { data: summary, error } = await supabase
      .from('summaries')
      .select('*')
      .eq('id', summaryId)
      .eq('user_id', userId)
      .single()
    
    return { summary, error }
  },

  async updateSummary(
    summaryId: string, 
    userId: string, 
    updates: Partial<Summary>
  ): Promise<{ summary: Summary | null; error: any }> {
    const { data: summary, error } = await supabase
      .from('summaries')
      .update(updates)
      .eq('id', summaryId)
      .eq('user_id', userId)
      .select()
      .single()
    
    return { summary, error }
  },

  async deleteSummary(summaryId: string, userId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('summaries')
      .delete()
      .eq('id', summaryId)
      .eq('user_id', userId)
    
    return { error }
  },

  async toggleFavorite(summaryId: string, userId: string): Promise<{ summary: Summary | null; error: any }> {
    // First get the current state
    const { summary: currentSummary, error: fetchError } = await this.getSummaryById(summaryId, userId)
    
    if (fetchError || !currentSummary) {
      return { summary: null, error: fetchError }
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
  },

  // Usage analytics
  async trackUsage(stats: Omit<UsageStats, 'id' | 'created_at'>): Promise<{ error: any }> {
    const { error } = await supabase
      .from('usage_stats')
      .insert(stats)
    
    return { error }
  },

  async getUserStats(userId: string, days: number = 30): Promise<{ stats: any; error: any }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: stats, error } = await supabase
      .from('usage_stats')
      .select('action, created_at, metadata')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    return { stats, error }
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