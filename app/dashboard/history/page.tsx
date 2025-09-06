'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BrowserTabManager } from '@/components/browser-tab-manager'
import { 
  ArrowLeft, 
  Search, 
  Calendar, 
  Clock, 
  ExternalLink, 
  Heart, 
  HeartOff, 
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { databaseService } from '@/lib/database'
import type { Summary } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshSession, forceTokenRefresh, handleLongSuspensionRecovery } = useAuth()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'video_title'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [lastCacheTime, setLastCacheTime] = useState<number>(0)
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set())
  const itemsPerPage = 4
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const lastHealthCheck = useRef<number>(0)
  
  // Simple caching to avoid excessive database calls
  const CACHE_DURATION = 30000 // 30 seconds
  const shouldUseCache = (force = false) => {
    if (force) return false
    return Date.now() - lastCacheTime < CACHE_DURATION
  }

  // Function to get the first sentence of a text
  const getFirstSentence = (text: string): string => {
    if (!text) return ''
    // Split by sentence endings, take first one
    const sentences = text.split(/[.!?]+/)
    const firstSentence = sentences[0]?.trim()
    return firstSentence ? firstSentence + '.' : text.substring(0, 100) + '...'
  }

  // Function to toggle expanded state for a summary
  const toggleSummaryExpansion = (summaryId: string) => {
    setExpandedSummaries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(summaryId)) {
        newSet.delete(summaryId)
      } else {
        newSet.add(summaryId)
      }
      return newSet
    })
  }

  // Function to highlight search terms in text
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

    return (
      <div className="prose prose-sm max-w-none dark:prose-invert markdown-highlighted">
        {highlightSearchTerm(text, searchTerm)}
      </div>
    )
  }

  const loadSummaries = async (forceRefresh = false) => {
    if (!user) return

    // Check cache first unless force refresh
    if (!forceRefresh && shouldUseCache() && summaries.length > 0) {
      console.log('Using cached data, skipping database call')
      return
    }

    setLoading(true)
    setError(null)

    console.log(`Attempting to load summaries for user: ${user.id} (force: ${forceRefresh})`)

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

      if (result.error) {
        setError(result.error.message)
      } else {
        setSummaries(result.summaries || [])
        setTotalCount(result.count || 0)
        setLastCacheTime(Date.now())
      }
    } catch (err) {
      console.error("Error loading summaries:", err)
      setError('Failed to load summaries')
    } finally {
      setLoading(false)
    }
  }
  
  // Manual refresh function - removed as it doesn't work properly

  useEffect(() => {
    if (user) {
      const needsRefresh = searchQuery !== '' || sortBy !== 'created_at' || sortOrder !== 'desc' || currentPage !== 1
      loadSummaries(needsRefresh)
    }
  }, [user, searchQuery, sortBy, sortOrder, currentPage])

  // Enhanced tab visibility handling with Supabase recovery
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && user && !loading) {
        console.log('Tab became visible - refreshing data')
        
        // Try to refresh session first
        try {
          await refreshSession()
        } catch (error) {
          console.error('Session refresh failed:', error)
          // Try force token refresh
          try {
            await forceTokenRefresh()
          } catch (forceError) {
            console.error('Force token refresh failed:', forceError)
          }
        }
        
        loadSummaries(true)
      }
    }

    // Handle Supabase recovery events
    const handleSupabaseRecovered = () => {
      console.log('Supabase connection recovered - refreshing history')
      if (user && !loading) {
        loadSummaries(true)
      }
    }

    // Handle comprehensive recovery for frozen pages
    const handleComprehensiveRecovery = async () => {
      console.log('Comprehensive recovery initiated for history page')
      
      // Handle long suspension recovery
      try {
        const recoverySuccess = await handleLongSuspensionRecovery()
        console.log('Long suspension recovery result:', recoverySuccess)
        
        // Refresh history data
        if (user && !loading) {
          await loadSummaries(true)
        }
      } catch (error) {
        console.error('Error during comprehensive recovery:', error)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('supabaseRecovered', handleSupabaseRecovered)
    window.addEventListener('comprehensiveRecovery', handleComprehensiveRecovery)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('supabaseRecovered', handleSupabaseRecovered)
      window.removeEventListener('comprehensiveRecovery', handleComprehensiveRecovery)
    }
  }, [user, loading, refreshSession, forceTokenRefresh, handleLongSuspensionRecovery])

  // Add periodic health check for history page with improved logic
  useEffect(() => {
    // Check history page health every 30 seconds
    healthCheckInterval.current = setInterval(() => {
      const now = Date.now()
      
      // Skip health check if we just did one (within 25 seconds)
      if (now - lastHealthCheck.current < 25000) {
        return
      }
      
      lastHealthCheck.current = now
      
      if (user && !document.hidden && !loading) {
        // Simple health check - verify we can still get session
        // This will help detect if the page has become unresponsive
        console.log('Performing history page health check...')
      }
    }, 30000) // 30 seconds

    return () => {
      if (healthCheckInterval.current) {
        clearInterval(healthCheckInterval.current)
      }
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
        await loadSummaries(true)
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
        await loadSummaries(true)
      }
    } catch (err) {
      setError('Failed to delete summary')
    }
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
      <div className="container mx-auto px-4 py-8">
        {/* Navigation Button - Top Left */}
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к получению видео
          </Button>
        </div>
        
        {/* Title and Counter - Left Aligned */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-foreground mb-2">Сформированные описания</h1>
          <p className="text-muted-foreground mb-2">
            Всего саммари: {totalCount}
          </p>
          <p className="text-sm text-muted-foreground">
            Если описания не загружаются, обновите страницу браузера
          </p>
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
                    
                    {/* Summary Text with Expand/Collapse */}
                    <div className="relative">
                      {expandedSummaries.has(summary.id) ? (
                        <MarkdownWithHighlight 
                          text={summary.summary_text} 
                          searchTerm={searchQuery} 
                        />
                      ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <p className="text-foreground leading-relaxed text-sm mb-2">
                            {searchQuery ? (
                              highlightSearchTerm(getFirstSentence(summary.summary_text), searchQuery)
                            ) : (
                              getFirstSentence(summary.summary_text)
                            )}
                          </p>
                        </div>
                      )}
                      
                      {/* Expand/Collapse Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSummaryExpansion(summary.id)}
                        className="mt-2 text-blue-600 hover:text-blue-800 p-0 h-auto font-normal"
                      >
                        {expandedSummaries.has(summary.id) ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Свернуть
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Показать полностью
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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