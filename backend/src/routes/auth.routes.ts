import { Router, Request, Response } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { authenticate } from '../auth/auth.middleware.js';
import { Database } from '../db/database.js';

export const authRouter = Router();

// Citizen self-service sign-up (Citizen role ONLY)
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }

    const { user, token } = await AuthService.registerCitizen({
      name,
      email,
      password,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.cookie('civicfix_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600000
    });

    res.status(201).json({
      message: 'Citizen account registered successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Citizen sign in
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const { user, token } = await AuthService.loginCitizen(email, password, req.ip || '127.0.0.1');

    res.cookie('civicfix_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600000
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// Staff/Admin Step 1 login (password check -> MFA prompt)
authRouter.post('/staff-login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const result = await AuthService.initiateStaffLogin(email, password, req.ip || '127.0.0.1');
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// Staff/Admin Step 2 MFA verify
authRouter.post('/mfa-verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      res.status(400).json({ error: 'Temporary token and MFA code are required.' });
      return;
    }

    const { user, token } = await AuthService.completeMfaLogin(tempToken, code, req.ip || '127.0.0.1');

    res.cookie('civicfix_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600000
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        departmentName: user.departmentName
      }
    });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// Get currently authenticated user
authRouter.get('/me', authenticate(true), (req: Request, res: Response): void => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  const user = Database.users.get(req.user.userId);
  if (!user || user.status === 'deactivated') {
    res.status(401).json({ error: 'User session not found or inactive.' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      mfaEnabled: user.mfaEnabled,
      lastLogin: user.lastLogin
    }
  });
});

// Sign out
authRouter.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('civicfix_token');
  res.json({ message: 'Signed out successfully.' });
});

