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
    const { data: summaryData, error } = await supabase
      .from('summaries')
      .insert(summary)
      .select()
      .single()
    
    return { summary: summaryData, error }
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
    } catch (error) {
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