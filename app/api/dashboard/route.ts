import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(req: NextRequest) {
  try {
    console.log('=== DASHBOARD API STARTED ===')
    
    // Get the authorization header
    const authHeader = req.headers.get('authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No authorization token provided')
      return NextResponse.json({ error: 'Токен авторизации не предоставлен' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('Token length:', token.length)
    
    // Verify the token with the regular Supabase client
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    console.log('Supabase client created for token verification')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('❌ Token verification failed:', authError?.message || 'No user found')
      return NextResponse.json({ 
        error: 'Недействительный токен авторизации', 
        details: authError?.message 
      }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    // Implement 8-second timeout as per memory requirements
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 8000)

    try {
      console.log('📊 Starting optimized dashboard data queries...')
      
      // Use Promise.all for parallel execution as per memory requirements
      const [totalResult, recentResult, favoriteResult, weekResult] = await Promise.all([
        // Get total summaries count
        supabaseAdmin
          .from('summaries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .abortSignal(controller.signal),
        
        // Get recent summaries (last 5)
        supabaseAdmin
          .from('summaries')
          .select('id, youtube_url, video_id, video_title, summary_text, created_at, is_favorite, processing_time')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
          .abortSignal(controller.signal),
        
        // Get favorite count
        supabaseAdmin
          .from('summaries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_favorite', true)
          .abortSignal(controller.signal),
        
        // Get this week's count
        (() => {
          const oneWeekAgo = new Date()
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
          return supabaseAdmin
            .from('summaries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', oneWeekAgo.toISOString())
            .abortSignal(controller.signal)
        })()
      ])

      clearTimeout(timeoutId)

      // Check for any errors
      if (totalResult.error) {
        console.error('❌ Error getting total count:', totalResult.error)
        throw totalResult.error
      }
      if (recentResult.error) {
        console.error('❌ Error getting recent summaries:', recentResult.error)
        throw recentResult.error
      }
      if (favoriteResult.error) {
        console.error('❌ Error getting favorite count:', favoriteResult.error)
        throw favoriteResult.error
      }
      if (weekResult.error) {
        console.error('❌ Error getting week count:', weekResult.error)
        throw weekResult.error
      }

      console.log('✅ All dashboard queries completed successfully')
      console.log('📈 Dashboard stats:', {
        total: totalResult.count,
        recent: recentResult.data?.length,
        favorites: favoriteResult.count,
        thisWeek: weekResult.count
      })

      const dashboardData = {
        totalSummaries: totalResult.count || 0,
        recentSummaries: recentResult.data || [],
        favoriteCount: favoriteResult.count || 0,
        thisWeekCount: weekResult.count || 0
      }

      return NextResponse.json({
        success: true,
        data: dashboardData
      })

    } catch (queryError: any) {
      clearTimeout(timeoutId)
      
      if (queryError.name === 'AbortError') {
        console.error('❌ Dashboard queries timed out after 8 seconds')
        return NextResponse.json({ 
          error: 'Превышено время ожидания загрузки данных (8 секунд)',
          data: {
            totalSummaries: 0,
            recentSummaries: [],
            favoriteCount: 0,
            thisWeekCount: 0
          }
        }, { status: 408 })
      }
      
      console.error('❌ Database query error:', queryError)
      return NextResponse.json({ 
        error: 'Ошибка загрузки данных панели управления',
        details: queryError.message,
        data: {
          totalSummaries: 0,
          recentSummaries: [],
          favoriteCount: 0,
          thisWeekCount: 0
        }
      }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('❌ Unexpected error in dashboard API:', error)
    return NextResponse.json({ 
      error: 'Внутренняя ошибка сервера',
      details: error.message,
      data: {
        totalSummaries: 0,
        recentSummaries: [],
        favoriteCount: 0,
        thisWeekCount: 0
      }
    }, { status: 500 })
  }
}