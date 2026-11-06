export interface LockRecord {
  reportId: string;
  userId: string;
  userName: string;
  userRole: string;
  acquiredAt: number;
  expiresAt: number;
  version: number;
}

export class LockManager {
  private static locks: Map<string, LockRecord> = new Map();
  public static readonly DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Acquire or renew a 10-minute soft edit lock.
   */
  static acquireLock(
    reportId: string,
    userId: string,
    userName: string,
    userRole: string,
    currentVersion: number,
    ttlMs: number = this.DEFAULT_TTL_MS
  ): { success: boolean; message: string; lock?: LockRecord } {
    const now = Date.now();
    const existing = this.locks.get(reportId);

    // If active lock exists
    if (existing && existing.expiresAt > now) {
      if (existing.userId === userId) {
        // Renew lease for the same user
        existing.expiresAt = now + ttlMs;
        existing.version = currentVersion;
        return {
          success: true,
          message: 'Lock renewed successfully',
          lock: existing
        };
      }

      // Held by another user
      const remainingSeconds = Math.ceil((existing.expiresAt - now) / 1000);
      return {
        success: false,
        message: `${existing.userName} is currently reviewing this report. Lock expires in ${remainingSeconds}s.`,
        lock: existing
      };
    }

    // Lock is either absent or expired: claim it
    const newLock: LockRecord = {
      reportId,
      userId,
      userName,
      userRole,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      version: currentVersion
    };

    this.locks.set(reportId, newLock);
    return {
      success: true,
      message: 'Lock acquired',
      lock: newLock
    };
  }

  /**
   * Release lock
   */
  static releaseLock(reportId: string, userId: string): boolean {
    const existing = this.locks.get(reportId);
    if (!existing) return true;
    if (existing.userId === userId) {
      this.locks.delete(reportId);
      return true;
    }
    return false;
  }

  /**
   * Force release by admin/super_admin if needed
   */
  static forceRelease(reportId: string): void {
    this.locks.delete(reportId);
  }

  /**
   * Get active lock status
   */
  static getLock(reportId: string): LockRecord | null {
    const existing = this.locks.get(reportId);
    if (!existing) return null;
    if (existing.expiresAt <= Date.now()) {
      this.locks.delete(reportId);
      return null;
    }
    return existing;
  }

  /**
   * Validate optimistic concurrency version check
   */
  static checkOptimisticConcurrency(
    expectedVersion: number,
    actualVersion: number
  ): { valid: boolean; error?: string } {
    if (expectedVersion !== actualVersion) {
      return {
        valid: false,
        error: `Conflict: Stale edit detected. Current report version is ${actualVersion}, but update was submitted for version ${expectedVersion}. Please refresh.`
      };
    }
    return { valid: true };
  }
}

