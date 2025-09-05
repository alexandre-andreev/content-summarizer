'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UrlForm } from '@/components/url-form'
import { SummaryDisplay } from '@/components/summary-display'
import { BrowserTabManager } from '@/components/browser-tab-manager'
import { 
  BarChart3, 
  FileText, 
  Heart, 
  Calendar,
  LogOut,
  User,
  History
} from 'lucide-react'
import type { Summary } from '@/lib/supabase/client'

interface DashboardData {
  totalSummaries: number
  recentSummaries: Summary[]
  favoriteCount: number
  thisWeekCount: number
}

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [videoTitle, setVideoTitle] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [canSave, setCanSave] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastGeneratedSummary, setLastGeneratedSummary] = useState<{
    videoUrl: string;
    videoId: string;
    videoTitle: string;
    summaryText: string;
    processingTime: number;
  } | null>(null)
  const [isTabVisible, setIsTabVisible] = useState(true)

  // Background save function
  const saveSummaryToDatabase = async (summaryData: {
    youtube_url: string
    video_id: string
    video_title: string
    summary_text: string
    processing_time: number
  }, accessToken: string): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, 10000) // 10 second timeout for background save
      
      const saveResponse = await fetch('/api/save-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(summaryData),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (saveResponse.ok) {
        const result = await saveResponse.json()
        console.log('Background save successful:', result.summary?.id)
        return true
      } else {
        const errorData = await saveResponse.json()
        console.error('Background save failed:', errorData)
        return false
      }
    } catch (error: any) {
      console.error('Background save error:', error.message)
      return false
    }
  }

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // Load summaries when user is available or filters change
  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  // Restore summary from localStorage if available (for Hot Reload recovery)
  useEffect(() => {
    const lastSummary = localStorage.getItem('lastSummary')
    const lastVideoTitle = localStorage.getItem('lastVideoTitle')
    const lastSummaryTime = localStorage.getItem('lastSummaryTime')
    
    if (lastSummary && lastSummaryTime) {
      const timeDiff = Date.now() - parseInt(lastSummaryTime)
      // If summary was generated less than 5 minutes ago, restore it
      if (timeDiff < 5 * 60 * 1000) {
        console.log('Restoring summary and title from localStorage')
        setSummary(lastSummary)
        setVideoTitle(lastVideoTitle || 'Видео YouTube')
      } else {
        // Clean up old summary
        localStorage.removeItem('lastSummary')
        localStorage.removeItem('lastVideoTitle')
        localStorage.removeItem('lastSummaryTime')
      }
    }
  }, [])

  // Handle tab visibility changes to prevent browser suspension issues
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      setIsTabVisible(isVisible)
      
      if (isVisible) {
        console.log('Tab became visible - checking app state')
        
        // If tab was hidden and now visible, refresh data if needed
        if (user && !loading && !isProcessing) {
          console.log('Refreshing dashboard data after tab became visible')
          loadDashboardData(true)
        }
      } else {
        console.log('Tab became hidden')
      }
    }

    // Also handle window focus/blur for additional browser support
    const handleFocus = () => {
      console.log('Window focused - ensuring app is responsive')
      if (user && !loading && !isProcessing) {
        // Small delay to allow browser to stabilize
        setTimeout(() => {
          console.log('Performing focus recovery check')
          loadDashboardData(true)
        }, 100)
      }
    }

    const handleBlur = () => {
      console.log('Window blurred')
    }

    // Handle corruption events from BrowserTabManager
    const handlePageCorrupted = (event: CustomEvent) => {
      console.error('🚨 Dashboard page corruption detected:', event.detail)
      // Simple recovery - just reload dashboard data
      loadDashboardData(true)
    }

    const handlePageSlow = (event: CustomEvent) => {
      console.warn('⚠️ Dashboard page performance degraded:', event.detail)
      if (user && !loading && !isProcessing) {
        loadDashboardData(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('pageCorrupted', handlePageCorrupted as EventListener)
    window.addEventListener('pageSlow', handlePageSlow as EventListener)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('pageCorrupted', handlePageCorrupted as EventListener)
      window.removeEventListener('pageSlow', handlePageSlow as EventListener)
    }
  }, [user, loading, isProcessing])

  const loadDashboardData = async (isRefresh = false) => {
    if (!user) return

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      console.log('Loading dashboard data via API for user:', user.id)
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Нет активной сессии пользователя')
      }

      // Call the optimized dashboard API endpoint
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, 10000) // 10 second client-side timeout

      const response = await fetch('/api/dashboard', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Dashboard API error:', errorData)
        
        // Set default data even on error to keep UI functional
        setDashboardData({
          totalSummaries: 0,
          recentSummaries: [],
          favoriteCount: 0,
          thisWeekCount: 0
        })
        
        setError(errorData.error || 'Ошибка загрузки данных панели')
        return
      }

      const result = await response.json()
      console.log('Dashboard API response received:', result)
      
      if (result.success && result.data) {
        console.log('Setting dashboard data from API:', {
          totalSummaries: result.data.totalSummaries,
          recentSummaries: result.data.recentSummaries?.length || 0,
          favoriteCount: result.data.favoriteCount,
          thisWeekCount: result.data.thisWeekCount
        })
        setDashboardData(result.data)
        setError(null) // Clear any previous errors
      } else {
        // Even if not successful, use the provided data to keep UI functional
        setDashboardData(result.data || {
          totalSummaries: 0,
          recentSummaries: [],
          favoriteCount: 0,
          thisWeekCount: 0
        })
        setError(result.error || 'Неизвестная ошибка API панели управления')
      }
      
    } catch (err: any) {
      console.error('Error loading dashboard data via API:', err)
      
      // Set empty data to allow UI to remain functional
      setDashboardData({
        totalSummaries: 0,
        recentSummaries: [],
        favoriteCount: 0,
        thisWeekCount: 0
      })
      
      if (err.name === 'AbortError') {
        setError('Превышено время ожидания загрузки данных панели')
      } else {
        setError(err.message || 'Не удалось загрузить данные панели управления')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleSummarize = async (videoUrl: string) => {
    if (!user) return

    setIsProcessing(true)
    setSummaryError(null)
    setSummary(null)
    setVideoTitle(null)
    setCanSave(false) // Reset save button state
    setLastGeneratedSummary(null) // Clear previous summary data

    const startTime = Date.now()

    try {
      console.log('Starting summarization for:', videoUrl)
      
      // Call the API to generate summary with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn('Summarization taking too long, aborting...')
        controller.abort()
      }, 150000) // 2.5 minutes client-side timeout

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      console.log('API response status:', response.status)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'An unknown error occurred.')
      }
      
      const data = await response.json()
      console.log('API response data received')
      console.log('Title:', data.title || 'No title')
      console.log('Summary text length:', data.summary?.length || 0)

      // Set title and summary immediately after receiving them - SHOW TO USER FIRST
      console.log('Setting title and summary in state immediately')
      setVideoTitle(data.title || 'Видео YouTube')
      setSummary(data.summary)
      
      // Store in localStorage as backup against Hot Reload
      localStorage.setItem('lastSummary', data.summary)
      localStorage.setItem('lastVideoTitle', data.title || 'Видео YouTube')
      localStorage.setItem('lastSummaryTime', Date.now().toString())

      const processingTime = Date.now() - startTime
      console.log('Processing time:', processingTime, 'ms')

      // Extract video ID for storage
      const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || ''
      console.log('Extracted video ID:', videoId)

      // Store summary data for later saving, enable save button
      setLastGeneratedSummary({
        videoUrl,
        videoId,
        videoTitle: data.title || 'Видео YouTube',
        summaryText: data.summary,
        processingTime
      })
      setCanSave(true)
      
      console.log('Summary ready for saving - user can now click Save button')



    } catch (err: any) {
      console.error('Error in handleSummarize:', err)
      
      if (err.name === 'AbortError') {
        setSummaryError('The request took too long and was cancelled. Please try again with a shorter video.')
      } else {
        setSummaryError(err.message)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleSaveToHistory = async () => {
    if (!lastGeneratedSummary || !user || isSaving) return

    setIsSaving(true)
    console.log('Saving summary to database and updating dashboard...')

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('No session token available')
        return
      }

      // Save summary to database
      const success = await saveSummaryToDatabase({
        youtube_url: lastGeneratedSummary.videoUrl,
        video_id: lastGeneratedSummary.videoId,
        video_title: lastGeneratedSummary.videoTitle,
        summary_text: lastGeneratedSummary.summaryText,
        processing_time: lastGeneratedSummary.processingTime
      }, session.access_token)

      if (success) {
        console.log('Summary saved successfully')
        
        // Refresh dashboard data to update stats and recent summaries
        await loadDashboardData(true)
        
        // Reset save state
        setCanSave(false)
        setLastGeneratedSummary(null)
        
        console.log('Dashboard updated with new summary')
      } else {
        console.error('Failed to save summary')
      }
    } catch (error) {
      console.error('Error saving summary:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <BrowserTabManager />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Добро пожаловать, {user.user_metadata?.display_name || user.email}
            </h1>
            
          </div>
          <div className="flex items-center gap-4">
            {/* Removed manual refresh button - it doesn't work properly */}
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {error && (
            <div className="col-span-4 mb-4">
              <Alert variant="destructive">
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {loading && !dashboardData ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))
          ) : dashboardData ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Получено описаний</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.totalSummaries}</div>
                  <p className="text-xs text-muted-foreground">За все время</p>
                </CardContent>
              </Card>



              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">В избранном</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.favoriteCount}</div>
                  <p className="text-xs text-muted-foreground">Отмечено</p>
                </CardContent>
              </Card>


            </>
          ) : null}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create New Summary */}
          <div className="lg:col-span-2 space-y-6">
            <UrlForm onSubmit={handleSummarize} isLoading={isProcessing} />

            <SummaryDisplay 
              summary={summary} 
              videoTitle={videoTitle}
              error={summaryError} 
              isLoading={isProcessing}
              canSave={canSave}
              isSaving={isSaving}
              onSave={handleSaveToHistory}
            />
          </div>

          {/* Recent Summaries */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Последние описания видео</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))
                ) : dashboardData?.recentSummaries.length ? (
                  dashboardData.recentSummaries.map((summary) => (
                    <div key={summary.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <h4 className="font-medium text-sm line-clamp-2">
                        {summary.video_title || 'YouTube Video'}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(summary.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {summary.summary_text.substring(0, 100)}...
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No summaries yet. Create your first one above!
                  </p>
                )}

                {dashboardData?.recentSummaries.length ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/dashboard/history')}
                  >
                    Посмотреть все описания
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}