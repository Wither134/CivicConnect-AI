import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from './auth.service.js';
import { UserRole } from '../workflow/state-machine.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15-minute idle timeout for staff roles

export function authenticate(optional: boolean = false) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.civicfix_token) {
      token = req.cookies.civicfix_token;
    }

    if (!token) {
      if (optional) {
        return next();
      }
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    try {
      const decoded = AuthService.verifyToken(token);

      // Check 15-minute idle timeout for privileged roles (staff, admin, super_admin)
      if (['staff', 'admin', 'super_admin'].includes(decoded.role)) {
        const now = Date.now();
        if (decoded.lastActive && now - decoded.lastActive > IDLE_TIMEOUT_MS) {
          res.status(401).json({
            error: 'Session expired due to 15 minutes of inactivity. Please sign in again.',
            code: 'SESSION_IDLE_TIMEOUT'
          });
          return;
        }
      }

      req.user = decoded;
      next();
    } catch (err: any) {
      if (optional) {
        return next();
      }
      res.status(401).json({ error: 'Invalid or expired session token.' });
    }
  };
}

/**
 * Require one or more specific roles
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `403 Forbidden: You do not have permission to access this resource. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}.`,
        code: 'ROLE_FORBIDDEN'
      });
      return;
    }

    next();
  };
}

