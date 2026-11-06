export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface SlaPolicy {
  priority: Priority;
  responseTargetHours: number;
  resolutionTargetHours: number;
}

export const SLA_POLICIES: Record<Priority, SlaPolicy> = {
  critical: {
    priority: 'critical',
    responseTargetHours: 4,
    resolutionTargetHours: 24
  },
  high: {
    priority: 'high',
    responseTargetHours: 24,
    resolutionTargetHours: 72
  },
  medium: {
    priority: 'medium',
    responseTargetHours: 72,
    resolutionTargetHours: 168 // 7 days
  },
  low: {
    priority: 'low',
    responseTargetHours: 168, // 7 days
    resolutionTargetHours: 336 // 14 days
  }
};

export interface SlaEvaluation {
  isResponseBreached: boolean;
  isResolutionBreached: boolean;
  isBreached: boolean;
  responseRemainingMs: number;
  resolutionRemainingMs: number;
  responseDueAt: Date;
  resolutionDueAt: Date;
  statusLabel: string;
}

export class SlaEngine {
  /**
   * Calculate due dates from creation time and priority
   */
  static calculateDueDates(createdAt: Date, priority: Priority): { responseDueAt: Date; resolutionDueAt: Date } {
    const policy = SLA_POLICIES[priority] || SLA_POLICIES.medium;
    const responseDueAt = new Date(createdAt.getTime() + policy.responseTargetHours * 60 * 60 * 1000);
    const resolutionDueAt = new Date(createdAt.getTime() + policy.resolutionTargetHours * 60 * 60 * 1000);
    return { responseDueAt, resolutionDueAt };
  }

  /**
   * Evaluate SLA status for an active or closed report
   */
  static evaluate(
    createdAt: Date,
    priority: Priority,
    status: string,
    firstRespondedAt?: Date | null,
    resolvedAt?: Date | null,
    now: Date = new Date()
  ): SlaEvaluation {
    const { responseDueAt, resolutionDueAt } = this.calculateDueDates(createdAt, priority);
    const nowTime = now.getTime();

    // Check response SLA
    const responseCompletedTime = firstRespondedAt ? firstRespondedAt.getTime() : nowTime;
    const isResponseBreached = !firstRespondedAt && nowTime > responseDueAt.getTime();
    const responseRemainingMs = responseDueAt.getTime() - nowTime;

    // Check resolution SLA
    const isResolved = status === 'resolved';
    const resolutionCompletedTime = resolvedAt ? resolvedAt.getTime() : nowTime;
    const isResolutionBreached = !isResolved && nowTime > resolutionDueAt.getTime();
    const resolutionRemainingMs = resolutionDueAt.getTime() - nowTime;

    const isBreached = isResponseBreached || isResolutionBreached;

    let statusLabel = 'On track';
    if (isBreached) {
      statusLabel = 'SLA breach';
    } else if (resolutionRemainingMs < 4 * 60 * 60 * 1000) {
      statusLabel = 'At risk';
    }

    return {
      isResponseBreached,
      isResolutionBreached,
      isBreached,
      responseRemainingMs,
      resolutionRemainingMs,
      responseDueAt,
      resolutionDueAt,
      statusLabel
    };
  }

  /**
   * Format countdown string (e.g. "Due in 5h", "Overdue by 2h")
   */
  static formatCountdown(dueAt: Date, now: Date = new Date()): string {
    const diffMs = dueAt.getTime() - now.getTime();
    const absDiff = Math.abs(diffMs);
    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs < 0) {
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `Overdue by ${days}d`;
      }
      return `Overdue by ${hours}h ${minutes}m`;
    } else {
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `Due in ${days}d`;
      }
      return `Due in ${hours}h`;
    }
  }
}

