'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { databaseService } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  Heart, 
  HeartOff, 
  Calendar,
  Clock,
  ArrowLeft,
  Download,
  Trash2,
  ExternalLink
} from 'lucide-react'
import type { Summary } from '@/lib/supabase/client'

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortBy, setSortBy] = useState<'created_at' | 'video_title'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  const itemsPerPage = 10

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // Load summaries when user is available or filters change
  useEffect(() => {
    if (user) {
      loadSummaries()
    }
  }, [user, currentPage, searchQuery, sortBy, sortOrder])

  const loadSummaries = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { summaries: data, error: fetchError, count } = await databaseService.getUserSummaries(
        user.id,
        {
          limit: itemsPerPage,
          offset: (currentPage - 1) * itemsPerPage,
          search: searchQuery || undefined,
          sortBy,
          sortOrder,
        }
      )

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setSummaries(data)
        setTotalCount(count || 0)
      }
    } catch (err) {
      setError('Failed to load summaries')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleFavorite = async (summaryId: string) => {
    if (!user) return

    try {
      const { error } = await databaseService.toggleFavorite(summaryId, user.id)
      
      if (error) {
        console.error('Failed to toggle favorite:', error)
      } else {
        // Update local state
        setSummaries(prev => 
          prev.map(summary => 
            summary.id === summaryId 
              ? { ...summary, is_favorite: !summary.is_favorite }
              : summary
          )
        )
      }
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }

  const handleDeleteSummary = async (summaryId: string) => {
    if (!user || !confirm('Are you sure you want to delete this summary?')) return

    try {
      const { error } = await databaseService.deleteSummary(summaryId, user.id)
      
      if (error) {
        console.error('Failed to delete summary:', error)
      } else {
        // Remove from local state
        setSummaries(prev => prev.filter(summary => summary.id !== summaryId))
        setTotalCount(prev => prev - 1)
      }
    } catch (err) {
      console.error('Error deleting summary:', err)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1) // Reset to first page when searching
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)

  if (authLoading || !user) {
    return (
      <div className=\"min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center\">
        <div className=\"text-center\">
          <div className=\"w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4\" />
          <p className=\"text-muted-foreground\">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className=\"min-h-screen bg-gradient-to-br from-background via-background to-muted/30\">
      <div className=\"container mx-auto px-4 py-8\">
        {/* Header */}
        <div className=\"flex items-center justify-between mb-8\">
          <div className=\"flex items-center gap-4\">
            <Button
              variant=\"outline\"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className=\"mr-2 h-4 w-4\" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className=\"text-3xl font-bold text-foreground\">Summary History</h1>
              <p className=\"text-muted-foreground\">
                {totalCount} total summaries
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className=\"mb-6\">
          <CardContent className=\"p-6\">
            <div className=\"flex flex-col md:flex-row gap-4\">
              <div className=\"flex-1\">
                <div className=\"relative\">
                  <Search className=\"absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4\" />
                  <Input
                    placeholder=\"Search summaries...\"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className=\"pl-10\"
                  />
                </div>
              </div>
              <div className=\"flex gap-2\">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'created_at' | 'video_title')}
                  className=\"px-3 py-2 border rounded-md bg-background\"
                >
                  <option value=\"created_at\">Sort by Date</option>
                  <option value=\"video_title\">Sort by Title</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className=\"px-3 py-2 border rounded-md bg-background\"
                >
                  <option value=\"desc\">Newest First</option>
                  <option value=\"asc\">Oldest First</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Alert variant=\"destructive\" className=\"mb-6\">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading ? (
          <div className=\"space-y-4\">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className=\"p-6\">
                  <div className=\"space-y-3\">
                    <Skeleton className=\"h-4 w-3/4\" />
                    <Skeleton className=\"h-3 w-1/2\" />
                    <Skeleton className=\"h-20 w-full\" />
                    <div className=\"flex gap-2\">
                      <Skeleton className=\"h-6 w-16\" />
                      <Skeleton className=\"h-6 w-20\" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summaries.length === 0 ? (
          <Card>
            <CardContent className=\"p-12 text-center\">
              <p className=\"text-muted-foreground\">
                {searchQuery ? 'No summaries found matching your search.' : 'No summaries yet. Create your first one!'}
              </p>
              <Button
                className=\"mt-4\"
                onClick={() => router.push('/dashboard')}
              >
                Create Summary
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summaries List */}
            <div className=\"space-y-4 mb-8\">
              {summaries.map((summary) => (
                <Card key={summary.id} className=\"hover:shadow-lg transition-shadow\">
                  <CardContent className=\"p-6\">
                    <div className=\"flex justify-between items-start mb-4\">
                      <div className=\"flex-1\">
                        <h3 className=\"font-semibold text-lg mb-2\">
                          {summary.video_title || 'YouTube Video'}
                        </h3>
                        <div className=\"flex items-center gap-4 text-sm text-muted-foreground mb-3\">
                          <div className=\"flex items-center gap-1\">
                            <Calendar className=\"w-4 h-4\" />
                            {new Date(summary.created_at).toLocaleDateString()}
                          </div>
                          {summary.processing_time && (
                            <div className=\"flex items-center gap-1\">
                              <Clock className=\"w-4 h-4\" />
                              {(summary.processing_time / 1000).toFixed(1)}s
                            </div>
                          )}
                          <a
                            href={summary.youtube_url}
                            target=\"_blank\"
                            rel=\"noopener noreferrer\"
                            className=\"flex items-center gap-1 hover:text-primary\"
                          >
                            <ExternalLink className=\"w-4 h-4\" />
                            Watch Video
                          </a>
                        </div>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <Button
                          variant=\"ghost\"
                          size=\"sm\"
                          onClick={() => handleToggleFavorite(summary.id)}
                        >
                          {summary.is_favorite ? (
                            <Heart className=\"w-4 h-4 text-red-500 fill-current\" />
                          ) : (
                            <HeartOff className=\"w-4 h-4\" />
                          )}
                        </Button>
                        <Button
                          variant=\"ghost\"
                          size=\"sm\"
                          onClick={() => handleDeleteSummary(summary.id)}
                        >
                          <Trash2 className=\"w-4 h-4\" />
                        </Button>
                      </div>
                    </div>
                    
                    <p className=\"text-foreground leading-relaxed mb-4 line-clamp-4\">
                      {summary.summary_text}
                    </p>
                    
                    <div className=\"flex gap-2\">
                      {summary.is_favorite && (
                        <Badge variant=\"secondary\">
                          <Heart className=\"w-3 h-3 mr-1\" />
                          Favorite
                        </Badge>
                      )}
                      {summary.tags?.map((tag, index) => (
                        <Badge key={index} variant=\"outline\">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className=\"flex justify-center items-center gap-2\">
                <Button
                  variant=\"outline\"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Previous
                </Button>
                
                <span className=\"text-sm text-muted-foreground px-4\">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant=\"outline\"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}