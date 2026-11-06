import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Database, User } from '../db/database.js';
import { AuditLogger } from '../safeguards/audit-logger.js';
import { MfaService } from './mfa.service.js';
import { UserRole } from '../workflow/state-machine.js';

const JWT_SECRET = process.env.JWT_SECRET || 'civicfix-hackathon-ps14-secure-key-2026';
const TOKEN_EXPIRY = '8h';

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId?: string | null;
  departmentName?: string | null;
  lastActive: number;
}

export class AuthService {
  /**
   * Citizen direct registration: ONLY Citizen role allowed!
   */
  static async registerCitizen(params: {
    name: string;
    email: string;
    password: string;
    ipAddress?: string;
  }): Promise<{ user: User; token: string }> {
    await Database.init();

    const existing = Array.from(Database.users.values()).find(
      (u) => u.email.toLowerCase() === params.email.toLowerCase()
    );
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    if (params.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const hash = await bcrypt.hash(params.password, 10);
    const newUser: User = {
      id: `usr-cit-${Date.now()}`,
      name: params.name,
      email: params.email.toLowerCase(),
      passwordHash: hash,
      role: 'citizen', // Strictly citizen!
      mfaEnabled: false,
      status: 'active',
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    Database.users.set(newUser.id, newUser);

    AuditLogger.log({
      actorId: newUser.id,
      actorEmail: newUser.email,
      actorName: newUser.name,
      actorRole: 'citizen',
      action: 'USER_REGISTER_CITIZEN',
      targetType: 'user',
      targetId: newUser.id,
      ipAddress: params.ipAddress || '127.0.0.1',
      details: { role: 'citizen' }
    });

    const token = this.generateToken(newUser);
    return { user: newUser, token };
  }

  /**
   * Citizen login (direct single-step)
   */
  static async loginCitizen(email: string, password: string, ipAddress?: string): Promise<{ user: User; token: string }> {
    await Database.init();

    const user = Array.from(Database.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!user || user.status === 'deactivated') {
      throw new Error('Invalid email or password.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password.');
    }

    if (user.role !== 'citizen') {
      throw new Error('Staff and Admin members must sign in through the Staff Portal.');
    }

    user.lastLogin = new Date().toISOString();

    AuditLogger.log({
      actorId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      targetType: 'session',
      targetId: user.id,
      ipAddress: ipAddress || '127.0.0.1',
      details: { role: user.role }
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * Step 1 of Staff/Admin login: password check, returns temp MFA token
   */
  static async initiateStaffLogin(
    email: string,
    password: string,
    ipAddress?: string
  ): Promise<{ requiresMfa: boolean; tempToken: string; userSummary: { name: string; role: UserRole } }> {
    await Database.init();

    const user = Array.from(Database.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!user || user.status === 'deactivated') {
      throw new Error('Invalid email or password.');
    }

    if (user.role === 'citizen') {
      throw new Error('Citizens must use the citizen sign-in page.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password.');
    }

    // Generate temporary token for MFA step (valid for 5 minutes)
    const tempToken = jwt.sign(
      { userId: user.id, stage: 'mfa_pending', lastActive: Date.now() },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    return {
      requiresMfa: true,
      tempToken,
      userSummary: { name: user.name, role: user.role }
    };
  }

  /**
   * Step 2 of Staff/Admin login: verify MFA code
   */
  static async completeMfaLogin(
    tempToken: string,
    mfaCode: string,
    ipAddress?: string
  ): Promise<{ user: User; token: string }> {
    await Database.init();

    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      throw new Error('Session timed out. Please sign in again.');
    }

    if (decoded.stage !== 'mfa_pending') {
      throw new Error('Invalid authentication session.');
    }

    const user = Database.users.get(decoded.userId);
    if (!user || user.status === 'deactivated') {
      throw new Error('User not found or deactivated.');
    }

    const isValidCode = MfaService.verifyCode(user.mfaSecret || 'JBSWY3DPEHPK3PXP', mfaCode);
    if (!isValidCode) {
      AuditLogger.log({
        actorId: user.id,
        actorEmail: user.email,
        actorName: user.name,
        actorRole: user.role,
        action: 'MFA_FAILURE',
        targetType: 'auth',
        targetId: user.id,
        ipAddress: ipAddress || '127.0.0.1',
        details: { codeEntered: mfaCode.slice(0, 2) + '****' }
      });
      throw new Error('Invalid 6-digit MFA code. Please enter the current code from your authenticator app (Demo: 123456).');
    }

    user.lastLogin = new Date().toISOString();

    AuditLogger.log({
      actorId: user.id,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: user.role,
      action: 'STAFF_MFA_LOGIN_SUCCESS',
      targetType: 'session',
      targetId: user.id,
      ipAddress: ipAddress || '127.0.0.1',
      details: { role: user.role }
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * Generate signed JWT
   */
  static generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      lastActive: Date.now()
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  }

  /**
   * Verify token
   */
  static verifyToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }
}

