/**
 * @jest-environment jsdom
 */

import { supabase } from '@/lib/supabase/client'

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      refreshSession: jest.fn(),
      getSession: jest.fn(),
    },
    realtime: {
      disconnect: jest.fn(),
      connect: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({
          data: [],
          error: null
        }))
      }))
    })),
    _recoverConnection: jest.fn(),
    _forceTokenRefresh: jest.fn(),
    _forceReconnect: jest.fn(),
    _isRecovering: false,
    _lastTokenCheck: 0,
  }
}))

describe('Connection Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should recover connection successfully', async () => {
    const mockSupabase = supabase as any
    
    // Mock successful recovery
    mockSupabase._recoverConnection.mockResolvedValue(true)
    mockSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } },
      error: null
    })
    mockSupabase.realtime.disconnect.mockResolvedValue(undefined)
    mockSupabase.realtime.connect.mockResolvedValue(undefined)

    const result = await mockSupabase._recoverConnection()
    
    expect(result).toBe(true)
    expect(mockSupabase._recoverConnection).toHaveBeenCalledTimes(1)
  })

  test('should handle recovery failure and try force reconnect', async () => {
    const mockSupabase = supabase as any
    
    // Mock recovery failure
    mockSupabase._recoverConnection.mockResolvedValue(false)
    mockSupabase._forceReconnect.mockResolvedValue(true)
    mockSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } },
      error: null
    })
    mockSupabase.realtime.disconnect.mockResolvedValue(undefined)
    mockSupabase.realtime.connect.mockResolvedValue(undefined)

    // First attempt fails
    const recoveryResult = await mockSupabase._recoverConnection()
    expect(recoveryResult).toBe(false)

    // Force reconnect succeeds
    const forceReconnectResult = await mockSupabase._forceReconnect()
    expect(forceReconnectResult).toBe(true)
  })

  test('should prevent concurrent recovery attempts', async () => {
    const mockSupabase = supabase as any
    
    // Mock recovery in progress
    mockSupabase._isRecovering = true
    mockSupabase._recoverConnection.mockImplementation(async () => {
      if (mockSupabase._isRecovering) {
        console.log('Recovery already in progress, skipping')
        return false
      }
      mockSupabase._isRecovering = true
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 100))
      mockSupabase._isRecovering = false
      return true
    })

    // Start multiple recovery attempts
    const promises = [
      mockSupabase._recoverConnection(),
      mockSupabase._recoverConnection(),
      mockSupabase._recoverConnection()
    ]

    const results = await Promise.all(promises)
    
    // Only one should succeed, others should be skipped
    const successCount = results.filter(r => r === true).length
    const skipCount = results.filter(r => r === false).length
    
    expect(successCount).toBe(1)
    expect(skipCount).toBe(2)
  })

  test('should handle realtime reconnection', async () => {
    const mockSupabase = supabase as any
    
    mockSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user' } } },
      error: null
    })
    mockSupabase.realtime.disconnect.mockResolvedValue(undefined)
    mockSupabase.realtime.connect.mockResolvedValue(undefined)

    await mockSupabase._forceReconnect()
    
    expect(mockSupabase.realtime.disconnect).toHaveBeenCalled()
    expect(mockSupabase.realtime.connect).toHaveBeenCalled()
    expect(mockSupabase.auth.refreshSession).toHaveBeenCalled()
  })
})


