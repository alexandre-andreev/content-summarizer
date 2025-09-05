'use client'

import { useEffect, useRef } from 'react'

interface PurpleBarDetectorProps {
  onPurpleBarDetected?: () => void
  checkInterval?: number
  enabled?: boolean
}

export function PurpleBarDetector({ 
  onPurpleBarDetected, 
  checkInterval = 2000,  // Faster checking
  enabled = true 
}: PurpleBarDetectorProps) {
  const detectionRef = useRef(0)
  const lastValidContentRef = useRef('')

  useEffect(() => {
    if (!enabled) return

    const detectPurpleBars = () => {
      try {
        const bodyText = document.body.textContent || ''
        const bodyHTML = document.body.innerHTML || ''
        
        // Enhanced detection methods for purple bars
        const indicators = {
          // Basic content checks
          emptyContent: bodyText.length < 50,
          veryShortContent: bodyText.length < 200 && bodyText.includes('История'),
          
          // Purple bar character patterns
          purpleChars: bodyText.includes('████') || bodyText.includes('▓▓▓▓') || bodyText.includes('░░░░'),
          blockChars: /[█▓▒░]{4,}/.test(bodyText),
          
          // UI corruption indicators
          stuckSkeletons: document.querySelectorAll('[class*="skeleton"]').length > 3,
          perpetualSpinners: document.querySelectorAll('.animate-spin').length > 1,
          missingCards: document.querySelectorAll('.card').length === 0 && bodyText.includes('саммари'),
          
          // Content corruption
          corruptedHTML: bodyHTML.includes('undefined') || bodyHTML.includes('null') || bodyHTML.includes('[object Object]'),
          emptyDivs: document.querySelectorAll('div:empty').length > 10,
          
          // Navigation issues
          missingButtons: document.querySelectorAll('button').length < 2 && bodyText.includes('История'),
          brokenLayout: !document.querySelector('[class*="container"]') && bodyText.includes('саммари')
        }
        
        const detectedCount = Object.values(indicators).filter(Boolean).length
        const hasValidContent = bodyText.length > 300 && !indicators.purpleChars && !indicators.blockChars
        
        // Store last valid content for comparison
        if (hasValidContent) {
          lastValidContentRef.current = bodyText.substring(0, 100)
        }
        
        // Detection logic: need multiple indicators OR obvious corruption
        const shouldTrigger = detectedCount >= 2 || 
                             indicators.purpleChars || 
                             indicators.blockChars ||
                             (bodyText.length < 100 && bodyText.includes('История'))
        
        if (shouldTrigger) {
          detectionRef.current++
          
          // Dispatch debug event
          window.dispatchEvent(new CustomEvent('purpleBarDebug', {
            detail: `Detection ${detectionRef.current}: ${Object.entries(indicators).filter(([k,v]) => v).map(([k]) => k).join(', ')}`
          }))
          
          console.warn(`🟣 Purple bars detected (${detectionRef.current}):`, {
            indicators,
            detectedCount,
            bodyTextLength: bodyText.length,
            bodyPreview: bodyText.substring(0, 100),
            lastValidContent: lastValidContentRef.current
          })
          
          // Trigger recovery after 2 consecutive detections to avoid false positives
          if (detectionRef.current >= 2 && onPurpleBarDetected) {
            console.error('🚨 Confirmed purple bars - triggering recovery')
            window.dispatchEvent(new CustomEvent('purpleBarDebug', {
              detail: 'RECOVERY TRIGGERED'
            }))
            onPurpleBarDetected()
            detectionRef.current = 0 // Reset counter
          }
        } else {
          // Reset counter if no issues detected
          detectionRef.current = 0
        }
        
      } catch (error) {
        console.error('Error in purple bar detection:', error)
      }
    }

    // Immediate check on mount
    setTimeout(detectPurpleBars, 500)
    
    // Periodic checks
    const interval = setInterval(detectPurpleBars, checkInterval)
    
    // Check on visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Tab became visible - checking for purple bars')
        setTimeout(detectPurpleBars, 300)
        setTimeout(detectPurpleBars, 1000) // Double check
      }
    }
    
    // Check on focus events
    const handleFocus = () => {
      setTimeout(detectPurpleBars, 200)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [onPurpleBarDetected, checkInterval, enabled])

  return null
}