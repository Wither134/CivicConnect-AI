export interface AuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  ipAddress: string;
  details: Record<string, any>;
  timestamp: string;
}

export class AuditLogger {
  private static logs: AuditEntry[] = [];

  /**
   * Append an immutable audit entry.
   */
  static log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const record: AuditEntry = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      ...entry,
      timestamp: new Date().toISOString()
    };
    // Append-only: cannot be modified or deleted
    this.logs.unshift(record);
    return record;
  }

  /**
   * Query audit logs with filtering
   */
  static query(filters?: {
    actorId?: string;
    role?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    targetType?: string;
  }): AuditEntry[] {
    return this.logs.filter((log) => {
      if (filters?.actorId && log.actorId !== filters.actorId) return false;
      if (filters?.role && log.actorRole !== filters.role) return false;
      if (filters?.action && !log.action.toLowerCase().includes(filters.action.toLowerCase())) return false;
      if (filters?.targetType && log.targetType !== filters.targetType) return false;
      if (filters?.startDate && new Date(log.timestamp) < new Date(filters.startDate)) return false;
      if (filters?.endDate && new Date(log.timestamp) > new Date(filters.endDate)) return false;
      return true;
    });
  }

  /**
   * Export audit log to CSV format
   */
  static toCSV(filters?: {
    actorId?: string;
    role?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): string {
    const entries = this.query(filters);
    const headers = ['ID', 'Timestamp', 'Actor Name', 'Actor Email', 'Role', 'Action', 'Target Type', 'Target ID', 'IP Address', 'Details'];

    const escapeCsv = (val: string) => `"${(val || '').toString().replace(/"/g, '""')}"`;

    const rows = entries.map((e) => [
      escapeCsv(e.id),
      escapeCsv(e.timestamp),
      escapeCsv(e.actorName),
      escapeCsv(e.actorEmail),
      escapeCsv(e.actorRole),
      escapeCsv(e.action),
      escapeCsv(e.targetType),
      escapeCsv(e.targetId),
      escapeCsv(e.ipAddress),
      escapeCsv(JSON.stringify(e.details))
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

