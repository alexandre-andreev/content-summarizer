'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { 
  isPageFrozen, 
  recoverFromFrozenPage, 
  waitForBrowserStabilization, 
  isTabVisible, 
  restoreScrollPosition, 
  storeScrollPosition,
  monitorPageHealth
} from '@/lib/utils/page-recovery'
import { recoveryManager } from '@/lib/utils/recovery-manager'

export function BrowserTabManager() {
  const recoveryTimeout = useRef<NodeJS.Timeout | null>(null)
  const isRecovering = useRef(false)
  const pageFrozen = useRef(false)
  const healthCheckFailures = useRef<number>(0)
  const stopHealthMonitoring = useRef<(() => void) | null>(null)
  
  useEffect(() => {
    let wasHidden = false
    let hideStartTime = 0
    
    const handleVisibilityChange = async () => {
      const isHidden = document.hidden
      
      if (isHidden && !wasHidden) {
        // Tab is being hidden
        console.log('🔄 Tab being hidden - preparing for suspension')
        wasHidden = true
        hideStartTime = Date.now()
        
        // Store current scroll position
        storeScrollPosition()
        
        // Store hidden time for recovery
        try {
          sessionStorage.setItem('hiddenAt', hideStartTime.toString())
        } catch (e) {
          console.warn('Failed to store suspension state')
        }
        
        // Reset health check failures when tab is hidden
        healthCheckFailures.current = 0
        
      } else if (!isHidden && wasHidden) {
        // Tab is being shown again
        const hiddenDuration = Date.now() - hideStartTime
        console.log('🔄 Tab restored after', hiddenDuration / 1000, 'seconds')
        
        wasHidden = false
        
        // Clear any pending recovery timeout
        if (recoveryTimeout.current) {
          clearTimeout(recoveryTimeout.current)
          recoveryTimeout.current = null
        }
        
        // If was hidden for more than 3 seconds, likely suspended
        if (hiddenDuration > 3000) {
          console.warn('⚠️ Significant suspension detected, initiating recovery')
          
          // Check if this was a long suspension (frozen page)
          if (isPageFrozen(hideStartTime)) {
            console.warn('⚠️ Long suspension detected, page may be frozen')
            pageFrozen.current = true
          }
          
          // Use global recovery manager to prevent conflicts
        recoveryTimeout.current = setTimeout(async () => {
          try {
            console.log('🔄 Simple recovery: refreshing session and dispatching event')
            
            // Force session refresh to ensure token is valid
            const { data: { session }, error } = await supabase.auth.refreshSession()
            
            if (error) {
              console.error('❌ Session refresh failed:', error)
              window.dispatchEvent(new CustomEvent('recoveryFailed'))
              return
            }
            
            if (session) {
              console.log('✅ Session refreshed successfully')
              
              // Check if token was actually refreshed
              const tokenExpiry = new Date(session.expires_at! * 1000)
              const now = new Date()
              const timeUntilExpiry = tokenExpiry.getTime() - now.getTime()
              const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60))
              
              console.log('🔑 Token after refresh:', {
                expiresAt: tokenExpiry.toISOString(),
                timeUntilExpiry: `${minutesUntilExpiry} minutes`,
                isExpired: timeUntilExpiry < 0
              })
            }
            
            // Dispatch simple recovery event
            window.dispatchEvent(new CustomEvent('simpleRecovery', {
              detail: { hiddenDuration, frozen: pageFrozen.current }
            }))
            
            console.log('✅ Simple recovery completed')
          } catch (error) {
            console.error('❌ Simple recovery failed:', error)
            window.dispatchEvent(new CustomEvent('recoveryFailed'))
          }
        }, 500)
        }
      }
    }

    // Monitor for page freeze patterns with improved detection
    stopHealthMonitoring.current = monitorPageHealth((executionTime) => {
      healthCheckFailures.current++
      
      // If we have multiple consecutive failures, the page is likely frozen
      if (healthCheckFailures.current >= 3) {
        console.error('🚨 Page appears to be frozen, initiating emergency recovery')
        pageFrozen.current = true
        
        // Dispatch comprehensive recovery event
        window.dispatchEvent(new CustomEvent('comprehensiveRecovery', {
          detail: { executionTime, frozen: true }
        }))
        
        // Reset failure counter after triggering recovery
        healthCheckFailures.current = 0
      }
      
      // Only dispatch event if we're not already recovering
      if (!isRecovering.current) {
        window.dispatchEvent(new CustomEvent('pageSlow', {
          detail: { executionTime }
        }))
      }
    })

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (stopHealthMonitoring.current) {
        stopHealthMonitoring.current()
      }
      if (recoveryTimeout.current) {
        clearTimeout(recoveryTimeout.current)
      }
    }
  }, [])

  return null
}