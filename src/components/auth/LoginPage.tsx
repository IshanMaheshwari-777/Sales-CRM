import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, ArrowLeft, Mail } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

type ViewMode = 'login' | 'signup' | 'forgot-password' | 'reset-sent';

const NETWORK_ERROR_MSG =
  'Unable to reach the authentication server. This can happen if the server is temporarily waking up — please wait a moment and try again. If the issue persists, try clearing your browser cache or disabling any browser extensions.';

function getFriendlyError(message: string): string {
  if (
    message.toLowerCase().includes('failed to fetch') ||
    message.toLowerCase().includes('load failed') ||
    message.toLowerCase().includes('networkerror') ||
    message.toLowerCase().includes('network request failed') ||
    message.toLowerCase().includes('fetch')
  ) {
    return NETWORK_ERROR_MSG;
  }
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again or use "Forgot password?" below.';
  }
  return message;
}

function isNetworkError(msg: string) {
  return msg === NETWORK_ERROR_MSG;
}

export function LoginPage() {
  const [view, setView] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const { showError, showWarning } = useToast();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        const msg = getFriendlyError(error.message);
        isNetworkError(msg) ? showWarning(msg) : showError(msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      const friendlyMsg = getFriendlyError(msg);
      isNetworkError(friendlyMsg) ? showWarning(friendlyMsg) : showError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showError('First and last names are required');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email, password, firstName, lastName);
      if (error) {
        const msg = getFriendlyError(error.message);
        isNetworkError(msg) ? showWarning(msg) : showError(msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      const friendlyMsg = getFriendlyError(msg);
      isNetworkError(friendlyMsg) ? showWarning(friendlyMsg) : showError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        const msg = getFriendlyError(error.message);
        isNetworkError(msg) ? showWarning(msg) : showError(msg);
      } else {
        setView('reset-sent');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      const friendlyMsg = getFriendlyError(msg);
      isNetworkError(friendlyMsg) ? showWarning(friendlyMsg) : showError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const switchView = (newView: ViewMode) => {
    setView(newView);
  };

  if (view === 'reset-sent') {
    return (
      <div data-testid="auth-reset-sent-view" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Check your inbox</h1>
          <p className="text-slate-600 mb-2">
            A password reset link has been sent to:
          </p>
          <p className="font-semibold text-slate-800 mb-6 break-all">{email}</p>
          <p className="text-sm text-slate-500 mb-8">
            Click the link in the email to set a new password. If you don't see it, check your spam folder.
          </p>
          <button
            onClick={() => switchView('login')}
            data-testid="auth-reset-back-to-login"
            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (view === 'forgot-password') {
    return (
      <div data-testid="auth-forgot-password-view" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <button
            onClick={() => switchView('login')}
            data-testid="auth-back-to-login"
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </button>

          <div className="flex items-center justify-center mb-6">
            <div className="bg-orange-100 p-3 rounded-xl">
              <Mail className="w-8 h-8 text-orange-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Forgot your password?</h1>
          <p className="text-center text-slate-600 mb-8 text-sm">
            Enter the email address linked to your account and we'll send you a reset link.
          </p>

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <input
                id="reset-email"
                data-testid="auth-reset-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="auth-reset-submit"
              className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`auth-${view}-view`} className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-orange-500 p-3 rounded-xl">
            <LogIn className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-slate-800 mb-2">
          {view === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-center text-slate-600 mb-8">
          {view === 'login' ? 'Sign in to access your CRM' : 'Join your sales team'}
        </p>

        <form onSubmit={view === 'login' ? handleLoginSubmit : handleSignupSubmit} className="space-y-5">
          {view === 'signup' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">
                  First Name
                </label>
                <input
                  id="firstName"
                  data-testid="auth-signup-first-name-input"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                  placeholder="John"
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">
                  Last Name
                </label>
                <input
                  id="lastName"
                  data-testid="auth-signup-last-name-input"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              data-testid="auth-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition"
              placeholder="you@company.com"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              {view === 'login' && (
                <button
                  type="button"
                  onClick={() => switchView('forgot-password')}
                  data-testid="auth-forgot-password-trigger"
                  className="text-sm text-orange-500 hover:text-orange-600 font-medium transition"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="password"
              data-testid="auth-password-input"
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
            data-testid={view === 'login' ? 'auth-login-submit' : 'auth-signup-submit'}
            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : view === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => switchView(view === 'login' ? 'signup' : 'login')}
            data-testid={view === 'login' ? 'auth-switch-to-signup' : 'auth-switch-to-login'}
            className="text-orange-500 hover:text-orange-600 font-medium text-sm"
          >
            {view === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
