'use client'

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, Link, Sparkles, Clock } from "lucide-react"

interface UrlFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlForm({ onSubmit, isLoading }: UrlFormProps) {
  const [url, setUrl] = useState("")
  const [progress, setProgress] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState("")

  // Progress simulation for user feedback
  useEffect(() => {
    if (isLoading) {
      setProgress(0)
      setLoadingMessage("Получаем транскрипт видео...")
      
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 30) {
            return prev + 2
          } else if (prev < 70) {
            setLoadingMessage("Анализируем содержание...")
            return prev + 1
          } else if (prev < 95) {
            setLoadingMessage("Создаем краткое изложение...")
            return prev + 0.5
          }
          return prev
        })
      }, 500)

      return () => clearInterval(progressInterval)
    } else {
      setProgress(0)
      setLoadingMessage("")
    }
  }, [isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit(url);
  }

  return (
    <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="url" className="text-sm font-medium text-foreground">
              Введите ссылку на видео:
            </label>
            
            <div className="relative">
              <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="url"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10 h-12 text-base border-2 focus:border-primary/50 transition-colors"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center text-muted-foreground">
                  <Clock className="w-4 h-4 mr-2" />
                  {loadingMessage}
                </span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Обычно это занимает 30-60 секунд. Для длинных видео может потребоваться до 2 минут.
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Анализируем видео...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Создать краткое изложение
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Поддерживаются все видео YouTube: обучающие, лекции, подкасты и другие
          </p>
        </div>
      </CardContent>
    </Card>
  )
}