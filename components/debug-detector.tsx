'use client'

import React, { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'

interface DebugDetectorProps {
  enabled?: boolean
}

export function DebugDetector({ enabled = true }: DebugDetectorProps) {
  const [detections, setDetections] = useState<string[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) return

    // Listen for our purple bar detection events
    const handleDetection = (event: CustomEvent) => {
      const timestamp = new Date().toLocaleTimeString()
      const detection = `${timestamp}: ${event.detail || 'Purple bars detected'}`
      
      setDetections(prev => [...prev.slice(-4), detection]) // Keep last 5
      setVisible(true)
    }

    // Custom event listener for debugging
    window.addEventListener('purpleBarDebug', handleDetection as EventListener)

    return () => {
      window.removeEventListener('purpleBarDebug', handleDetection as EventListener)
    }
  }, [enabled])

  if (!visible || detections.length === 0) {
    return null
  }

  return (
    <Alert className="fixed top-20 left-4 right-4 z-50 max-w-md mx-auto bg-yellow-50 border-yellow-200">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-center justify-between mb-2">
          <strong>🔍 Purple Bar Debug</strong>
          <Button size="sm" variant="ghost" onClick={() => setVisible(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="text-xs space-y-1">
          {detections.map((detection, i) => (
            <div key={i} className="text-gray-600">{detection}</div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  )
}