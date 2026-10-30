import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { Flag, X, CheckCircle2 } from 'lucide-react';

export const ReportModal: React.FC = () => {
  const { currentUser, profile } = useAuth();
  const { isReportModalOpen, reportTarget, closeReportModal } = useUI();

  const [reason, setReason] = useState<'spam' | 'harassment' | 'inappropriate' | 'fake_account' | 'other'>('spam');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isReportModalOpen || !reportTarget) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser.uid,
        reporterName: profile?.displayName || profile?.username || 'User',
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        targetName: reportTarget.name || '',
        reason,
        details: details.trim(),
        status: 'pending',
        createdAt: Date.now(),
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        closeReportModal();
      }, 1500);
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={closeReportModal}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Report Content</h2>
            <p className="text-xs text-neutral-400">
              Reporting: {reportTarget.type} {reportTarget.name ? `"${reportTarget.name}"` : ''}
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="py-8 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-12 h-12 text-red-400 animate-bounce" />
            <h3 className="text-base font-semibold text-white">Report Submitted</h3>
            <p className="text-xs text-neutral-400 max-w-xs">
              Thank you for keeping Chatcon safe. Our moderation team will review this report.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Select Violation Category
              </label>
              <select
                value={reason}
                onChange={(e: any) => setReason(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="spam">Spam or Unsolicited Commercial Message</option>
                <option value="harassment">Harassment or Bullying</option>
                <option value="inappropriate">Inappropriate, Explicit or Violence</option>
                <option value="fake_account">Fake Account or Impersonation</option>
                <option value="other">Other Violation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what occurred or give context..."
                rows={3}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeReportModal}
                className="flex-1 py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
