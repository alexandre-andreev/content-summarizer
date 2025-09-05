'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw, Loader2 } from 'lucide-react'

export function EmergencyRecovery() {
  const [isRecovering, setIsRecovering] = useState(false)
  
  const handleEmergencyReload = async () => {
    console.log('🚨 Emergency recovery triggered')
    setIsRecovering(true)
    
    try {
      // Step 1: Disable purple bar detection immediately
      window.dispatchEvent(new CustomEvent('emergencyRecoveryStart'))
      
      // Step 2: Clear problematic storage while preserving auth
      const authData: Record<string, string> = {}
      
      // Preserve Supabase auth tokens
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('supabase.auth.')) {
          const value = localStorage.getItem(key)
          if (value) authData[key] = value
        }
      }
      
      // Clear all storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Restore auth tokens
      Object.entries(authData).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
      
      console.log('🔄 Storage cleared, auth preserved')
      
      // Step 3: Stop all intervals and timers
      const highestIntervalId = setInterval(() => {}, 0)
      for (let i = 1; i <= highestIntervalId; i++) {
        clearInterval(i)
      }
      
      // Step 4: Force DOM cleanup
      const allElements = document.querySelectorAll('*')
      allElements.forEach(el => {
        el.removeAttribute('style')
      })
      
      // Step 5: Force repaint with aggressive DOM manipulation
      document.body.style.visibility = 'hidden'
      document.body.style.display = 'none'
      
      // Force reflow
      document.body.offsetHeight
      
      document.body.style.display = ''
      document.body.style.visibility = 'visible'
      
      console.log('🔄 DOM repaint forced')
      
      // Step 6: Dispatch recovery completion event
      window.dispatchEvent(new CustomEvent('emergencyRecoveryComplete'))
      
      // Step 7: Wait and check if recovery worked
      setTimeout(() => {
        const bodyText = document.body.textContent || ''
        const isStillBroken = bodyText.length < 100 || 
                             bodyText.includes('████') ||
                             document.querySelectorAll('.animate-spin:not(button *)').length > 1
        
        if (isStillBroken) {
          console.log('🚨 Emergency recovery failed, forcing hard reload')
          // Hard refresh as last resort
          window.location.reload()
        } else {
          console.log('✅ Emergency recovery successful')
          setIsRecovering(false)
        }
      }, 3000)
      
    } catch (error) {
      console.error('❌ Emergency recovery failed:', error)
      // Force reload as absolute last resort
      window.location.reload()
    }
  }

  return (
    <Button
      onClick={handleEmergencyReload}
      disabled={isRecovering}
      variant="destructive"
      size="sm"
      className="fixed bottom-4 right-4 z-[9999] shadow-lg"
      title="Если страница зависла, нажмите для принудительной перезагрузки"
    >
      {isRecovering ? (
        <>
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Восстановление...
        </>
      ) : (
        <>
          <RotateCcw className="mr-1 h-3 w-3" />
          Экстренное восстановление
        </>
      )}
    </Button>
  )
}