// Utility functions for handling page freezing and recovery scenarios

/**
 * Detects if the page has been frozen for an extended period
 * @param hiddenStartTime - Timestamp when the page was hidden
 * @param threshold - Threshold in milliseconds to consider as frozen (default 60 seconds)
 * @returns boolean indicating if the page was frozen
 */
export const isPageFrozen = (hiddenStartTime: number, threshold: number = 60000): boolean => {
  if (!hiddenStartTime) return false
  const hiddenDuration = Date.now() - hiddenStartTime
  return hiddenDuration > threshold
}

/**
 * Attempts to recover from a frozen page state
 * @param recoveryCallback - Function to call when recovery is needed
 * @returns Promise<boolean> indicating if recovery was successful
 */
export const recoverFromFrozenPage = async (
  recoveryCallback: () => Promise<boolean>
): Promise<boolean> => {
  try {
    console.log('Attempting recovery from frozen page...')
    const success = await recoveryCallback()
    if (success) {
      console.log('✅ Page recovery successful')
      return true
    } else {
      console.warn('⚠️ Page recovery attempt failed')
      return false
    }
  } catch (error) {
    console.error('❌ Error during page recovery:', error)
    return false
  }
}

/**
 * Delays execution to allow browser to stabilize after tab restoration
 * @param delay - Delay in milliseconds (default 500ms)
 * @returns Promise<void>
 */
export const waitForBrowserStabilization = (delay: number = 500): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * Checks if the current tab is visible
 * @returns boolean indicating if tab is visible
 */
export const isTabVisible = (): boolean => {
  return !document.hidden
}

/**
 * Restores scroll position after tab restoration
 */
export const restoreScrollPosition = (): void => {
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

/**
 * Stores current scroll position before tab is hidden
 */
export const storeScrollPosition = (): void => {
  try {
    sessionStorage.setItem('scrollPosition', window.scrollY.toString())
  } catch (e) {
    console.warn('Failed to store scroll position')
  }
}

/**
 * Monitors page health by checking RequestAnimationFrame execution time
 * @param callback - Function to call when slow RAF is detected
 * @returns function to stop monitoring
 */
export const monitorPageHealth = (
  callback: (executionTime: number) => void
): (() => void) => {
  let isMonitoring = true
  let lastCheck = 0
  
  const checkHealth = () => {
    if (!isMonitoring) return
    
    const now = Date.now()
    // Skip check if we just did one (within 5 seconds)
    if (now - lastCheck < 5000) {
      requestAnimationFrame(checkHealth)
      return
    }
    
    lastCheck = now
    const startTime = performance.now()
    
    requestAnimationFrame(() => {
      const executionTime = performance.now() - startTime
      
      // If RAF takes too long, page might be frozen
      if (executionTime > 5000) {
        console.warn('⚠️ Slow RAF detected during health check:', executionTime + 'ms')
        callback(executionTime)
      }
      
      // Schedule next check
      requestAnimationFrame(checkHealth)
    })
  }
  
  // Start monitoring
  requestAnimationFrame(checkHealth)
  
  // Return cleanup function
  return () => {
    isMonitoring = false
  }
}