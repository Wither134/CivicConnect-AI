import bcrypt from 'bcryptjs';
import { AbusePrevention } from '../safeguards/abuse-prevention.js';
import { SlaEngine, Priority } from '../safeguards/sla-engine.js';
import { ReportStatus, UserRole } from '../workflow/state-machine.js';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  departmentId?: string | null;
  departmentName?: string | null;
  mfaEnabled: boolean;
  mfaSecret?: string;
  status: 'active' | 'invited' | 'deactivated';
  lastLogin?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
}

export interface Category {
  id: string;
  name: string;
  departmentId: string;
  icon: string;
  defaultPriority: Priority;
}

export interface ReportImage {
  id: string;
  reportId: string;
  url: string;
  thumbnailUrl?: string;
  fileSizeBytes: number;
  mimeType: string;
  exifStripped: boolean;
  uploadedById: string;
  uploadedByRole: UserRole;
  isProof: boolean;
  caption?: string;
  createdAt: string;
}

export interface StatusHistoryItem {
  id: string;
  reportId: string;
  actorId: string;
  actorName: string;
  role: UserRole;
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
  note: string;
  proofImageId?: string | null;
  proofImageUrl?: string | null;
  createdAt: string;
}

export interface Report {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  priority: Priority;
  priorityScore: number; // 0-100
  scoreBreakdown: {
    safetyRisk: number;
    supporters: number;
    mainRoad: number;
    age: number;
  };
  status: ReportStatus;
  version: number;
  reporterId: string;
  reporterName?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  workCompleterId?: string | null;
  exactLat?: number;
  exactLng?: number;
  coarsenedLat: number;
  coarsenedLng: number;
  ward: string;
  addressHint: string;
  responseDueAt: string;
  resolutionDueAt: string;
  firstRespondedAt?: string | null;
  workCompletedAt?: string | null;
  resolvedAt?: string | null;
  rejectionReason?: string | null;
  reopenReason?: string | null;
  parentReportId?: string | null;
  duplicateOf?: string | null;
  deletedAt?: string | null;
  deleteReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateLink {
  id: string;
  duplicateReportId: string;
  parentReportId: string;
  similarityScore: number;
  mergedById: string;
  mergedByName: string;
  mergedAt: string;
  undoExpiresAt: string;
  isUndone: boolean;
  undoneAt?: string | null;
  undoReason?: string | null;
}

// In-memory Database Store with PostGIS/SQL fidelity
export class Database {
  static users: Map<string, User> = new Map();
  static departments: Map<string, Department> = new Map();
  static categories: Map<string, Category> = new Map();
  static reports: Map<string, Report> = new Map();
  static reportImages: Map<string, ReportImage> = new Map();
  static statusHistories: StatusHistoryItem[] = [];
  static duplicateLinks: Map<string, DuplicateLink> = new Map();
  static initialized = false;

  static async init() {
    if (this.initialized) return;
    this.seedDepartmentsAndCategories();
    await this.seedUsers();
    this.seedReports();
    this.initialized = true;
  }

  private static seedDepartmentsAndCategories() {
    const depts: Department[] = [
      { id: 'dept-elec', name: 'Electrical Dept.', code: 'ELEC', description: 'Streetlights, power pillars, municipal electrical infrastructure' },
      { id: 'dept-roads', name: 'Roads Dept.', code: 'ROADS', description: 'Potholes, resurfacing, sidewalks, storm drains' },
      { id: 'dept-waste', name: 'Solid Waste Management', code: 'WASTE', description: 'Bin overflows, illegal dumping, garbage collection' },
      { id: 'dept-water', name: 'Water & Sewage Board', code: 'WATER', description: 'Pipe leaks, open manholes, contaminated supply' },
      { id: 'dept-parks', name: 'Parks & Recreation', code: 'PARKS', description: 'Fallen branches, playground hazards, park upkeep' }
    ];
    depts.forEach((d) => this.departments.set(d.id, d));

    const cats: Category[] = [
      { id: 'cat-streetlight', name: 'Streetlight', departmentId: 'dept-elec', icon: 'lightbulb', defaultPriority: 'high' },
      { id: 'cat-road', name: 'Road', departmentId: 'dept-roads', icon: 'road', defaultPriority: 'high' },
      { id: 'cat-waste', name: 'Waste', departmentId: 'dept-waste', icon: 'trash', defaultPriority: 'medium' },
      { id: 'cat-water', name: 'Water Leak', departmentId: 'dept-water', icon: 'droplet', defaultPriority: 'critical' },
      { id: 'cat-drain', name: 'Open Manhole', departmentId: 'dept-water', icon: 'alert-triangle', defaultPriority: 'critical' }
    ];
    cats.forEach((c) => this.categories.set(c.id, c));
  }

  private static async seedUsers() {
    // Passwords derived from env or sensible hackathon defaults
    const defaultPassword = process.env.DEMO_USER_PASSWORD || 'CivicFix#2026';
    const hash = await bcrypt.hash(defaultPassword, 10);

    const userList: User[] = [
      {
        id: 'usr-superadmin',
        name: 'Vikram S.',
        email: process.env.SUPERADMIN_EMAIL || 'superadmin@civicfix.org',
        passwordHash: hash,
        role: 'super_admin',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP', // standard base32 MFA secret
        status: 'active',
        lastLogin: new Date(Date.now() - 3600000).toISOString(),
        createdAt: '2026-01-15T08:00:00Z'
      },
      {
        id: 'usr-admin',
        name: 'Priya N.',
        email: process.env.ADMIN_EMAIL || 'priya.n@civicfix.org',
        passwordHash: hash,
        role: 'admin',
        departmentId: 'dept-elec',
        departmentName: 'Electrical Dept.',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        status: 'active',
        lastLogin: new Date(Date.now() - 7200000).toISOString(),
        createdAt: '2026-02-01T09:30:00Z'
      },
      {
        id: 'usr-staff-elec',
        name: 'Arun K.',
        email: process.env.STAFF_ELEC_EMAIL || 'arun.k@civicfix.org',
        passwordHash: hash,
        role: 'staff',
        departmentId: 'dept-elec',
        departmentName: 'Electrical Dept.',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        status: 'active',
        lastLogin: new Date(Date.now() - 14400000).toISOString(),
        createdAt: '2026-02-15T10:00:00Z'
      },
      {
        id: 'usr-staff-roads',
        name: 'Deepa M.',
        email: process.env.STAFF_ROADS_EMAIL || 'deepa.m@civicfix.org',
        passwordHash: hash,
        role: 'staff',
        departmentId: 'dept-roads',
        departmentName: 'Roads Dept.',
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        status: 'active',
        lastLogin: new Date(Date.now() - 28800000).toISOString(),
        createdAt: '2026-02-20T11:15:00Z'
      },
      {
        id: 'usr-citizen-ramesh',
        name: 'Ramesh K.',
        email: process.env.CITIZEN_EMAIL || 'ramesh.k@gmail.com',
        passwordHash: hash,
        role: 'citizen',
        mfaEnabled: false,
        status: 'active',
        lastLogin: new Date(Date.now() - 1800000).toISOString(),
        createdAt: '2026-03-01T14:20:00Z'
      },
      {
        id: 'usr-citizen-anita',
        name: 'Anita R.',
        email: 'anita.r@gmail.com',
        passwordHash: hash,
        role: 'citizen',
        mfaEnabled: false,
        status: 'active',
        lastLogin: new Date(Date.now() - 86400000).toISOString(),
        createdAt: '2026-03-05T12:00:00Z'
      },
      {
        id: 'usr-citizen-kavita',
        name: 'Kavita D.',
        email: 'kavita.d@outlook.com',
        passwordHash: hash,
        role: 'citizen',
        mfaEnabled: false,
        status: 'active',
        lastLogin: new Date(Date.now() - 172800000).toISOString(),
        createdAt: '2026-03-10T16:45:00Z'
      }
    ];

    userList.forEach((u) => this.users.set(u.id, u));
  }

  private static seedReports() {
    const baseLat = 12.9716;
    const baseLng = 77.5946;

    // Report CPR-2026-000123: The flagship test case
    const cpr123CreatedAt = new Date(Date.now() - 4 * 24 * 3600000); // 4 days ago
    const cpr123Due = SlaEngine.calculateDueDates(cpr123CreatedAt, 'high');

    const rep123: Report = {
      id: 'rep-123',
      referenceNumber: 'CPR-2026-000123',
      title: 'Streetlight out on 5th Main',
      description: 'Streetlight pole #42 on 5th Main road has been completely dark for 3 days. Safety risk at night near the corner bus stop.',
      categoryId: 'cat-streetlight',
      categoryName: 'Streetlight',
      priority: 'high',
      priorityScore: 68,
      scoreBreakdown: {
        safetyRisk: 25,
        supporters: 20,
        mainRoad: 15,
        age: 8
      },
      status: 'in_progress',
      version: 3,
      reporterId: 'usr-citizen-ramesh',
      reporterName: 'Ramesh K.',
      assigneeId: 'usr-staff-elec',
      assigneeName: 'Arun K.',
      reviewerId: 'usr-admin',
      reviewerName: 'Priya N.',
      departmentId: 'dept-elec',
      departmentName: 'Electrical Dept.',
      exactLat: 12.971942,
      exactLng: 77.593718,
      coarsenedLat: AbusePrevention.coarsenCoordinate(12.971942),
      coarsenedLng: AbusePrevention.coarsenCoordinate(77.593718),
      ward: 'Ward 45 (Central)',
      addressHint: 'Near 5th Main Bus Stop, opposite City Bakery',
      responseDueAt: cpr123Due.responseDueAt.toISOString(),
      resolutionDueAt: new Date(Date.now() + 2 * 24 * 3600000).toISOString(), // Expected fix by 8 Nov
      firstRespondedAt: new Date(cpr123CreatedAt.getTime() + 14 * 3600000).toISOString(),
      createdAt: cpr123CreatedAt.toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    };
    this.reports.set(rep123.id, rep123);

    // Images for rep-123
    const img123Citizen: ReportImage = {
      id: 'img-123-1',
      reportId: 'rep-123',
      url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80',
      fileSizeBytes: 1845000,
      mimeType: 'image/jpeg',
      exifStripped: true,
      uploadedById: 'usr-citizen-ramesh',
      uploadedByRole: 'citizen',
      isProof: false,
      caption: 'Dark road corner near pole 42',
      createdAt: cpr123CreatedAt.toISOString()
    };
    this.reportImages.set(img123Citizen.id, img123Citizen);

    // Status timeline for rep-123
    this.statusHistories.push(
      {
        id: 'hist-123-1',
        reportId: 'rep-123',
        actorId: 'usr-citizen-ramesh',
        actorName: 'Ramesh K.',
        role: 'citizen',
        fromStatus: 'submitted',
        toStatus: 'submitted',
        note: 'Initial report submitted via citizen portal.',
        createdAt: cpr123CreatedAt.toISOString()
      },
      {
        id: 'hist-123-2',
        reportId: 'rep-123',
        actorId: 'usr-admin',
        actorName: 'Priya N.',
        role: 'admin',
        fromStatus: 'submitted',
        toStatus: 'under_review',
        note: 'Triage started. Checked electrical grid schematics.',
        createdAt: new Date(cpr123CreatedAt.getTime() + 5 * 3600000).toISOString()
      },
      {
        id: 'hist-123-3',
        reportId: 'rep-123',
        actorId: 'usr-admin',
        actorName: 'Priya N.',
        role: 'admin',
        fromStatus: 'under_review',
        toStatus: 'verified',
        note: 'Confirmed out-of-order streetlight pole. Priority set to High.',
        createdAt: new Date(cpr123CreatedAt.getTime() + 14 * 3600000).toISOString()
      },
      {
        id: 'hist-123-4',
        reportId: 'rep-123',
        actorId: 'usr-admin',
        actorName: 'Priya N.',
        role: 'admin',
        fromStatus: 'verified',
        toStatus: 'assigned',
        note: 'Assigned to Electrical Dept field team (Arun K.). Priority repair required.',
        createdAt: new Date(cpr123CreatedAt.getTime() + 24 * 3600000).toISOString()
      },
      {
        id: 'hist-123-5',
        reportId: 'rep-123',
        actorId: 'usr-staff-elec',
        actorName: 'Arun K.',
        role: 'staff',
        fromStatus: 'assigned',
        toStatus: 'in_progress',
        note: 'Field technician dispatched with ladder truck and 150W LED luminaire replacement kit.',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    );

    // CPR-2026-000131: Potential duplicate of 123 (91% match, 40m away)
    const rep131: Report = {
      id: 'rep-131',
      referenceNumber: 'CPR-2026-000131',
      title: 'Dark road near bus stop',
      description: 'Street light not working since Tuesday. Very dark and unsafe for bus passengers.',
      categoryId: 'cat-streetlight',
      categoryName: 'Streetlight',
      priority: 'high',
      priorityScore: 65,
      scoreBreakdown: { safetyRisk: 25, supporters: 15, mainRoad: 15, age: 10 },
      status: 'under_review',
      version: 1,
      reporterId: 'usr-citizen-anita',
      reporterName: 'Anita R.',
      reviewerId: 'usr-admin',
      reviewerName: 'Priya N.',
      exactLat: 12.972101, // ~35m away
      exactLng: 77.593850,
      coarsenedLat: AbusePrevention.coarsenCoordinate(12.972101),
      coarsenedLng: AbusePrevention.coarsenCoordinate(77.593850),
      ward: 'Ward 45 (Central)',
      addressHint: '5th Main Bus shelter pole',
      responseDueAt: new Date(Date.now() + 18 * 3600000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 20 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 20 * 3600000).toISOString()
    };
    this.reports.set(rep131.id, rep131);

    // Other realistic reports from Screen 5 and public dashboard:
    // 1. "Open manhole near school" (Critical 92)
    const repManhole: Report = {
      id: 'rep-092',
      referenceNumber: 'CPR-2026-000092',
      title: 'Open manhole near primary school',
      description: 'Heavy concrete cover was cracked and fell into storm drain right in front of St. Joseph primary school entrance. Serious hazard for children.',
      categoryId: 'cat-drain',
      categoryName: 'Open Manhole',
      priority: 'critical',
      priorityScore: 92,
      scoreBreakdown: { safetyRisk: 40, supporters: 25, mainRoad: 15, age: 12 },
      status: 'assigned',
      version: 2,
      reporterId: 'usr-citizen-kavita',
      reporterName: 'Kavita D.',
      assigneeId: 'usr-staff-roads',
      assigneeName: 'Deepa M.',
      reviewerId: 'usr-admin',
      reviewerName: 'Priya N.',
      departmentId: 'dept-roads',
      departmentName: 'Roads Dept.',
      exactLat: 12.9752,
      exactLng: 77.5910,
      coarsenedLat: AbusePrevention.coarsenCoordinate(12.9752),
      coarsenedLng: AbusePrevention.coarsenCoordinate(77.5910),
      ward: 'Ward 12 (North)',
      addressHint: 'Opposite Gate 2, St. Joseph Primary School',
      responseDueAt: new Date(Date.now() - 2 * 3600000).toISOString(), // SLA breach on response!
      resolutionDueAt: new Date(Date.now() + 10 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 3600000).toISOString()
    };
    this.reports.set(repManhole.id, repManhole);

    // 2. "Deep pothole main road" (High 74)
    const repPothole: Report = {
      id: 'rep-074',
      referenceNumber: 'CPR-2026-000074',
      title: 'Deep pothole on MG Road flyover ramp',
      description: 'Massive pothole spanning roughly 1.2m across right on the merge lane. Two two-wheelers skidded this morning.',
      categoryId: 'cat-road',
      categoryName: 'Road',
      priority: 'high',
      priorityScore: 74,
      scoreBreakdown: { safetyRisk: 30, supporters: 20, mainRoad: 18, age: 6 },
      status: 'assigned',
      version: 2,
      reporterId: 'usr-citizen-ramesh',
      reporterName: 'Ramesh K.',
      assigneeId: 'usr-staff-roads',
      assigneeName: 'Deepa M.',
      reviewerId: 'usr-admin',
      reviewerName: 'Priya N.',
      departmentId: 'dept-roads',
      departmentName: 'Roads Dept.',
      exactLat: 12.9734,
      exactLng: 77.6012,
      coarsenedLat: AbusePrevention.coarsenCoordinate(12.9734),
      coarsenedLng: AbusePrevention.coarsenCoordinate(77.6012),
      ward: 'Ward 18 (East)',
      addressHint: 'MG Road Flyover entrance ramp',
      responseDueAt: new Date(Date.now() + 12 * 3600000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 36 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 3600000).toISOString()
    };
    this.reports.set(repPothole.id, repPothole);

    // 3. "Overflowing bin market" (Medium 45)
    const repBin: Report = {
      id: 'rep-045',
      referenceNumber: 'CPR-2026-000045',
      title: 'Overflowing bin at Russell Market',
      description: 'Commercial vegetable waste spilling onto roadway. Strong odor and pedestrian blockage.',
      categoryId: 'cat-waste',
      categoryName: 'Waste',
      priority: 'medium',
      priorityScore: 45,
      scoreBreakdown: { safetyRisk: 15, supporters: 15, mainRoad: 10, age: 5 },
      status: 'submitted',
      version: 1,
      reporterId: 'usr-citizen-anita',
      reporterName: 'Anita R.',
      departmentId: 'dept-waste',
      departmentName: 'Solid Waste Management',
      exactLat: 12.9812,
      exactLng: 77.6025,
      coarsenedLat: AbusePrevention.coarsenCoordinate(12.9812),
      coarsenedLng: AbusePrevention.coarsenCoordinate(77.6025),
      ward: 'Ward 22 (Market)',
      addressHint: 'Russell Market gate 4',
      responseDueAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 120 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 15 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 3600000).toISOString()
    };
    this.reports.set(repBin.id, repBin);

    // 4. "Work completed" report awaiting sign-off (Screen 5 Awaiting sign-off)
    const repWorkCompleted: Report = {
      id: 'rep-signoff-1',
      referenceNumber: 'CPR-2026-000088',
      title: 'Fallen transformer wire on 9th Cross',
      description: 'Live wire snapped during heavy thunderstorm. Required emergency isolation and rewire.',
      categoryId: 'cat-streetlight',
      categoryName: 'Streetlight',
      priority: 'critical',
      priorityScore: 89,
      scoreBreakdown: { safetyRisk: 40, supporters: 24, mainRoad: 15, age: 10 },
      status: 'work_completed',
      version: 4,
      reporterId: 'usr-citizen-kavita',
      reporterName: 'Kavita D.',
      assigneeId: 'usr-staff-elec',
      assigneeName: 'Arun K.',
      reviewerId: 'usr-admin',
      reviewerName: 'Priya N.',
      departmentId: 'dept-elec',
      departmentName: 'Electrical Dept.',
      workCompleterId: 'usr-staff-elec',
      exactLat: 12.9688,
      exactLng: 77.5891,
      coarsenedLat: AbusePrevention.coarsenCoordinate(12.9688),
      coarsenedLng: AbusePrevention.coarsenCoordinate(77.5891),
      ward: 'Ward 33 (South)',
      addressHint: '9th Cross, near Transformer Station B-4',
      responseDueAt: new Date(Date.now() - 30 * 3600000).toISOString(),
      resolutionDueAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      firstRespondedAt: new Date(Date.now() - 28 * 3600000).toISOString(),
      workCompletedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 32 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 3600000).toISOString()
    };
    this.reports.set(repWorkCompleted.id, repWorkCompleted);

    // Proof photo for rep-signoff-1
    const imgProof: ReportImage = {
      id: 'img-proof-88',
      reportId: 'rep-signoff-1',
      url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
      fileSizeBytes: 2150000,
      mimeType: 'image/jpeg',
      exifStripped: true,
      uploadedById: 'usr-staff-elec',
      uploadedByRole: 'staff',
      isProof: true,
      caption: 'Rewired feeder line, newly clamped insulator bracket, continuity tested 230V OK',
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
    };
    this.reportImages.set(imgProof.id, imgProof);

    this.statusHistories.push({
      id: 'hist-88-proof',
      reportId: 'rep-signoff-1',
      actorId: 'usr-staff-elec',
      actorName: 'Arun K.',
      role: 'staff',
      fromStatus: 'in_progress',
      toStatus: 'work_completed',
      note: 'Insulator bracket replaced, feeder wire secured, tension test passed and ground continuity verified.',
      proofImageId: imgProof.id,
      proofImageUrl: imgProof.url,
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
    });

    // 5. Resolved report with complete audit trail and proof
    const repResolved: Report = {
      id: 'rep-resolved-1',
      referenceNumber: 'CPR-2026-000055',
      title: 'Water main burst on Indira Nagar 100ft road',
      description: 'High pressure drinking water pipeline split. Flooding sidewalk.',
      categoryId: 'cat-water',
      categoryName: 'Water Leak',
      priority: 'high',
      priorityScore: 78,
      scoreBreakdown: { safetyRisk: 28, supporters: 25, mainRoad: 15, age: 10 },
      status: 'resolved',
      version: 5,
      reporterId: 'usr-citizen-ramesh',
      reporterName: 'Ramesh K.',
      assigneeId: 'usr-staff-roads',
      assigneeName: 'Deepa M.',
      reviewerId: 'usr-admin',
      reviewerName: 'Priya N.',
      departmentId: 'dept-roads',
      departmentName: 'Roads Dept.',
      workCompleterId: 'usr-staff-roads',
      exactLat: 12.9784,
      exactLng: 77.6408,
      coarsenedLat: AbusePrevention.coarsenCoordinate(12.9784),
      coarsenedLng: AbusePrevention.coarsenCoordinate(77.6408),
      ward: 'Ward 74 (Indira Nagar)',
      addressHint: 'Near BDA Complex 100ft road',
      responseDueAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
      resolutionDueAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
      firstRespondedAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
      workCompletedAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
      resolvedAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
      createdAt: new Date(Date.now() - 6 * 24 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString()
    };
    this.reports.set(repResolved.id, repResolved);

    // Seed 18 additional realistic reports to make total ~25
    const categories = ['cat-streetlight', 'cat-road', 'cat-waste', 'cat-water', 'cat-drain'];
    const titles = [
      'Broken curb stones causing flat tires',
      'Flickering sodium light on residential lane',
      'Construction debris dumped on public footpath',
      'Leaking valve causing water stagnation',
      'Uncovered drainage trench after storm',
      'Speed breaker markings completely faded',
      'Streetlight mast knocked by truck',
      'Garbage bin missing lid attracting stray dogs',
      'Sunken road patch near railway crossing',
      'Sewage backup near vegetable vendor market',
      'Traffic signal dead on 80ft road intersection',
      'Dead tree branch hanging over electrical line',
      'Loose metal grill on pedestrian footbridge',
      'Cracked asphalt following water line repairs',
      'Illegal dumping of plastic waste in empty plot',
      'Streetlight circuit trip breaker buzzing loudly',
      'Pothole cluster outside hospital ambulance bay',
      'Overflowing community compost bin'
    ];

    const wards = ['Ward 12', 'Ward 18', 'Ward 22', 'Ward 33', 'Ward 45', 'Ward 74'];
    const statuses: ReportStatus[] = ['submitted', 'under_review', 'verified', 'assigned', 'in_progress', 'work_completed', 'resolved'];
    const priorities: Priority[] = ['critical', 'high', 'medium', 'low'];
    const reporters = ['usr-citizen-ramesh', 'usr-citizen-anita', 'usr-citizen-kavita'];

    titles.forEach((title, idx) => {
      const repId = `rep-gen-${idx + 10}`;
      const catId = categories[idx % categories.length];
      const cat = this.categories.get(catId)!;
      const status = statuses[idx % statuses.length];
      const priority = priorities[idx % priorities.length];
      const reporterId = reporters[idx % reporters.length];
      const reporter = this.users.get(reporterId)!;
      const daysAgo = (idx + 1) * 0.8;
      const createdDate = new Date(Date.now() - daysAgo * 24 * 3600000);
      const dueDates = SlaEngine.calculateDueDates(createdDate, priority);

      const assignedStaff = cat.departmentId === 'dept-elec' ? 'usr-staff-elec' : 'usr-staff-roads';
      const isAssigned = ['assigned', 'in_progress', 'work_completed', 'resolved'].includes(status);

      const lat = baseLat + (Math.sin(idx * 1.5) * 0.04);
      const lng = baseLng + (Math.cos(idx * 1.5) * 0.04);

      const report: Report = {
        id: repId,
        referenceNumber: `CPR-2026-000${140 + idx}`,
        title,
        description: `${title}. Reported by resident for urgent civic intervention. Multiple complaints noted in neighborhood group.`,
        categoryId: catId,
        categoryName: cat.name,
        priority,
        priorityScore: Math.floor(40 + Math.random() * 50),
        scoreBreakdown: {
          safetyRisk: 20 + (idx % 15),
          supporters: 10 + (idx % 20),
          mainRoad: 15,
          age: idx % 10
        },
        status,
        version: 1,
        reporterId,
        reporterName: reporter.name,
        assigneeId: isAssigned ? assignedStaff : null,
        assigneeName: isAssigned ? (assignedStaff === 'usr-staff-elec' ? 'Arun K.' : 'Deepa M.') : null,
        reviewerId: isAssigned ? 'usr-admin' : null,
        reviewerName: isAssigned ? 'Priya N.' : null,
        departmentId: cat.departmentId,
        departmentName: this.departments.get(cat.departmentId)?.name || 'General',
        workCompleterId: status === 'work_completed' || status === 'resolved' ? assignedStaff : null,
        exactLat: lat,
        exactLng: lng,
        coarsenedLat: AbusePrevention.coarsenCoordinate(lat),
        coarsenedLng: AbusePrevention.coarsenCoordinate(lng),
        ward: wards[idx % wards.length],
        addressHint: `Sector ${idx + 2}, near Crossroad ${idx + 1}`,
        responseDueAt: dueDates.responseDueAt.toISOString(),
        resolutionDueAt: dueDates.resolutionDueAt.toISOString(),
        createdAt: createdDate.toISOString(),
        updatedAt: createdDate.toISOString()
      };

      this.reports.set(report.id, report);
    });
  }
}

