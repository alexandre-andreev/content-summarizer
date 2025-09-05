'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'

export function EmergencyRecovery() {
  const handleEmergencyReload = () => {
    console.log('🚨 Emergency reload triggered')
    
    // Clear all storage
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch (e) {
      console.warn('Failed to clear storage')
    }
    
    // Force hard refresh
    window.location.href = window.location.href
  }

  return (
    <Button
      onClick={handleEmergencyReload}
      variant=\"destructive\"
      size=\"sm\"
      className=\"fixed bottom-4 right-4 z-[9999] shadow-lg\"
      title=\"Если страница зависла, нажмите для принудительной перезагрузки\"
    >
      <RotateCcw className=\"mr-1 h-3 w-3\" />
      Экстренное восстановление
    </Button>
  )
}