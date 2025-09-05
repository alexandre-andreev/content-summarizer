'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BrowserTabManager } from '@/components/browser-tab-manager'
import { PurpleBarDetector } from '@/components/purple-bar-detector'
import { 
  ArrowLeft, 
  Search, 
  Calendar, 
  Clock, 
  ExternalLink, 
  Heart, 
  HeartOff, 
  Trash2,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { databaseService } from '@/lib/database'
import type { Summary } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'video_title'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastCacheTime, setLastCacheTime] = useState<number>(0)
  const itemsPerPage = 10
  
  // Simple caching to avoid excessive database calls
  const CACHE_DURATION = 30000 // 30 seconds
  const shouldUseCache = (force = false) => {
    if (force) return false
    return Date.now() - lastCacheTime < CACHE_DURATION
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
  
  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadSummaries(true)
      console.log('✅ Manual refresh completed')
    } catch (error) {
      console.error('❌ Manual refresh failed:', error)
      setError('Ошибка обновления данных')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      const needsRefresh = searchQuery !== '' || sortBy !== 'created_at' || sortOrder !== 'desc' || currentPage !== 1
      loadSummaries(needsRefresh)
    }
  }, [user, searchQuery, sortBy, sortOrder, currentPage])

  // Simple tab visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && !loading) {
        console.log('Tab became visible - refreshing data')
        loadSummaries(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
      <PurpleBarDetector />
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing || loading}
              className="min-w-[100px]"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Обновление...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Обновить
                </>
              )}
            </Button>
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