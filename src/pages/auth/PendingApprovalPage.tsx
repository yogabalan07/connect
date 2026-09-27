import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const PendingApprovalPage: React.FC = () => {
  const { emailVerified, sendVerification, refreshSession } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string>('');
  const [isSending, setIsSending] = useState(false);

  const handleResendVerification = async () => {
    setVerificationStatus('');
    setVerificationError('');
    setIsSending(true);
    const res = await sendVerification();
    setIsSending(false);
    if (res.ok) setVerificationStatus(res.message);
    else setVerificationError(res.message);
  };

  const handleCheckVerification = async () => {
    setVerificationStatus('');
    setVerificationError('');
    const res = await refreshSession();
    if (res.ok) setVerificationStatus('Verification status refreshed.');
    else setVerificationError(res.message);
  };

  return (    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 antialiased text-slate-100">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Verification Pending
          </span>
          <h1 className="mt-3 text-2xl font-bold text-white tracking-tight">
            Waiting for Admin Approval
          </h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Your college student account application has been submitted to your Department Administrator (<strong className="text-slate-200">Dr. Ramesh Kumar, HOD</strong>).
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-left space-y-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Roll number & college email verified</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Department & section allocated</span>
          </div>
          <div className="flex items-center gap-2 text-amber-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Faculty approval in review queue</span>
          </div>
        </div>

        {/* Firebase email verification (production feature) */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-left space-y-2.5 text-xs">
          <div className="flex items-center gap-2">
            <MailCheck className={`w-4 h-4 ${emailVerified ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span className={emailVerified ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
              {emailVerified ? 'College email verified' : 'Email verification pending'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {emailVerified
              ? 'Your college email address has been verified through Firebase Authentication.'
              : 'Open the verification link Firebase sent to your college email to complete this step.'}
          </p>
          {!emailVerified && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isSending}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-[11px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {isSending ? 'Sending…' : 'Resend verification email'}
              </button>
              <button
                type="button"
                onClick={handleCheckVerification}
                className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <RefreshCw className="w-3 h-3" />
                Check status
              </button>
            </div>
          )}
          {verificationStatus && (
            <p className="text-[11px] text-emerald-300" role="status">
              {verificationStatus}
            </p>
          )}
          {verificationError && (
            <p className="text-[11px] text-rose-300" role="alert">
              {verificationError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2">
          <Link to="/login" className="text-indigo-400 hover:underline">
            Back to Sign In
          </Link>
          <span>·</span>
          <Link to="/" className="hover:text-white transition-colors">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
};
