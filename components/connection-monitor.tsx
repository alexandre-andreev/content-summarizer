'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

interface ConnectionMonitorProps {
  onConnectionLost?: () => void
  onConnectionRestored?: () => void
}

export function ConnectionMonitor({ onConnectionLost, onConnectionRestored }: ConnectionMonitorProps) {
  const lastHeartbeat = useRef<number>(Date.now())
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null)
  const isMonitoring = useRef<boolean>(false)
  const connectionLost = useRef<boolean>(false)

  // Test connection health
  const testConnection = async (): Promise<boolean> => {
    try {
      // Try a simple query to test connection
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1)
      
      if (error) {
        console.warn('Connection test failed:', error.message)
        return false
      }
      
      return true
    } catch (error) {
      console.warn('Connection test exception:', error)
      return false
    }
  }

  // Force reconnection
  const forceReconnect = async (): Promise<boolean> => {
    try {
      console.log('🔄 Connection monitor: forcing reconnection...')
      
      if (typeof supabase._forceReconnect === 'function') {
        const success = await supabase._forceReconnect()
        if (success) {
          console.log('✅ Connection monitor: reconnection successful')
          return true
        }
      }
      
      // Fallback to standard recovery
      if (typeof supabase._recoverConnection === 'function') {
        const success = await supabase._recoverConnection()
        if (success) {
          console.log('✅ Connection monitor: standard recovery successful')
          return true
        }
      }
      
      console.error('❌ Connection monitor: all reconnection attempts failed')
      return false
    } catch (error) {
      console.error('❌ Connection monitor: reconnection exception:', error)
      return false
    }
  }

  // Start monitoring
  const startMonitoring = () => {
    if (isMonitoring.current) return
    
    isMonitoring.current = true
    console.log('🔍 Connection monitor: starting health checks')
    
    heartbeatInterval.current = setInterval(async () => {
      const now = Date.now()
      const timeSinceLastHeartbeat = now - lastHeartbeat.current
      
      // If we haven't had a heartbeat in 2 minutes, test connection
      if (timeSinceLastHeartbeat > 120000) {
        console.log('🔍 Connection monitor: testing connection health...')
        
        const isHealthy = await testConnection()
        
        if (!isHealthy && !connectionLost.current) {
          console.warn('⚠️ Connection monitor: connection lost')
          connectionLost.current = true
          onConnectionLost?.()
          
          // Try to reconnect
          const reconnected = await forceReconnect()
          if (reconnected) {
            console.log('✅ Connection monitor: connection restored')
            connectionLost.current = false
            lastHeartbeat.current = Date.now()
            onConnectionRestored?.()
          }
        } else if (isHealthy && connectionLost.current) {
          console.log('✅ Connection monitor: connection restored')
          connectionLost.current = false
          lastHeartbeat.current = Date.now()
          onConnectionRestored?.()
        } else if (isHealthy) {
          lastHeartbeat.current = now
        }
      }
    }, 30000) // Check every 30 seconds
  }

  // Stop monitoring
  const stopMonitoring = () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current)
      heartbeatInterval.current = null
    }
    isMonitoring.current = false
    console.log('🔍 Connection monitor: stopped')
  }

  // Update heartbeat on user activity
  const updateHeartbeat = () => {
    lastHeartbeat.current = Date.now()
  }

  useEffect(() => {
    // Start monitoring when component mounts
    startMonitoring()

    // Update heartbeat on user interactions
    const events = ['click', 'keydown', 'scroll', 'mousemove']
    events.forEach(event => {
      document.addEventListener(event, updateHeartbeat, { passive: true })
    })

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔍 Connection monitor: tab became visible, testing connection')
        updateHeartbeat()
        testConnection().then(isHealthy => {
          if (!isHealthy && !connectionLost.current) {
            console.warn('⚠️ Connection monitor: connection lost on tab focus')
            connectionLost.current = true
            onConnectionLost?.()
            forceReconnect().then(reconnected => {
              if (reconnected) {
                connectionLost.current = false
                onConnectionRestored?.()
              }
            })
          }
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopMonitoring()
      events.forEach(event => {
        document.removeEventListener(event, updateHeartbeat)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [onConnectionLost, onConnectionRestored])

  return null
}


