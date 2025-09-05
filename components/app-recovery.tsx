'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface AppRecoveryProps {
  onRecover?: () => void
}

export function AppRecovery({ onRecover }: AppRecoveryProps) {
  const [isStuck, setIsStuck] = useState(false)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [isRecovering, setIsRecovering] = useState(false)
  const [forceShow, setForceShow] = useState(false)

  // Monitor for app becoming unresponsive
  useEffect(() => {
    const checkActivity = () => {
      const now = Date.now()
      const timeSinceActivity = now - lastActivity
      
      // Reduced from 30s to 10s for faster detection
      if (timeSinceActivity > 10000) {
        console.warn('App appears unresponsive - no activity for', timeSinceActivity / 1000, 'seconds')
        setIsStuck(true)
      }
    }

    // Update activity on user interactions
    const updateActivity = () => {
      setLastActivity(Date.now())
      setIsStuck(false)
      setForceShow(false)
    }

    // Listen for user interactions
    const events = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    // Check more frequently
    const interval = setInterval(checkActivity, 2000)

    // Force show recovery after page becomes visible if frozen
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible - checking for freeze issues')
        // Wait a moment then check if app is responsive
        setTimeout(() => {
          const bodyText = document.body.textContent || ''
          const hasValidContent = bodyText.length > 100 && 
                                !bodyText.includes('████') && 
                                !bodyText.includes('▓▓▓▓') && 
                                !bodyText.includes('░░░░') &&
                                bodyText.trim() !== ''
          
          // Check for purple bars more aggressively
          const hasLoadingSpinner = document.querySelector('.animate-spin')
          const hasSkeletons = document.querySelectorAll('[class*="skeleton"]').length > 5
          const hasEmptyCards = document.querySelectorAll('.card').length === 0
          
          if (!hasValidContent || hasLoadingSpinner || hasSkeletons || hasEmptyCards) {
            console.error('🚨 Detected frozen state - purple bars, spinners, or empty content')
            console.log('Debug info:', {
              bodyTextLength: bodyText.length,
              hasLoadingSpinner: !!hasLoadingSpinner,
              hasSkeletons,
              hasEmptyCards,
              bodyPreview: bodyText.substring(0, 200)
            })
            setForceShow(true)
            setIsStuck(true)
          }
        }, 1500) // Increased timeout for better detection
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [lastActivity])

  const handleRecover = async () => {
    setIsRecovering(true)
    
    try {
      console.log('🔄 Starting aggressive app recovery...')
      
      // Clear localStorage completely
      const stuckKeys = ['lastSummary', 'lastSummaryTime']
      stuckKeys.forEach(key => {
        try {
          localStorage.removeItem(key)
        } catch (e) {
          console.warn('Failed to clear localStorage key:', key)
        }
      })
      
      // Force clear any stuck CSS animations or transitions
      const style = document.createElement('style')
      style.textContent = `
        * {
          animation: none !important;
          transition: none !important;
        }
      `
      document.head.appendChild(style)
      
      // Force repaint
      document.body.style.display = 'none'
      document.body.offsetHeight // Trigger reflow
      document.body.style.display = ''
      
      // Remove the style after recovery
      setTimeout(() => {
        document.head.removeChild(style)
      }, 1000)
      
      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc()
      }
      
      // Call custom recovery function
      if (onRecover) {
        console.log('🔄 Calling custom recovery function...')
        await onRecover()
      }
      
      // Force page refresh as last resort if still stuck
      setTimeout(() => {
        const bodyText = document.body.textContent || ''
        if (bodyText.length < 100) {
          console.error('⚠️ Recovery failed, forcing page reload')
          window.location.reload()
        }
      }, 3000)
      
      // Reset activity tracking
      setLastActivity(Date.now())
      setIsStuck(false)
      setForceShow(false)
      
      console.log('✅ App recovery completed')
    } catch (error) {
      console.error('❌ Recovery failed:', error)
      // Force reload as absolute last resort
      setTimeout(() => window.location.reload(), 2000)
    } finally {
      setIsRecovering(false)
    }
  }

  if (!isStuck && !forceShow) {
    return null
  }

  return (
    <Alert variant="destructive" className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Приложение может зависнуть</span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRecover}
          disabled={isRecovering}
          className="ml-2"
        >
          {isRecovering ? (
            <>
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
              Восстановление...
            </>
          ) : (
            <>
              <RefreshCw className="mr-1 h-3 w-3" />
              Восстановить
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  )
}