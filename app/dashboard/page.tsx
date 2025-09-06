'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UrlForm, type UrlFormRef } from '@/components/url-form'
import { SummaryDisplay } from '@/components/summary-display'
import { BrowserTabManager } from '@/components/browser-tab-manager'
import { recoveryManager } from '@/lib/utils/recovery-manager'
import { 
  BarChart3, 
  Calendar,
  LogOut,
  User,
  History
} from 'lucide-react'
import type { Summary } from '@/lib/supabase/client'

interface DashboardData {
  totalSummaries: number
  favoriteCount: number
}

export default function DashboardPage() {
  const { user, loading: authLoading, signOut, refreshSession, forceTokenRefresh, handleLongSuspensionRecovery } = useAuth()
  const router = useRouter()
  const urlFormRef = useRef<UrlFormRef>(null)
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastGeneratedSummary, setLastGeneratedSummary] = useState<{
    videoUrl: string;
    videoId: string;
    videoTitle: string;
    summaryText: string;
    processingTime: number;
  } | null>(null)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [recoveryAttempted, setRecoveryAttempted] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const lastHealthCheck = useRef<number>(0)
  const lastLoadTime = useRef<number>(0)
  const recoveryTimeout = useRef<NodeJS.Timeout | null>(null)

  // Background save function
  const saveSummaryToDatabase = async (summaryData: {
    youtube_url: string
    video_id: string
    video_title: string
    summary_text: string
    processing_time: number
  }, accessToken: string, timeoutMs: number = 25000): Promise<boolean> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeoutMs)
      
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
      if (error.name === 'AbortError') {
        throw error // Re-throw AbortError so it can be caught by caller
      }
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

  // Track navigation state
  useEffect(() => {
    const handleRouteChangeStart = () => {
      console.log('🔄 Dashboard: Navigation started')
      setIsNavigating(true)
    }

    const handleRouteChangeComplete = () => {
      console.log('🔄 Dashboard: Navigation completed')
      setTimeout(() => {
        setIsNavigating(false)
      }, 1000) // Small delay to prevent conflicts
    }

    // Listen for route changes
    window.addEventListener('beforeunload', handleRouteChangeStart)
    window.addEventListener('load', handleRouteChangeComplete)

    return () => {
      window.removeEventListener('beforeunload', handleRouteChangeStart)
      window.removeEventListener('load', handleRouteChangeComplete)
    }
  }, [])

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
    const handleTabVisibilityChange = () => {
      const isVisible = !document.hidden
      setIsTabVisible(isVisible)
      
      if (isVisible) {
        console.log('🔄 Dashboard: Tab became visible - checking app state')
        
        // Add small delay to prevent conflicts with other pages
        setTimeout(() => {
          // If tab was hidden and now visible, refresh data if needed
          if (user && !loading && !isProcessing && !recoveryAttempted) {
            console.log('🔄 Dashboard: Refreshing data after tab became visible')
            setRecoveryAttempted(true)
            loadDashboardData(true)
          }
        }, 200) // Small delay to prevent conflicts
      } else {
        console.log('🔄 Dashboard: Tab became hidden')
        setRecoveryAttempted(false) // Reset recovery flag when tab is hidden
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

    const handlePageSlow = async (event: CustomEvent) => {
      console.warn('⚠️ Dashboard page performance degraded:', event.detail)
      
      // If we haven't attempted recovery yet, try to recover
      if (!recoveryAttempted && user && !loading && !isProcessing) {
        setRecoveryAttempted(true)
        console.log('Attempting recovery due to slow page performance')
        
        // Try to refresh the session
        try {
          await refreshSession()
          console.log('Session refreshed, reloading dashboard data')
          await loadDashboardData(true)
        } catch (error) {
          console.error('Error during recovery attempt:', error)
        }
      }
    }

    // Handle simple recovery events
    const handleSimpleRecovery = () => {
      console.log('🔄 Dashboard: Simple recovery - refreshing data')
      if (user && !loading && !isProcessing) {
        console.log('🔄 Dashboard: Loading data after simple recovery')
        loadDashboardData(true)
      }
    }


    // Handle recovery failure
    const handleRecoveryFailed = () => {
      console.log('❌ Dashboard: Recovery failed - showing error')
      setError('Connection lost. Please refresh the page.')
    }

    // Handle Supabase recovery failure
    const handleSupabaseRecoveryFailed = async () => {
      console.log('❌ Dashboard: Supabase recovery failed - attempting comprehensive recovery')
      try {
        const recoverySuccess = await handleLongSuspensionRecovery()
        if (recoverySuccess) {
          console.log('✅ Dashboard: Recovery successful')
          setTimeout(() => {
            if (user && !loading && !isProcessing) {
              loadDashboardData(true)
            }
          }, 1000) // Longer delay for comprehensive recovery
        } else {
          console.error('❌ Dashboard: Recovery failed')
          setError('Connection lost. Please refresh the page.')
        }
      } catch (error) {
        console.error('Error during dashboard recovery:', error)
        setError('Connection lost. Please refresh the page.')
      }
    }


    // Handle comprehensive recovery for frozen pages with debouncing
    const handleComprehensiveRecovery = async (event: CustomEvent) => {
      console.log('🔄 Dashboard: Comprehensive recovery initiated:', event.detail)
      
      // Clear any existing timeout
      if (recoveryTimeout.current) {
        clearTimeout(recoveryTimeout.current)
      }
      
      // Add delay to prevent conflicts with other pages
      recoveryTimeout.current = setTimeout(async () => {
        try {
          // Check if recovery is already in progress globally
          if (recoveryManager.isRecoveryInProgress()) {
            console.log('🔄 Dashboard: Global recovery in progress, skipping local recovery')
            return
          }
          
          const recoverySuccess = await handleLongSuspensionRecovery()
          console.log('🔄 Dashboard: Long suspension recovery result:', recoverySuccess)
          
          // Refresh dashboard data with additional delay
          if (user && !loading && !isProcessing && !recoveryAttempted && !isNavigating) {
            console.log('🔄 Dashboard: Refreshing data after comprehensive recovery')
            setRecoveryAttempted(true)
            await loadDashboardData(true)
          } else if (isNavigating) {
            console.log('🔄 Dashboard: Navigation in progress, skipping comprehensive recovery')
          }
        } catch (error) {
          console.error('Error during comprehensive recovery:', error)
        }
      }, 2000) // Longer delay for comprehensive recovery
    }

    document.addEventListener('visibilitychange', handleTabVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('simpleRecovery', handleSimpleRecovery)
    window.addEventListener('recoveryFailed', handleRecoveryFailed)

    return () => {
      document.removeEventListener('visibilitychange', handleTabVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('simpleRecovery', handleSimpleRecovery)
      window.removeEventListener('recoveryFailed', handleRecoveryFailed)
      
      // Clear recovery timeout
      if (recoveryTimeout.current) {
        clearTimeout(recoveryTimeout.current)
      }
      
      // Clear intervals
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current)
      }
    }
  }, [user, loading, isProcessing, refreshSession, recoveryAttempted, forceTokenRefresh, handleLongSuspensionRecovery, isNavigating])

  // Add periodic health check for dashboard with improved logic
  useEffect(() => {
    // Check dashboard health every 30 seconds
    healthCheckInterval.current = setInterval(() => {
      const now = Date.now()
      
      // Skip health check if we just did one (within 25 seconds)
      if (now - lastHealthCheck.current < 25000) {
        return
      }
      
      lastHealthCheck.current = now
      
      if (user && !document.hidden && !loading && !isProcessing) {
        // Simple health check - verify we can still get session
        supabase.auth.getSession()
          .then(({ data, error }) => {
            if (error) {
              console.warn('Dashboard health check failed:', error)
              // Trigger recovery
              loadDashboardData(true)
            }
          })
          .catch(err => {
            console.warn('Dashboard health check error:', err)
          })
      }
    }, 30000) // 30 seconds

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current)
      }
    }
  }, [user, loading, isProcessing])

  const loadDashboardData = async (isRefresh = false) => {
    if (!user) return

    // Prevent duplicate loading within 2 seconds
    const now = Date.now()
    if (now - lastLoadTime.current < 2000) {
      console.log('🔄 Dashboard: Skipping duplicate load request (too recent)')
      return
    }
    lastLoadTime.current = now

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      console.log('🔄 Dashboard: Loading dashboard data via API for user:', user.id)
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        // Try to refresh session if token is missing
        console.warn('No active session token, attempting to refresh...')
        await refreshSession()
        
        // Check again after refresh
        const { data: { session: refreshedSession } } = await supabase.auth.getSession()
        if (!refreshedSession?.access_token) {
          // Try force token refresh for expired tokens
          console.warn('Session refresh failed, attempting force token refresh...')
          const tokenRefreshed = await forceTokenRefresh()
          if (!tokenRefreshed) {
            throw new Error('Нет активной сессии пользователя даже после обновления')
          }
          
          // Get session again after force refresh
          const { data: { session: forceRefreshedSession } } = await supabase.auth.getSession()
          if (!forceRefreshedSession?.access_token) {
            throw new Error('Нет активной сессии пользователя даже после принудительного обновления')
          }
        }
      }

      // Call the optimized dashboard API endpoint
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, 10000) // 10 second client-side timeout

      const response = await fetch('/api/dashboard', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token || refreshedSession?.access_token}`,
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
          favoriteCount: 0
        })
        
        setError(errorData.error || 'Ошибка загрузки данных панели')
        return
      }

      const result = await response.json()
      console.log('Dashboard API response received:', result)
      
      if (result.success && result.data) {
        console.log('Setting dashboard data from API:', {
          totalSummaries: result.data.totalSummaries,
          favoriteCount: result.data.favoriteCount
        })
        setDashboardData(result.data)
        setError(null) // Clear any previous errors
      } else {
        // Even if not successful, use the provided data to keep UI functional
        setDashboardData(result.data || {
          totalSummaries: 0,
          favoriteCount: 0
        })
        setError(result.error || 'Неизвестная ошибка API панели управления')
      }
      
    } catch (err: any) {
      console.error('Error loading dashboard data via API:', err)
      
      // Set empty data to allow UI to remain functional
      setDashboardData({
        totalSummaries: 0,
        favoriteCount: 0
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
    setSaveError(null)
    console.log('Saving summary to database and updating dashboard...')

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('No session token available')
        setSaveError('Нет активной сессии пользователя')
        return
      }

      // Save summary to database with 25 second timeout
      const success = await saveSummaryToDatabase({
        youtube_url: lastGeneratedSummary.videoUrl,
        video_id: lastGeneratedSummary.videoId,
        video_title: lastGeneratedSummary.videoTitle,
        summary_text: lastGeneratedSummary.summaryText,
        processing_time: lastGeneratedSummary.processingTime
      }, session.access_token, 25000)

      if (success) {
        console.log('Summary saved successfully')
        
        // Refresh dashboard data to update stats and recent summaries
        await loadDashboardData(true)
        
        // Reset save state
        setCanSave(false)
        setLastGeneratedSummary(null)
        setSaveError(null)
        
        console.log('Dashboard updated with new summary')
      } else {
        console.error('Failed to save summary')
        setSaveError('Не удалось сохранить описание, повторите еще раз позже')
      }
    } catch (error: any) {
      console.error('Error saving summary:', error)
      
      if (error.name === 'AbortError') {
        setSaveError('Не удалось сохранить описание, повторите еще раз позже')
      } else {
        setSaveError('Не удалось сохранить описание, повторите еще раз позже')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearSummary = () => {
    // Clear all summary-related state
    setSummary(null)
    setVideoTitle(null)
    setSummaryError(null)
    setCanSave(false)
    setIsSaving(false)
    setSaveError(null)
    setLastGeneratedSummary(null)
    
    // Clear localStorage backup
    localStorage.removeItem('lastSummary')
    localStorage.removeItem('lastVideoTitle')
    localStorage.removeItem('lastSummaryTime')
    
    // Clear the URL input field
    if (urlFormRef.current) {
      urlFormRef.current.clearUrl()
    }
    
    console.log('Summary and URL cleared successfully')
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
        <div className="flex justify-end items-center mb-4">
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
        
        {/* Welcome Message - Centered */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Добро пожаловать, {user.user_metadata?.display_name || user.email}
          </h1>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Combined Stats Card */}
          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              
              {loading && !dashboardData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="pt-4 flex justify-center">
                    <Skeleton className="h-12 w-64" />
                  </div>
                </div>
              ) : dashboardData ? (
                <div className="space-y-6">
                  {/* Statistics - Left aligned */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Получено описаний</span>
                      <span className="text-2xl font-bold text-foreground">{dashboardData.totalSummaries}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">В избранном</span>
                      <span className="text-2xl font-bold text-foreground">{dashboardData.favoriteCount}</span>
                    </div>
                  </div>
                  
                  {/* Centered Button */}
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => router.push('/dashboard/history')}
                      className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <History className="mr-2 h-4 w-4" />
                      Посмотреть все описания
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Create New Summary Form */}
          <UrlForm ref={urlFormRef} onSubmit={handleSummarize} isLoading={isProcessing} />

          {/* Summary Display */}
          <SummaryDisplay 
            summary={summary} 
            videoTitle={videoTitle}
            error={summaryError} 
            isLoading={isProcessing}
            canSave={canSave}
            isSaving={isSaving}
            saveError={saveError}
            onSave={handleSaveToHistory}
            onClear={handleClearSummary}
          />
        </div>
      </div>
    </div>
  )
}