'use client'

import { useEffect } from 'react'

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

  useEffect(() => {
    if (!enabled) return

    const detectPurpleBars = () => {
      try {
        const bodyText = document.body.textContent || ''
        const bodyHTML = document.body.innerHTML || ''
        
        // Multiple detection methods for purple bars
        const indicators = {
          emptyContent: bodyText.length < 100,
          purpleChars: bodyText.includes('████') || bodyText.includes('▓▓▓▓') || bodyText.includes('░░░░'),
          stuckSkeletons: document.querySelectorAll('[class*="skeleton"]').length > 5,
          perpetualSpinners: document.querySelectorAll('.animate-spin').length > 2,
          emptyCards: document.querySelectorAll('.card').length === 0 && bodyText.includes('История'),
          corruptedHTML: bodyHTML.includes('undefined') || bodyHTML.includes('null'),
          missingNavigation: !document.querySelector('button') && bodyText.includes('панели')
        }
        
        const detectedCount = Object.values(indicators).filter(Boolean).length
        
        if (detectedCount >= 2) {
          console.warn('🟣 Purple bars detected:', indicators)
          
          if (onPurpleBarDetected) {
            onPurpleBarDetected()
          }
        }
        
      } catch (error) {
        console.error('Error in purple bar detection:', error)
      }
    }

    // Initial check
    setTimeout(detectPurpleBars, 1000)
    
    // Periodic checks
    const interval = setInterval(detectPurpleBars, checkInterval)
    
    // Check on visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(detectPurpleBars, 500)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [onPurpleBarDetected, checkInterval, enabled])

  return null
}