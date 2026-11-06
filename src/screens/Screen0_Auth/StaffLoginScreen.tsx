import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { IconLock, IconShield, IconArrowLeft } from '../../components/common/Icons.js';

export interface StaffLoginScreenProps {
  navigate: (route: string) => void;
}

export const StaffLoginScreen: React.FC<StaffLoginScreenProps> = ({ navigate }) => {
  const { initiateStaffLogin, completeMfaLogin } = useAuth();

  // Step 1: email & password
  const [email, setEmail] = useState('priya.n@civicfix.org');
  const [password, setPassword] = useState('CivicFix#2026');

  // Step 2: MFA
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [tempToken, setTempToken] = useState<string>('');
  const [mfaCode, setMfaCode] = useState('123456');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await initiateStaffLogin(email, password);
      setTempToken(res.tempToken);
      setStep('mfa');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await completeMfaLogin(tempToken, mfaCode);

      // Routing logic after login:
      // Staff -> /staff/assignments
      // Admin -> /admin/review-queue
      // Super Admin -> /admin/review-queue (or /superadmin/settings)
      if (email.includes('arun') || email.includes('deepa')) {
        navigate('/staff/assignments');
      } else {
        navigate('/admin/review-queue');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid MFA code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md">
        {/* Dark Card (#1E1B18, text #D9CEC2) */}
        <div className="bg-[#1E1B18] text-[#D9CEC2] border border-[#3D352F] rounded-[14px] p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-[10px] bg-[#2C2723] border border-[#F4A582]/40 text-[#F4A582] flex items-center justify-center mx-auto mb-3">
              <IconLock size={22} />
            </div>
            <h1 className="text-[26px] font-serif font-semibold text-white tracking-tight">
              Staff & Admin Portal
            </h1>
            <p className="mt-1.5 text-xs text-[#8C8075]">
              Mandatory Multi-Factor Authentication (MFA) enabled.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-[8px] bg-[#3B1917] border border-[#8F1D1D] text-xs font-medium text-[#F4A582]">
              {error}
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleStep1} className="space-y-4">
              {/* Demo Account Quick-Fill Buttons */}
              <div className="p-3 bg-[#141210] rounded-[10px] border border-[#3D352F] text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8075] mb-2">
                  Select Demo Account:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('priya.n@civicfix.org');
                      setPassword('CivicFix#2026');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      email === 'priya.n@civicfix.org'
                        ? 'bg-[#E65D25] text-white font-bold'
                        : 'bg-[#241F1B] text-[#D9CEC2] hover:bg-[#3D352F]'
                    }`}
                  >
                    Moderator (Priya)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('superadmin@civicfix.org');
                      setPassword('CivicFix#2026');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      email === 'superadmin@civicfix.org'
                        ? 'bg-[#E65D25] text-white font-bold'
                        : 'bg-[#241F1B] text-[#D9CEC2] hover:bg-[#3D352F]'
                    }`}
                  >
                    Super Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('arun.k@civicfix.org');
                      setPassword('CivicFix#2026');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      email === 'arun.k@civicfix.org'
                        ? 'bg-[#E65D25] text-white font-bold'
                        : 'bg-[#241F1B] text-[#D9CEC2] hover:bg-[#3D352F]'
                    }`}
                  >
                    Staff (Arun)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D9CEC2] uppercase tracking-wider mb-1.5">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@civicfix.org"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#3D352F] bg-[#141210] text-sm text-white focus:outline-none focus:border-[#F4A582]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D9CEC2] uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#3D352F] bg-[#141210] text-sm text-white focus:outline-none focus:border-[#F4A582]"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
                  Continue to MFA Verification →
                </Button>
              </div>

              <div className="pt-3 text-center space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-xs text-[#F4A582] font-semibold hover:underline block w-full cursor-pointer"
                >
                  Resident / Citizen? Go to Citizen Portal Sign In →
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-xs text-[#8C8075] hover:text-[#D9CEC2] transition-colors block w-full cursor-pointer"
                >
                  ← Return to Public Dashboard
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="p-3 bg-[#241F1B] rounded-[8px] border border-[#3D352F] text-xs text-[#D9CEC2]">
                <p className="font-semibold text-white mb-1">MFA Security Step</p>
                Enter the 6-digit code from your authenticator app (or demo code <span className="font-mono text-[#F4A582] font-bold">123456</span>).
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D9CEC2] uppercase tracking-wider mb-1.5">
                  6-Digit MFA Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  className="w-full h-[48px] px-3.5 rounded-[10px] border border-[#3D352F] bg-[#141210] text-center font-mono text-lg tracking-[0.3em] text-[#F4A582] focus:outline-none focus:border-[#F4A582]"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
                  Verify & Open Work Queue
                </Button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="text-xs text-[#8C8075] hover:text-[#D9CEC2] flex items-center justify-center gap-1 mx-auto cursor-pointer"
                >
                  <IconArrowLeft size={13} />
                  Change email or password
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-[#2C2723] text-center text-[11px] text-[#8C8075]">
            Session timeout: 15 minutes of idle time. Privileged actions are audited with IP address.
          </div>
        </div>
      </div>
    </div>
  );
};

