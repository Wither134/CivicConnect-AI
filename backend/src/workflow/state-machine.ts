export type ReportStatus =
  | 'submitted'
  | 'under_review'
  | 'verified'
  | 'assigned'
  | 'in_progress'
  | 'work_completed'
  | 'resolved'
  | 'rejected'
  | 'duplicate'
  | 'reopened';

export type UserRole = 'visitor' | 'citizen' | 'staff' | 'admin' | 'super_admin';

export interface TransitionContext {
  actorId: string;
  actorRole: UserRole;
  actorName: string;
  assigneeId?: string | null;
  workCompleterId?: string | null;
  note?: string;
  proofImageId?: string | null;
  parentReportId?: string | null;
}

export interface TransitionResult {
  allowed: boolean;
  error?: string;
  nextStatus?: ReportStatus;
}

// State transition validation rules
export class StateMachine {
  /**
   * Check if a transition is valid and conforms to role, two-person rule, proof, and reason rules.
   */
  static validateTransition(
    currentStatus: ReportStatus,
    targetStatus: ReportStatus,
    ctx: TransitionContext
  ): TransitionResult {
    const { actorRole, actorId, assigneeId, workCompleterId, note, proofImageId, parentReportId } = ctx;

    // Citizens and visitors cannot transition reports
    if (actorRole === 'visitor' || actorRole === 'citizen') {
      return {
        allowed: false,
        error: `Role '${actorRole}' is not authorized to change report status.`
      };
    }

    // Staff transition rules
    if (actorRole === 'staff') {
      // Must be the assigned staff member
      if (assigneeId && assigneeId !== actorId) {
        return {
          allowed: false,
          error: 'Staff can only update reports directly assigned to them.'
        };
      }

      if (currentStatus === 'assigned' && targetStatus === 'in_progress') {
        return { allowed: true, nextStatus: 'in_progress' };
      }

      if (currentStatus === 'in_progress' && targetStatus === 'work_completed') {
        if (!note || note.trim().length < 10) {
          return {
            allowed: false,
            error: 'Marking work completed requires a progress note of at least 10 characters.'
          };
        }
        if (!proofImageId) {
          return {
            allowed: false,
            error: 'Marking work completed requires at least one proof photo.'
          };
        }
        return { allowed: true, nextStatus: 'work_completed' };
      }

      return {
        allowed: false,
        error: `Staff cannot transition report from '${currentStatus}' to '${targetStatus}'. Permitted transitions: assigned -> in_progress, in_progress -> work_completed.`
      };
    }

    // Admin and Super Admin transitions
    if (actorRole === 'admin' || actorRole === 'super_admin') {
      // Normal flow
      if (currentStatus === 'submitted' && targetStatus === 'under_review') {
        return { allowed: true, nextStatus: 'under_review' };
      }

      if (currentStatus === 'under_review' && targetStatus === 'verified') {
        return { allowed: true, nextStatus: 'verified' };
      }

      if (currentStatus === 'verified' && targetStatus === 'assigned') {
        return { allowed: true, nextStatus: 'assigned' };
      }

      // Admin starting progress directly if needed
      if (currentStatus === 'assigned' && targetStatus === 'in_progress') {
        return { allowed: true, nextStatus: 'in_progress' };
      }

      if (currentStatus === 'in_progress' && targetStatus === 'work_completed') {
        if (!note || note.trim().length < 10) {
          return {
            allowed: false,
            error: 'Marking work completed requires a progress note of at least 10 characters.'
          };
        }
        if (!proofImageId) {
          return {
            allowed: false,
            error: 'Marking work completed requires at least one proof photo.'
          };
        }
        return { allowed: true, nextStatus: 'work_completed' };
      }

      // Two-Person Rule for Resolution:
      // Staff marks "Work completed" with proof; an Admin reviews the proof and sets "Resolved".
      // The same person cannot do both on one report!
      if (currentStatus === 'work_completed' && targetStatus === 'resolved') {
        if (workCompleterId && workCompleterId === actorId) {
          return {
            allowed: false,
            error: 'Two-person rule violation: The administrator who signs off as Resolved cannot be the same person who completed the work.'
          };
        }
        if (!note || note.trim().length < 10) {
          return {
            allowed: false,
            error: 'Resolution sign-off requires a completion note of at least 10 characters.'
          };
        }
        if (!proofImageId) {
          return {
            allowed: false,
            error: 'Resolution sign-off requires verified proof photo.'
          };
        }
        return { allowed: true, nextStatus: 'resolved' };
      }

      // Reopening back to assigned
      if ((currentStatus === 'work_completed' || currentStatus === 'rejected') && targetStatus === 'reopened') {
        if (!note || note.trim().length < 10) {
          return {
            allowed: false,
            error: 'Reopening a report requires an explanation note of at least 10 characters.'
          };
        }
        // Transitions to 'assigned' state
        return { allowed: true, nextStatus: 'assigned' };
      }

      // Rejections from early/active stages
      if (
        ['submitted', 'under_review', 'verified', 'assigned', 'in_progress'].includes(currentStatus) &&
        targetStatus === 'rejected'
      ) {
        if (!note || note.trim().length < 10) {
          return {
            allowed: false,
            error: 'Rejecting a report requires a reason of at least 10 characters.'
          };
        }
        return { allowed: true, nextStatus: 'rejected' };
      }

      // Duplicate linking
      if (
        ['submitted', 'under_review', 'verified'].includes(currentStatus) &&
        targetStatus === 'duplicate'
      ) {
        if (!parentReportId) {
          return {
            allowed: false,
            error: 'Marking as duplicate requires selecting an active parent report.'
          };
        }
        return { allowed: true, nextStatus: 'duplicate' };
      }

      return {
        allowed: false,
        error: `Illegal status transition from '${currentStatus}' to '${targetStatus}'.`
      };
    }

    return {
      allowed: false,
      error: `Unknown role '${actorRole}'.`
    };
  }

  /**
   * Returns list of permitted next statuses for given status & role.
   */
  static getPermittedTransitions(currentStatus: ReportStatus, role: UserRole): ReportStatus[] {
    if (role === 'visitor' || role === 'citizen') {
      return [];
    }

    if (role === 'staff') {
      if (currentStatus === 'assigned') return ['in_progress'];
      if (currentStatus === 'in_progress') return ['work_completed'];
      return [];
    }

    if (role === 'admin' || role === 'super_admin') {
      switch (currentStatus) {
        case 'submitted':
          return ['under_review', 'rejected', 'duplicate'];
        case 'under_review':
          return ['verified', 'rejected', 'duplicate'];
        case 'verified':
          return ['assigned', 'rejected', 'duplicate'];
        case 'assigned':
          return ['in_progress', 'rejected'];
        case 'in_progress':
          return ['work_completed', 'assigned', 'rejected'];
        case 'work_completed':
          return ['resolved', 'reopened'];
        case 'rejected':
          return ['reopened'];
        default:
          return [];
      }
    }

    return [];
  }
}

