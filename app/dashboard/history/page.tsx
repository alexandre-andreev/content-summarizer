'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AppRecovery } from '@/components/app-recovery'
import { PerformanceMonitor } from '@/components/performance-monitor'
import { BrowserTabManager } from '@/components/browser-tab-manager'
import { EmergencyRecovery } from '@/components/emergency-recovery'
import { PurpleBarDetector } from '@/components/purple-bar-detector'
import { DebugDetector } from '@/components/debug-detector'
import { 
  ArrowLeft, 
  Search, 
  Calendar, 
  Clock, 
  ExternalLink, 
  Heart, 
  HeartOff, 
  Trash2 
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { databaseService } from '@/lib/database'
import type { Summary } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [summaries, setSummaries] = useState<Summary[]>([])
  console.log("Summaries state:", summaries)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')  // Separate state for input field
  const [sortBy, setSortBy] = useState<'created_at' | 'video_title'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const itemsPerPage = 10

  // Function to highlight search terms in text (returns JSX for direct rendering)
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim() || !text) return text
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-green-200 text-green-800 px-1 rounded">
          {part}
        </span>
      ) : part
    )
  }

  // Component to render markdown with search highlighting
  const MarkdownWithHighlight = ({ text, searchTerm }: { text: string; searchTerm: string }) => {
    if (!searchTerm.trim()) {
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-lg font-semibold text-foreground mb-2 mt-2 first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-base font-medium text-foreground mb-2 mt-2 first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-medium text-foreground mb-1 mt-2 first:mt-0">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-foreground leading-relaxed text-sm mb-2 last:mb-0">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc ml-4 mb-2 space-y-0.5 text-sm">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal ml-4 mb-2 space-y-0.5 text-sm">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-foreground leading-relaxed text-sm">
                  {children}
                </li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em className="italic text-foreground">
                  {children}
                </em>
              ),
              code: ({ children }) => (
                <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              ),
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      )
    }

    // When there's a search term, apply highlighting to the entire rendered markdown
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert markdown-highlighted">
        {highlightSearchTerm(text, searchTerm)}
      </div>
    )
  }

  const loadSummaries = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    console.log("Attempting to load summaries for user:", user.id)

    try {
      const result = await databaseService.getUserSummaries(
        user.id,
        {
          search: searchQuery,
          sortBy,
          sortOrder,
          offset: (currentPage - 1) * itemsPerPage,
          limit: itemsPerPage
        }
      )

      console.log("Result from getUserSummaries:", result)

      if (result.error) {
        setError(result.error.message)
      } else {
        setSummaries(result.summaries || [])
        setTotalCount(result.count || 0)
      }
    } catch (err) {
      console.error("Error loading summaries:", err)
      setError('Failed to load summaries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadSummaries()
    }
  }, [user, searchQuery, sortBy, sortOrder, currentPage])

  // Handle tab visibility changes to prevent browser suspension issues
  useEffect(() => {
    // Purple bar monitoring system
    const monitorPurpleBars = () => {
      const bodyText = document.body.textContent || ''
      const hasContent = bodyText.length > 200
      const hasValidData = summaries.length > 0 || loading
      const hasSkeletonLoaders = document.querySelectorAll('[class*="skeleton"]').length
      const hasSpinners = document.querySelectorAll('.animate-spin').length
      
      // Detect purple bars: no content, perpetual loading, or corrupted display
      if (!hasContent || (hasSkeletonLoaders > 3 && !loading) || (hasSpinners > 0 && !loading)) {
        console.warn('🟣 Potential purple bars detected:', {
          bodyTextLength: bodyText.length,
          hasSkeletonLoaders,
          hasSpinners,
          loading,
          summariesCount: summaries.length
        })
        
        // Auto-trigger recovery if stuck for more than 3 seconds
        setTimeout(() => {
          const stillStuck = document.body.textContent?.length < 200
          if (stillStuck) {
            console.error('🚨 Purple bars confirmed - triggering auto-recovery')
            handleHistoryRecovery()
          }
        }, 3000)
      }
    }
    
    // Monitor every 5 seconds
    const purpleBarInterval = setInterval(monitorPurpleBars, 5000)
    
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      setIsTabVisible(isVisible)
      
      if (isVisible) {
        console.log('History page became visible - checking data state')
        
        // Immediate purple bar check when tab becomes visible
        setTimeout(monitorPurpleBars, 1000)
        
        // If tab was hidden and now visible, refresh data if needed
        if (user && !loading) {
          console.log('Refreshing history data after tab became visible')
          loadSummaries()
        }
      } else {
        console.log('History page became hidden')
      }
    }

    // Also handle window focus/blur for additional browser support
    const handleFocus = () => {
      console.log('History page window focused - ensuring data is current')
      if (user && !loading) {
        // Small delay to allow browser to stabilize
        setTimeout(() => {
          console.log('Performing history page focus recovery check')
          loadSummaries()
        }, 100)
      }
    }

    const handleBlur = () => {
      console.log('History page window blurred')
    }

    // Handle corruption events from BrowserTabManager
    const handlePageCorrupted = (event: CustomEvent) => {
      console.error('🚨 History page corruption detected:', event.detail)
      handleHistoryRecovery()
    }

    const handlePageSlow = (event: CustomEvent) => {
      console.warn('⚠️ History page performance degraded:', event.detail)
      if (user && !loading) {
        loadSummaries()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('pageCorrupted', handlePageCorrupted as EventListener)
    window.addEventListener('pageSlow', handlePageSlow as EventListener)

    return () => {
      clearInterval(purpleBarInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('pageCorrupted', handlePageCorrupted as EventListener)
      window.removeEventListener('pageSlow', handlePageSlow as EventListener)
    }
  }, [user, loading])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(searchInput)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value)
    // If input is cleared, immediately clear the search
    if (e.target.value === '') {
      handleSearch('')
    }
  }

  const handleToggleFavorite = async (summaryId: string) => {
    if (!user) return
    
    try {
      const result = await databaseService.toggleFavorite(summaryId, user.id)
      if (result.error) {
        setError('Failed to update favorite status')
      } else {
        // Refresh the list to show updated favorite status
        await loadSummaries()
      }
    } catch (err) {
      setError('Failed to update favorite status')
    }
  }

  const handleDeleteSummary = async (summaryId: string) => {
    if (!user) return
    
    if (!confirm('Вы уверены, что хотите удалить это саммари?')) {
      return
    }
    
    try {
      const result = await databaseService.deleteSummary(summaryId, user.id)
      if (result.error) {
        setError('Failed to delete summary')
      } else {
        // Refresh the list to remove the deleted summary
        await loadSummaries()
      }
    } catch (err) {
      setError('Failed to delete summary')
    }
  }

  const handleHistoryRecovery = async () => {
    console.log('🔄 Performing enhanced history page recovery...')
    
    // Immediately stop any flashing by fixing styles
    const antiFlashStyle = document.createElement('style')
    antiFlashStyle.textContent = `
      * {
        animation: none !important;
        transition: none !important;
        opacity: 1 !important;
      }
      body {
        visibility: visible !important;
        display: block !important;
      }
    `
    document.head.appendChild(antiFlashStyle)
    
    // Reset all states to clean state first
    setLoading(true)
    setError(null)
    setSummaries([])
    setTotalCount(0)
    
    // Force DOM cleanup to prevent flashing
    try {
      // Remove any corrupted elements that might cause flashing
      const skeletons = document.querySelectorAll('[class*="skeleton"]')
      const spinners = document.querySelectorAll('.animate-spin')
      
      skeletons.forEach(el => el.remove())
      spinners.forEach(el => {
        if (!el.closest('button')) { // Keep button spinners
          el.remove()
        }
      })
      
      // Force repaint to clear purple bars
      document.body.style.transform = 'translateZ(0)' // Force GPU layer
      document.body.style.visibility = 'hidden'
      document.body.offsetHeight // Trigger reflow
      document.body.style.visibility = 'visible'
      document.body.style.transform = ''
      
    } catch (domError) {
      console.warn('DOM cleanup failed:', domError)
    }
    
    try {
      // Force reload summaries data with retry logic
      if (user) {
        console.log('🔄 Reloading summaries after recovery...')
        await loadSummaries()
      }
    } catch (error) {
      console.error('❌ Recovery failed:', error)
      setError('Ошибка восстановления данных')
      setLoading(false)
    }
    
    // Remove anti-flash styles after recovery completes
    setTimeout(() => {
      if (antiFlashStyle.parentNode) {
        document.head.removeChild(antiFlashStyle)
      }
      
      // Final check - if still broken, force reload
      const bodyText = document.body.textContent || ''
      if (bodyText.length < 200 || bodyText.includes('████')) {
        console.warn('⚠️ Recovery incomplete, forcing page reload')
        window.location.reload()
      }
    }, 3000)
    
    console.log('✅ History page recovery completed')
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <BrowserTabManager />
      <PerformanceMonitor onPerformanceIssue={(issue) => console.warn('History page performance issue:', issue)} />
      <AppRecovery onRecover={handleHistoryRecovery} />
      <EmergencyRecovery />
      <PurpleBarDetector onPurpleBarDetected={handleHistoryRecovery} />
      <DebugDetector />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к панели
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">История саммари</h1>
              <p className="text-muted-foreground">
                Всего саммари: {totalCount}
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Введите текст для поиска и нажмите Enter"
                    value={searchInput}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    className="pl-10"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Для отображения всех данных удалите поисковый запрос
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="desc">Новые сначала</option>
                  <option value="asc">Старые сначала</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-20 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summaries.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? 'Ничего не найдено по запросу: "' + searchQuery + '"' : 'Пока нет саммари. Создайте первое!'}
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push('/dashboard')}
              >
                Создать саммари
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {summaries.map((summary) => (
                <Card key={summary.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg mb-1">
                        {summary.video_title && summary.video_title.trim() !== '' 
                          ? highlightSearchTerm(summary.video_title, searchQuery)
                          : 'YouTube Video'
                        }
                      </h3>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFavorite(summary.id)}
                          className={summary.is_favorite ? 'text-red-500' : 'text-gray-500'}
                        >
                          {summary.is_favorite ? (
                            <Heart className="h-4 w-4 fill-current" />
                          ) : (
                            <HeartOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(summary.youtube_url, '_blank')}
                          className="text-blue-500"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSummary(summary.id)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(summary.created_at).toLocaleDateString('ru-RU')}
                      </Badge>
                      {summary.processing_time && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {summary.processing_time}ms
                        </Badge>
                      )}
                      {summary.is_favorite && (
                        <Badge variant="default" className="text-xs bg-red-100 text-red-700">
                          Избранное
                        </Badge>
                      )}
                    </div>
                    
                    <MarkdownWithHighlight 
                      text={summary.summary_text} 
                      searchTerm={searchQuery} 
                    />
                  </CardContent>
                </Card>
              ))}}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Предыдущая
                </Button>
                
                <span className="text-sm text-muted-foreground px-4">
                  Страница {currentPage} из {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Следующая
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}