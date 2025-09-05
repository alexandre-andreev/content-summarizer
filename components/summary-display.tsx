'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { AlertCircle, FileText, Save, Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface SummaryDisplayProps {
  summary: string | null;
  videoTitle?: string | null;
  error: string | null;
  isLoading: boolean;
  canSave?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
}

export function SummaryDisplay({ summary, videoTitle, error, isLoading, canSave = false, isSaving = false, onSave }: SummaryDisplayProps) {

  if (isLoading) {
    return (
      <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">{error}</AlertDescription>
      </Alert>
    )
  }

  if (!summary) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-xl bg-card/50">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Введите URL выше, чтобы получить краткое изложение</p>
      </div>
    )
  }

  return (
    <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-bold text-foreground">
            {videoTitle || 'Краткое изложение'}
          </CardTitle>
          {videoTitle && (
            <p className="text-sm text-muted-foreground mt-1">Краткое изложение</p>
          )}
        </div>
        {canSave && onSave && (
          <Button 
            onClick={onSave}
            disabled={isSaving}
            size="sm"
            className="ml-4"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Сохранить
              </>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            components={{
              // Customize heading styles to match the design
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold text-foreground mb-3 mt-5 first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium text-foreground mb-2 mt-4 first:mt-0">
                  {children}
                </h3>
              ),
              // Style paragraphs
              p: ({ children }) => (
                <p className="text-foreground leading-relaxed mb-3 last:mb-0">
                  {children}
                </p>
              ),
              // Style lists
              ul: ({ children }) => (
                <ul className="list-disc ml-6 mb-3 space-y-1 text-foreground">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal ml-6 mb-3 space-y-1 text-foreground">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-foreground leading-relaxed">
                  {children}
                </li>
              ),
              // Style bold and italic
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
              // Style code
              code: ({ children }) => (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
                  {children}
                </code>
              ),
              // Style blockquotes
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground mb-3">
                  {children}
                </blockquote>
              ),
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  )
}