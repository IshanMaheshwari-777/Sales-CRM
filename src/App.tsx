import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { registerServiceWorker } from './utils/registerServiceWorker';
import { requestNotificationPermission } from './utils/notificationPermissions';

function App() {
  useEffect(() => {
    registerServiceWorker();

    const timer = setTimeout(() => {
      requestNotificationPermission();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <PermissionsProvider>
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          </PermissionsProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
