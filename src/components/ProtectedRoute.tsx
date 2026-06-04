import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { FirstLoginSetup } from './auth/FirstLoginSetup';
import { InvitationAcceptance } from './auth/InvitationAcceptance';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();

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

  return <>{children}</>;
}
