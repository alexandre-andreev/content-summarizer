'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'

export function EmergencyRecovery() {
  const handleEmergencyReload = () => {
    console.log('🚨 Emergency reload triggered')
    
    // Clear only problematic storage, preserve auth
    try {
      // Remove potentially corrupted data but keep auth tokens
      const authKeys = ['sb-access-token', 'sb-refresh-token', 'supabase.auth.token']
      const preserveKeys: string[] = []
      
      // Save auth-related keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth') || authKeys.includes(key))) {
          preserveKeys.push(key)
        }
      }
      
      const savedAuth: Record<string, string> = {}
      preserveKeys.forEach(key => {
        const value = localStorage.getItem(key)
        if (value) savedAuth[key] = value
      })
      
      // Clear storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Restore auth data
      Object.entries(savedAuth).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
      
    } catch (e) {
      console.warn('Failed to clear storage safely')
    }
    
    // Instead of hard refresh, try soft recovery first
    try {
      // Force DOM refresh without losing auth
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.set('recovery', Date.now().toString())
      window.history.replaceState({}, '', currentUrl.toString())
      
      // Force page repaint
      document.body.style.display = 'none'
      document.body.offsetHeight
      document.body.style.display = ''
      
      // If still broken after 3 seconds, do hard refresh
      setTimeout(() => {
        const bodyText = document.body.textContent || ''
        if (bodyText.length < 100 || bodyText.includes('████')) {
          console.log('🚨 Soft recovery failed, forcing hard reload')
          window.location.reload()
        }
      }, 3000)
      
    } catch (error) {
      console.error('Recovery failed:', error)
      window.location.reload()
    }
  }

  return (
    <Button
      onClick={handleEmergencyReload}
      variant="destructive"
      size="sm"
      className="fixed bottom-4 right-4 z-[9999] shadow-lg"
      title="Если страница зависла, нажмите для принудительной перезагрузки"
    >
      <RotateCcw className="mr-1 h-3 w-3" />
      Экстренное восстановление
    </Button>
  )
}