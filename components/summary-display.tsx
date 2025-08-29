'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, FileText } from "lucide-react"

interface SummaryDisplayProps {
  summary: string | null;
  error: string | null;
  isLoading: boolean;
}

export function SummaryDisplay({ summary, error, isLoading }: SummaryDisplayProps) {

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
      <CardHeader>
        <CardTitle className="text-xl font-bold text-foreground">Краткое изложение</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
      </CardContent>
    </Card>
  )
}