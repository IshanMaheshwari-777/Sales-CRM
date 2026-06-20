import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { LoginPage } from './auth/LoginPage';
import { FirstLoginSetup } from './auth/FirstLoginSetup';
import { InvitationAcceptance } from './auth/InvitationAcceptance';
import { Building2, LogOut } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, profile, organization, signOut } = useAuth();
  const { isSuperAdmin, loading: permsLoading } = usePermissions();

  const loading = authLoading || (user && permsLoading);

  // Check if this is an invitation acceptance flow
  const params = new URLSearchParams(window.location.search);
  const hasInvitationToken = params.has('token');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  // Invitation links must take precedence over any existing session.
  if (hasInvitationToken) {
    return <InvitationAcceptance />;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (profile?.status === 'pending') {
    return <FirstLoginSetup />;
  }

  if (!organization && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Organization Pending</h2>
          <p className="text-slate-600 mb-8">
            Your account has been created, but you haven't been assigned to an organization yet. 
            Please contact your administrator or wait for an invitation.
          </p>
          <button
            onClick={() => signOut()}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
