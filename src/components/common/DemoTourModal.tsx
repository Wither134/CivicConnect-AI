import React, { useState } from 'react';
import { Card } from './Card.js';
import { Button } from './Button.js';
import { Pill } from './Pill.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { IconCheck, IconChevronRight, IconArrowLeft, IconShield, IconClock } from './Icons.js';

export interface DemoTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  navigate: (route: string) => void;
}

export const DemoTourModal: React.FC<DemoTourModalProps> = ({ isOpen, onClose, navigate }) => {
  const { switchRoleDemo } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const steps = [
    {
      step: 1,
      title: 'Step 1: Citizen Submits Report',
      role: 'citizen',
      roleName: 'Ramesh K. (Citizen)',
      route: '/report',
      desc: 'Citizen creates an unverified report for an unlit streetlight on 5th Main. Notice the advisory duplicate detector (40m away) and EXIF stripping for privacy.',
      actionText: 'Switch to Citizen & Open Form'
    },
    {
      step: 2,
      title: 'Step 2: Admin Verifies & Assigns',
      role: 'admin',
      roleName: 'Priya N. (Admin / Moderator)',
      route: '/admin/review-queue',
      desc: 'Admin triage: Open the review queue, acquire the 10-minute soft edit lock, review the priority score bar (68/100), verify the issue, and assign to Electrical Dept.',
      actionText: 'Switch to Admin & Open Queue'
    },
    {
      step: 3,
      title: 'Step 3: Staff Completes Work with Proof',
      role: 'staff',
      roleName: 'Arun K. (Staff · Electrical Dept)',
      route: '/staff/assignments',
      desc: 'Field staff sees only assigned jobs and exact coordinates. Starts work, logs progress, and marks work completed with proof photo and required notes.',
      actionText: 'Switch to Staff & Open Assignments'
    },
    {
      step: 4,
      title: 'Step 4: Admin Two-Person Sign-Off',
      role: 'admin',
      roleName: 'Priya N. (Admin / Moderator)',
      route: '/admin/review-queue',
      desc: 'Two-person rule: Staff cannot self-resolve. Admin inspects staff proof photo in "Awaiting sign-off" tab and grants final sign-off to Resolved.',
      actionText: 'Switch to Admin & Inspect Proof'
    },
    {
      step: 5,
      title: 'Step 5: Super Admin Audit Log',
      role: 'super_admin',
      roleName: 'Vikram S. (Super Admin)',
      route: '/superadmin/settings',
      desc: 'Super Admin reviews the immutable append-only audit trail verifying every transition, actor, role, IP address, and exports to CSV.',
      actionText: 'Switch to Super Admin & Review Audit'
    }
  ];

  const currentTourStep = steps[step - 1];

  const handleExecuteTourStep = async () => {
    await switchRoleDemo(currentTourStep.role as any);
    navigate(currentTourStep.route);
    showToast(`Switched to ${currentTourStep.roleName}. Tour step ${step} active.`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="max-w-lg w-full p-6 bg-white rounded-[14px]">
        <div className="flex items-center justify-between pb-3 border-b border-[#EFE6DA]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B03A0C]" />
            <span className="text-xs font-semibold text-[#B03A0C] uppercase tracking-wider">
              3-Minute Evaluator Demo Script
            </span>
          </div>
          <Pill variant="neutral" label={`Step ${step} of 5`} dot={false} />
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-serif font-semibold text-[#1E1B18]">
            {currentTourStep.title}
          </h2>
          <div className="mt-2 inline-block">
            <span className="text-xs font-mono bg-[#FAF5EE] text-[#B03A0C] px-2 py-0.5 rounded border border-[#E9DFD3] font-semibold">
              Actor: {currentTourStep.roleName}
            </span>
          </div>

          <p className="mt-3 text-sm text-[#1E1B18] leading-relaxed">
            {currentTourStep.desc}
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-[#EFE6DA] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <button
              disabled={step === 1}
              onClick={() => setStep(step - 1)}
              className="p-2 text-[#6A5D52] hover:text-[#1E1B18] disabled:opacity-30 cursor-pointer"
            >
              <IconArrowLeft size={16} />
            </button>
            <span className="text-xs text-[#6A5D52] font-mono px-2">
              {step} / 5
            </span>
            <button
              disabled={step === 5}
              onClick={() => setStep(step + 1)}
              className="p-2 text-[#6A5D52] hover:text-[#1E1B18] disabled:opacity-30 cursor-pointer"
            >
              <IconChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteTourStep}
            >
              {currentTourStep.actionText} →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

