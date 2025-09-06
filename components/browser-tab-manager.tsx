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
          
          // Delay recovery slightly to allow browser to stabilize
          recoveryTimeout.current = setTimeout(async () => {
            // Prevent multiple concurrent recovery attempts
            if (isRecovering.current) {
              console.log('Recovery already in progress, skipping')
              return
            }
            
            isRecovering.current = true
            
            try {
              // Wait for browser to stabilize
              await waitForBrowserStabilization()
              
              // For frozen pages, we need to force a more comprehensive recovery
              if (pageFrozen.current) {
                console.log('Attempting comprehensive recovery for frozen page...')
                
                const recoverySuccess = await recoverFromFrozenPage(async () => {
                  // First, try to force token refresh through Supabase client
                  if (typeof supabase._forceTokenRefresh === 'function') {
                    console.log('Forcing token refresh through Supabase client...')
                    const tokenRefreshed = await supabase._forceTokenRefresh()
                    if (tokenRefreshed) {
                      console.log('✅ Token refresh completed through Supabase client')
                    } else {
                      console.error('Token refresh failed through Supabase client')
                    }
                    return tokenRefreshed
                  } else {
                    // Fallback to standard session refresh
                    console.log('Forcing token refresh through standard method...')
                    const { error: refreshError } = await supabase.auth.refreshSession()
                    if (refreshError) {
                      console.error('Token refresh failed:', refreshError)
                      return false
                    } else {
                      console.log('✅ Token refresh completed through standard method')
                      return true
                    }
                  }
                })
                
                // Then try to recover Supabase connection
                if (typeof supabase._recoverConnection === 'function') {
                  console.log('Attempting Supabase connection recovery...')
                  const connectionRecoverySuccess = await supabase._recoverConnection()
                  if (connectionRecoverySuccess) {
                    console.log('✅ Supabase connection recovered successfully')
                  } else {
                    console.error('❌ Failed to recover Supabase connection')
                  }
                }
                
                // Dispatch custom event for components to refresh their data
                window.dispatchEvent(new CustomEvent('comprehensiveRecovery', {
                  detail: { hiddenDuration, frozen: true }
                }))
                
                pageFrozen.current = false
              } else {
                // Standard recovery for shorter suspensions
                // Recover Supabase connection
                if (typeof supabase._recoverConnection === 'function') {
                  console.log('Attempting Supabase connection recovery...')
                  const recoverySuccess = await supabase._recoverConnection()
                  if (recoverySuccess) {
                    console.log('✅ Supabase connection recovered successfully')
                    // Dispatch custom event for components to refresh their data
                    window.dispatchEvent(new CustomEvent('supabaseRecovered'))
                  } else {
                    console.error('❌ Failed to recover Supabase connection')
                    window.dispatchEvent(new CustomEvent('supabaseRecoveryFailed'))
                  }
                }
              }
              
              // Check if page content is corrupted
              const bodyText = document.body.textContent || ''
              const hasValidContent = bodyText.length > 100 && !bodyText.includes('████')
              
              if (!hasValidContent) {
                console.error('🚨 Page content corrupted after suspension!')
                
                // Trigger custom recovery event
                window.dispatchEvent(new CustomEvent('pageCorrupted', {
                  detail: { hiddenDuration, bodyTextLength: bodyText.length }
                }))
              } else {
                // Restore scroll position
                restoreScrollPosition()
              }
            } catch (error) {
              console.error('Error during tab restoration:', error)
            } finally {
              isRecovering.current = false
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