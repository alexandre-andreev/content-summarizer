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

  // Monitor for app becoming unresponsive
  useEffect(() => {
    const checkActivity = () => {
      const now = Date.now()
      const timeSinceActivity = now - lastActivity
      
      // If no activity for 30 seconds and app seems stuck
      if (timeSinceActivity > 30000) {
        setIsStuck(true)
      }
    }

    // Update activity on user interactions
    const updateActivity = () => {
      setLastActivity(Date.now())
      setIsStuck(false)
    }

    // Listen for user interactions
    const events = ['click', 'keydown', 'scroll', 'mousemove']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    // Check periodically
    const interval = setInterval(checkActivity, 5000)

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
      clearInterval(interval)
    }
  }, [lastActivity])

  const handleRecover = async () => {
    setIsRecovering(true)
    
    try {
      // Clear any stuck states
      console.log('Attempting app recovery...')
      
      // Clear localStorage if needed
      const stuckKeys = ['lastSummary', 'lastSummaryTime']
      stuckKeys.forEach(key => {
        try {
          localStorage.removeItem(key)
        } catch (e) {
          console.warn('Failed to clear localStorage key:', key)
        }
      })
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc()
      }
      
      // Call custom recovery function
      if (onRecover) {
        await onRecover()
      }
      
      // Reset activity tracking
      setLastActivity(Date.now())
      setIsStuck(false)
      
      console.log('App recovery completed')
    } catch (error) {
      console.error('Recovery failed:', error)
    } finally {
      setIsRecovering(false)
    }
  }

  if (!isStuck) {
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