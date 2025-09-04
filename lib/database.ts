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

      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        console.error('Database: No active session for summary creation')
        return { summary: null, error: new Error('Authentication required') }
      }
      
      console.log('Database: User session verified for user:', session.user.id)
      
      // Ensure the summary belongs to the authenticated user
      if (summary.user_id !== session.user.id) {
        console.error('Database: User ID mismatch - session user:', session.user.id, 'summary user:', summary.user_id)
        return { summary: null, error: new Error('User authentication mismatch') }
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
      
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Dashboard data timeout after 15 seconds')), 15000)
      })

      const dataPromise = (async () => {
        // Get total summaries count
        const { count: totalSummaries, error: countError } = await supabase
          .from('summaries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)

        if (countError) throw countError

        // Get recent summaries (last 5)
        const { data: recentSummaries, error: recentError } = await supabase
          .from('summaries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5)

        if (recentError) throw recentError

        // Get favorite count
        const { count: favoriteCount, error: favoriteError } = await supabase
          .from('summaries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_favorite', true)

        if (favoriteError) throw favoriteError

        // Get this week's count
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

        const { count: thisWeekCount, error: weekError } = await supabase
          .from('summaries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', oneWeekAgo.toISOString())

        if (weekError) throw weekError

        return {
          totalSummaries: totalSummaries || 0,
          recentSummaries: recentSummaries || [],
          favoriteCount: favoriteCount || 0,
          thisWeekCount: thisWeekCount || 0,
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