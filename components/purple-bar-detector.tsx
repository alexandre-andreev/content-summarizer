'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface PurpleBarDetectorProps {
  onPurpleBarDetected?: () => void
  checkInterval?: number
  enabled?: boolean
}

export function PurpleBarDetector({ 
  onPurpleBarDetected, 
  checkInterval = 3000,
  enabled = true 
}: PurpleBarDetectorProps) {
  const detectionRef = useRef(0)
  const [showRefreshMessage, setShowRefreshMessage] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const detectPurpleBars = () => {
      try {
        const bodyText = document.body.textContent || ''
        const bodyHTML = document.body.innerHTML || ''
        
        // Simple detection for purple bars
        const indicators = {
          emptyContent: bodyText.length < 50,
          veryShortContent: bodyText.length < 200 && bodyText.includes('История'),
          purpleChars: bodyText.includes('████') || bodyText.includes('▓▓▓▓'),
          stuckSkeletons: document.querySelectorAll('[class*="skeleton"]').length > 3,
          missingCards: document.querySelectorAll('.card').length === 0 && bodyText.includes('саммари'),
        }
        
        const detectedCount = Object.values(indicators).filter(Boolean).length
        const shouldShow = detectedCount >= 2 || indicators.purpleChars
        
        if (shouldShow) {
          detectionRef.current++
          console.warn(`🟣 Purple bars detected (${detectionRef.current}):`, indicators)
          
          // Show refresh message after 2 consecutive detections
          if (detectionRef.current >= 2) {
            setShowRefreshMessage(true)
          }
        } else {
          // Reset if content is good
          detectionRef.current = 0
          setShowRefreshMessage(false)
        }
        
      } catch (error) {
        console.error('Error in purple bar detection:', error)
      }
    }

    // Check every 3 seconds
    const interval = setInterval(detectPurpleBars, checkInterval)
    
    // Check on visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(detectPurpleBars, 1000)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkInterval, enabled])

  const handleRefresh = () => {
    window.location.reload()
  }

  if (!showRefreshMessage) {
    return null
  }

  return (
    <Alert className="fixed top-4 left-4 right-4 z-50 max-w-lg mx-auto bg-blue-50 border-blue-200">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <strong className="block mb-1">Проблема с отображением данных</strong>
          <span className="text-sm">Перезагрузите браузер, чтобы продолжить!</span>
        </div>
        <Button onClick={handleRefresh} size="sm" className="ml-2">
          <RefreshCw className="mr-1 h-3 w-3" />
          Обновить
        </Button>
      </AlertDescription>
    </Alert>
  )
}