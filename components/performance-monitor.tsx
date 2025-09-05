'use client'

import { useEffect } from 'react'

interface PerformanceMonitorProps {
  onPerformanceIssue?: (issue: string) => void
}

export function PerformanceMonitor({ onPerformanceIssue }: PerformanceMonitorProps) {
  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()
    let isMonitoring = true

    const monitorFrameRate = () => {
      if (!isMonitoring) return

      const currentTime = performance.now()
      frameCount++

      // Check FPS every second
      if (currentTime - lastTime >= 1000) {
        const fps = frameCount
        frameCount = 0
        lastTime = currentTime

        // If FPS drops below 10, app might be frozen
        if (fps < 10) {
          console.warn('Low FPS detected:', fps)
          onPerformanceIssue?.('Low FPS: ' + fps)
        }
      }

      requestAnimationFrame(monitorFrameRate)
    }

    // Start monitoring
    requestAnimationFrame(monitorFrameRate)

    // Monitor memory usage if available
    const monitorMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const usedMB = memory.usedJSHeapSize / 1024 / 1024
        const limitMB = memory.jsHeapSizeLimit / 1024 / 1024
        
        // Warn if using more than 80% of available memory
        if (usedMB / limitMB > 0.8) {
          console.warn('High memory usage:', usedMB.toFixed(2), 'MB')
          onPerformanceIssue?.('High memory usage: ' + usedMB.toFixed(2) + 'MB')
        }
      }
    }

    const memoryInterval = setInterval(monitorMemory, 10000) // Check every 10 seconds

    // Monitor for long tasks
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            if (entry.duration > 50) { // Tasks longer than 50ms
              console.warn('Long task detected:', entry.duration + 'ms')
              onPerformanceIssue?.('Long task: ' + entry.duration.toFixed(2) + 'ms')
            }
          })
        })
        
        observer.observe({ entryTypes: ['longtask'] })
        
        return () => {
          isMonitoring = false
          observer.disconnect()
          clearInterval(memoryInterval)
        }
      } catch (e) {
        console.warn('PerformanceObserver not supported')
      }
    }

    return () => {
      isMonitoring = false
      clearInterval(memoryInterval)
    }
  }, [onPerformanceIssue])

  return null
}