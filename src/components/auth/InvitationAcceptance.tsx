import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { UserPlus, AlertCircle, LogOut } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role_id: string;
  organization_id: string;
  expires_at: string;
  status: string;
  roles: {
    role_name: string;
  } | null;
}

export function InvitationAcceptance() {
  const [token, setToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user, signUp, signOut } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('token');

    if (inviteToken) {
      setToken(inviteToken);
      loadInvitation(inviteToken);
    } else {
      setError('Invalid invitation link');
      setLoading(false);
    }
  }, []);

  const loadInvitation = async (inviteToken: string) => {
    try {
      // First try to find by ID (which is what the invitation link uses)
      let { data, error } = await supabase
        .from('invitations')
        .select(`
          *,
          roles(role_name)
        `)
        .eq('id', inviteToken)
        .maybeSingle();

      // If not found by ID, try by token field
      if (!data && !error) {
        const result = await supabase
          .from('invitations')
          .select(`
            *,
            roles(role_name)
          `)
          .eq('token', inviteToken)
          .maybeSingle();

        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Error loading invitation:', error);
        setError('Failed to load invitation: ' + error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Invitation not found');
        setLoading(false);
        return;
      }

      if (data.status !== 'pending') {
        setError('This invitation has already been used or cancelled');
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        await supabase
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', inviteToken);

        setError('This invitation has expired');
        setLoading(false);
        return;
      }

      setInvitation(data);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError('Failed to load invitation: ' + (err?.message || 'Unknown error'));
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (user) {
      setError('Please sign out of the current account before accepting this invitation.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last names are required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!invitation || !token) {
      setError('Invalid invitation');
      return;
    }

    setSubmitting(true);

    try {
      // Sign up the user
      const { data: authData, error: signUpError } = await signUp(
        invitation.email,
        password,
        firstName,
        lastName
      );

      if (signUpError) {
        setError(signUpError.message);
        setSubmitting(false);
        return;
      }

      if (!authData?.user) {
        setError('Failed to create account');
        setSubmitting(false);
        return;
      }

      // Wait a moment for the profile creation trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the profile with invitation details
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          organization_id: invitation.organization_id,
          role_id: invitation.role_id,
          mobile_number: mobileNumber || null,
          status: 'active'
        })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error('Failed to update profile: ' + profileError.message);
      }

      // Add user to organization members
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert({
          organization_id: invitation.organization_id,
          profile_id: authData.user.id,
          role_id: invitation.role_id,
          joined_at: new Date().toISOString(),
        }, {
          onConflict: 'profile_id'
        });

      if (memberError) {
        console.error('Organization member error:', memberError);
        throw new Error('Failed to add to organization: ' + memberError.message);
      }

      // Mark invitation as accepted
      const { error: inviteError } = await supabase
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (inviteError) {
        console.error('Invitation update error:', inviteError);
        throw new Error('Failed to mark invitation as accepted: ' + inviteError.message);
      }

      // Reload the page to trigger authentication flow
      window.location.href = '/';
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      setError(err.message || 'Failed to accept invitation');
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setError('');
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-red-100 p-3 rounded-xl">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-4">
            Invalid Invitation
          </h1>
          <p className="text-center text-slate-600 mb-6">
            {error}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-orange-500 p-3 rounded-xl">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-slate-800 mb-2">
          Accept Invitation
        </h1>
        <p className="text-center text-slate-600 mb-6">
          You've been invited to join as a <span className="font-semibold text-orange-600">{invitation?.roles?.role_name || 'team member'}</span>
        </p>

        {user && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              You are currently signed in as {user.email}.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Sign out first, then accept this invitation with {invitation?.email}.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 font-semibold text-white transition hover:bg-amber-700"
            >
              <LogOut className="h-4 w-4" />
              Sign Out to Continue
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="John"
              required
              disabled={!!user}
            />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="Doe"
              required
              disabled={!!user}
            />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={invitation?.email || ''}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
              disabled
            />
          </div>

          <div>
            <label htmlFor="mobile" className="block text-sm font-medium text-slate-700 mb-2">
              Mobile Number (Optional)
            </label>
            <input
              id="mobile"
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="+1 234 567 8900"
              disabled={!!user}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={!!user}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={!!user}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !!user}
            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {user ? 'Sign Out to Accept Invitation' : submitting ? 'Creating Account...' : 'Accept Invitation'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => window.location.href = '/'}
            className="text-slate-500 hover:text-slate-600 font-medium text-sm"
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
