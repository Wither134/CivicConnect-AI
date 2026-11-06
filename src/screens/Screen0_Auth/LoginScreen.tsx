import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { IconShield, IconLock } from '../../components/common/Icons.js';

export interface LoginScreenProps {
  navigate: (route: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigate }) => {
  const { loginCitizen, registerCitizen } = useAuth();
  const [tab, setTab] = useState<'signin' | 'register'>('signin');

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('ramesh.k@gmail.com');
  const [signInPassword, setSignInPassword] = useState('Citizen#2026');

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await loginCitizen(signInEmail, signInPassword);
      navigate('/my-reports');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regName.trim()) {
      setError('Name is required.');
      return;
    }
    if (regPassword !== regConfirm) {
      setError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await registerCitizen(regName, regEmail, regPassword);
      navigate('/report');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-md">
        {/* Centered card on cream */}
        <Card className="p-8 border border-[#E9DFD3] bg-white rounded-[14px]">
          <div className="text-center mb-6">
            <h1 className="text-[26px] font-serif font-semibold text-[#1E1B18] tracking-tight">
              Welcome to CivicFix
            </h1>
            <p className="mt-2 text-sm text-[#6A5D52]">
              Track, report, and monitor civic resolutions in your community.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#EFE6DA] mb-6">
            <button
              onClick={() => {
                setTab('signin');
                setError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                tab === 'signin'
                  ? 'border-[#B03A0C] text-[#B03A0C]'
                  : 'border-transparent text-[#6A5D52] hover:text-[#1E1B18]'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => {
                setTab('register');
                setError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                tab === 'register'
                  ? 'border-[#B03A0C] text-[#B03A0C]'
                  : 'border-transparent text-[#6A5D52] hover:text-[#1E1B18]'
              }`}
            >
              Create citizen account
            </button>
          </div>

          {/* Error notice */}
          {error && (
            <div className="mb-5 p-3 rounded-[8px] bg-[#FBE4E4] border border-[#F4A582] text-xs font-medium text-[#8F1D1D]">
              {error}
            </div>
          )}

          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] bg-white text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#1E1B18] uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <input
                  type="password"
                  required
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] bg-white text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
                  Sign in to Citizen Portal
                </Button>
              </div>

              <div className="pt-3 text-center space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/staff/login')}
                  className="text-xs text-[#174B38] font-bold hover:underline cursor-pointer block w-full"
                >
                  Municipal Staff, Moderator, or Admin? Staff & Admin Portal →
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-xs text-[#B03A0C] font-semibold hover:underline cursor-pointer block w-full"
                >
                  Browse the public dashboard without signing in →
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] bg-white text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="ramesh@example.com"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] bg-white text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] bg-white text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] bg-white text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
                  Create Citizen Account
                </Button>
              </div>
            </form>
          )}

          {/* Privacy Note */}
          <div className="mt-6 pt-5 border-t border-[#EFE6DA] flex items-center justify-center gap-1.5 text-xs text-[#0F766E]">
            <IconShield size={14} />
            <span>Your name is never shown publicly.</span>
          </div>

          {/* Quick Access Credential Guide */}
          <div className="mt-5 p-3.5 rounded-xl bg-[#FAF5EE] border border-[#E9DFD3] text-xs text-[#6A5D52] space-y-1.5">
            <p className="font-bold text-[#1E1B18] text-[11px] uppercase tracking-wider">Demo Resident Access:</p>
            <p className="font-mono text-[11px] text-[#25312B]">Email: ramesh.k@gmail.com</p>
            <p className="font-mono text-[11px] text-[#25312B]">Password: Citizen#2026</p>
            <div className="pt-2 border-t border-[#E9DFD3] text-[11px] text-[#7D8981]">
              For Moderator or Super Admin, use the{' '}
              <button
                type="button"
                onClick={() => navigate('/staff/login')}
                className="text-[#174B38] underline font-bold cursor-pointer"
              >
                Staff & Admin Portal
              </button>
              .
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

