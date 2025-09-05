'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
// import { getUserSummaries, toggleSummaryFavorite, deleteSummary } from '@/lib/database'
import type { Summary } from '@/lib/supabase/client'

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [summaries, setSummaries] = useState<Summary[]>([])
  console.log("Summaries state:", summaries)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'video_title'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 10

  const loadSummaries = async () => {
    if (!user) return
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await databaseService.getUserSummaries(
        user.id,
        {
          search: searchQuery,
          sortBy,
          sortOrder,
          page: currentPage,
          limit: itemsPerPage
        }
      )

      if (result.error) {
        setError(result.error.message)
      } else {
        setSummaries(result.summaries || [])
        setTotalCount(result.count || 0)
      }
    } catch (err) {
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

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  const handleToggleFavorite = async (summaryId: string) => {
    try {
      // TODO: Implement toggleSummaryFavorite function
      // const result = await toggleSummaryFavorite(summaryId)
      console.log('Toggle favorite:', summaryId)
      setError('Feature coming soon!')
    } catch (err) {
      setError('Failed to update favorite status')
    }
  }

  const handleDeleteSummary = async (summaryId: string) => {
    if (!confirm('Are you sure you want to delete this summary?')) {
      return
    }
    
    try {
      // TODO: Implement deleteSummary function
      // const result = await deleteSummary(summaryId)
      console.log('Delete summary:', summaryId)
      setError('Feature coming soon!')
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
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Summary History</h1>
              <p className="text-muted-foreground">
                {totalCount} total summaries
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
                    placeholder="Search summaries..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'created_at' | 'video_title')}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="created_at">Sort by Date</option>
                  <option value="video_title">Sort by Title</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
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
                {searchQuery ? 'No summaries found matching your search.' : 'No summaries yet. Create your first one!'}
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push('/dashboard')}
              >
                Create Summary
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {summaries.map((summary) => (
                <Card key={summary.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-2">
                      {summary.video_title || 'YouTube Video'}
                    </h3>
                    <p className="text-foreground leading-relaxed">
                      {summary.summary_text}
                    </p>
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
                  Previous
                </Button>
                
                <span className="text-sm text-muted-foreground px-4">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
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