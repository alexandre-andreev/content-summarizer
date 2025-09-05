'use client'

import { useEffect } from 'react'

export function BrowserTabManager() {
  useEffect(() => {
    let wasHidden = false
    let hideStartTime = 0
    
    const handleVisibilityChange = () => {
      const isHidden = document.hidden
      
      if (isHidden && !wasHidden) {
        // Tab is being hidden
        console.log('🔄 Tab being hidden - preparing for suspension')
        wasHidden = true
        hideStartTime = Date.now()
        
        // Store current scroll position and form states
        try {
          sessionStorage.setItem('scrollPosition', window.scrollY.toString())
          sessionStorage.setItem('hiddenAt', hideStartTime.toString())
        } catch (e) {
          console.warn('Failed to store suspension state')
        }
        
      } else if (!isHidden && wasHidden) {
        // Tab is being shown again
        const hiddenDuration = Date.now() - hideStartTime
        console.log('🔄 Tab restored after', hiddenDuration / 1000, 'seconds')
        
        wasHidden = false
        
        // If was hidden for more than 5 seconds, likely suspended
        if (hiddenDuration > 5000) {
          console.warn('⚠️ Long suspension detected, forcing recovery')
          
          // Force immediate recovery
          setTimeout(() => {
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
              try {
                const savedScroll = sessionStorage.getItem('scrollPosition')
                if (savedScroll) {
                  window.scrollTo(0, parseInt(savedScroll))
                  sessionStorage.removeItem('scrollPosition')
                }
              } catch (e) {
                console.warn('Failed to restore scroll position')
              }
            }
          }, 500)
        }
      }
    }

    // Also monitor for page freeze patterns
    const checkPageHealth = () => {
      const startTime = performance.now()
      
      // Request animation frame should execute quickly
      requestAnimationFrame(() => {
        const executionTime = performance.now() - startTime
        
        // If RAF takes too long, page might be frozen
        if (executionTime > 100) {
          console.warn('⚠️ Slow RAF detected:', executionTime + 'ms')
          
          window.dispatchEvent(new CustomEvent('pageSlow', {
            detail: { executionTime }
          }))
        }
      })
    }

    // Check page health every 10 seconds
    const healthInterval = setInterval(checkPageHealth, 10000)
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(healthInterval)
    }
  }, [])

  return null
}