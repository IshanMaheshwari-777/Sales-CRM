import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signOut } = useAuth();
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    // Only clear the hash if we actually have a user session, meaning Supabase successfully parsed it.
    // If we clear it too early, Supabase might not create the session.
    if (user && window.location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [user]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError('No valid session found. Your reset link may have expired.');
      return;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      showSuccess('Password updated successfully! Please sign in with your new password.');
      await signOut(); // Force sign out so they can log in with new credentials
      window.location.href = '/'; // Redirect to login
    } catch (err: any) {
      showError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-orange-100 p-3 rounded-xl">
            <KeyRound className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Set New Password</h1>
        
        {!user ? (
          <div className="text-center">
            <p className="text-red-600 mb-6 bg-red-50 p-4 rounded-lg border border-red-100">
              This password reset link is invalid or has expired. Password reset links can only be used once.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-200 transition"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <p className="text-center text-slate-600 mb-8 text-sm">
              Please enter your new password below.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-2">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
