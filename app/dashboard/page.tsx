'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { databaseService } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UrlForm } from '@/components/url-form'
import { SummaryDisplay } from '@/components/summary-display'
import { 
  BarChart3, 
  FileText, 
  Heart, 
  Calendar,
  LogOut,
  User,
  History,
  RefreshCw
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
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

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
    const lastSummaryTime = localStorage.getItem('lastSummaryTime')
    
    if (lastSummary && lastSummaryTime) {
      const timeDiff = Date.now() - parseInt(lastSummaryTime)
      // If summary was generated less than 5 minutes ago, restore it
      if (timeDiff < 5 * 60 * 1000) {
        console.log('Restoring summary from localStorage')
        setSummary(lastSummary)
      } else {
        // Clean up old summary
        localStorage.removeItem('lastSummary')
        localStorage.removeItem('lastSummaryTime')
      }
    }
  }, [])

  const loadDashboardData = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      console.log('Loading dashboard data for user:', user.id)
      const data = await databaseService.getDashboardData(user.id)
      console.log('Dashboard data received:', data)
      
      if (data.error) {
        console.error('Dashboard data error:', data.error)
        setError(data.error.message)
      } else {
        console.log('Setting dashboard data:', {
          totalSummaries: data.totalSummaries,
          recentSummaries: data.recentSummaries?.length || 0,
          favoriteCount: data.favoriteCount,
          thisWeekCount: data.thisWeekCount
        })
        setDashboardData(data)
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleSummarize = async (videoUrl: string) => {
    if (!user) return

    setIsProcessing(true)
    setSummaryError(null)
    setSummary(null)

    const startTime = Date.now()

    try {
      console.log('Starting summarization for:', videoUrl)
      
      // Call the API to generate summary with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
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
      console.log('Summary text length:', data.summary?.length || 0)

      // Set summary immediately after receiving it
      console.log('Setting summary in state immediately')
      setSummary(data.summary)
      
      // Store in localStorage as backup against Hot Reload
      localStorage.setItem('lastSummary', data.summary)
      localStorage.setItem('lastSummaryTime', Date.now().toString())

      const processingTime = Date.now() - startTime
      console.log('Processing time:', processingTime, 'ms')

      // Extract video ID for storage
      const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || ''
      console.log('Extracted video ID:', videoId)

      // Save summary to database
      const summaryData = {
        user_id: user.id,
        youtube_url: videoUrl,
        video_id: videoId,
        summary_text: data.summary,
        processing_time: processingTime,
        is_favorite: false,
      }

      console.log('Saving summary to database...')
      const { error: saveError } = await databaseService.createSummary(summaryData)
      
      if (saveError) {
        console.error('Failed to save summary:', saveError)
        // Don't fail the whole operation if saving fails
        setSummaryError('Summary created but failed to save to your history')
      } else {
        console.log('Summary saved successfully')
      }

      // Track usage (run in background, don't wait)
      console.log('Tracking usage...')
      databaseService.trackUsage({
        user_id: user.id,
        action: 'summarize',
        metadata: { 
          video_url: videoUrl,
          processing_time: processingTime
        }
      }).catch(err => console.error('Failed to track usage:', err))

      // Refresh dashboard data with delay to ensure database consistency
      console.log('Refreshing dashboard data in 1 second...')
      setTimeout(() => {
        loadDashboardData().catch(err => console.error('Failed to refresh dashboard:', err))
      }, 1000)

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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user.user_metadata?.display_name || user.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={loadDashboardData}
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/history')}
            >
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/profile')}
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {loading ? (
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
          ) : error ? (
            <div className="col-span-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : dashboardData ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Summaries</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.totalSummaries}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Week</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.thisWeekCount}</div>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Favorites</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.favoriteCount}</div>
                  <p className="text-xs text-muted-foreground">Bookmarked</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Processing</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">~3s</div>
                  <p className="text-xs text-muted-foreground">Per summary</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create New Summary */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Summary</CardTitle>
                <CardDescription>
                  Enter a YouTube URL to generate an AI-powered summary
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UrlForm onSubmit={handleSummarize} isLoading={isProcessing} />
              </CardContent>
            </Card>

            <SummaryDisplay 
              summary={summary} 
              error={summaryError} 
              isLoading={isProcessing} 
            />
          </div>

          {/* Recent Summaries */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Recent Summaries</CardTitle>
                <CardDescription>Your latest video summaries</CardDescription>
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
                    View All History
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