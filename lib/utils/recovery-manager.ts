/**
 * Global recovery manager to prevent conflicts between pages
 * during tab suspension recovery
 */

class RecoveryManager {
  private isRecovering = false
  private recoveryPromise: Promise<boolean> | null = null
  private lastRecoveryTime = 0
  private recoveryTimeout: NodeJS.Timeout | null = null

  /**
   * Check if recovery is currently in progress
   */
  isRecoveryInProgress(): boolean {
    return this.isRecovering
  }

  /**
   * Start recovery process with conflict prevention
   */
  async startRecovery(
    recoveryFunction: () => Promise<boolean>,
    timeoutMs: number = 10000
  ): Promise<boolean> {
    // If already recovering, wait for current recovery to complete
    if (this.isRecovering && this.recoveryPromise) {
      console.log('🔄 Recovery already in progress, waiting for completion...')
      return await this.recoveryPromise
    }

    // Prevent too frequent recovery attempts
    const now = Date.now()
    if (now - this.lastRecoveryTime < 2000) {
      console.log('🔄 Recovery too recent, skipping...')
      return false
    }

    this.isRecovering = true
    this.lastRecoveryTime = now

    // Create recovery promise with timeout
    this.recoveryPromise = this.executeRecovery(recoveryFunction, timeoutMs)

    try {
      const result = await this.recoveryPromise
      return result
    } finally {
      this.isRecovering = false
      this.recoveryPromise = null
    }
  }

  private async executeRecovery(
    recoveryFunction: () => Promise<boolean>,
    timeoutMs: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // Set timeout
      this.recoveryTimeout = setTimeout(() => {
        console.warn('⚠️ Recovery timeout, forcing completion')
        this.isRecovering = false
        this.recoveryPromise = null
        resolve(false)
      }, timeoutMs)

      // Execute recovery
      recoveryFunction()
        .then((result) => {
          if (this.recoveryTimeout) {
            clearTimeout(this.recoveryTimeout)
            this.recoveryTimeout = null
          }
          console.log(`✅ Recovery completed: ${result ? 'success' : 'failed'}`)
          resolve(result)
        })
        .catch((error) => {
          console.error('❌ Recovery error:', error)
          if (this.recoveryTimeout) {
            clearTimeout(this.recoveryTimeout)
            this.recoveryTimeout = null
          }
          resolve(false)
        })
    })
  }

  /**
   * Force reset recovery state (use with caution)
   */
  forceReset(): void {
    console.log('🔄 Force resetting recovery state')
    this.isRecovering = false
    this.recoveryPromise = null
    this.lastRecoveryTime = 0
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout)
      this.recoveryTimeout = null
    }
  }

  /**
   * Get recovery status for debugging
   */
  getStatus() {
    return {
      isRecovering: this.isRecovering,
      lastRecoveryTime: this.lastRecoveryTime,
      timeSinceLastRecovery: Date.now() - this.lastRecoveryTime
    }
  }
}

// Export singleton instance
export const recoveryManager = new RecoveryManager()
