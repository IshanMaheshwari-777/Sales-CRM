import { Suspense, lazy, useMemo, useState } from 'react';
import { Users, Shield, UsersRound, Mail, GitBranch, Webhook, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';

type TabType = 'users' | 'permissions' | 'teams' | 'invitations' | 'assignmentRules' | 'webhooks';

const UserManagement = lazy(() => import('../components/admin/UserManagement').then((module) => ({ default: module.UserManagement })));
const RolePermissionsMatrix = lazy(() => import('../components/admin/RolePermissionsMatrix').then((module) => ({ default: module.RolePermissionsMatrix })));
const TeamManagement = lazy(() => import('../components/admin/TeamManagement').then((module) => ({ default: module.TeamManagement })));
const InvitationManagement = lazy(() => import('../components/admin/InvitationManagement').then((module) => ({ default: module.InvitationManagement })));
const AssignmentRulesManagement = lazy(() => import('../components/admin/AssignmentRulesManagement').then((module) => ({ default: module.AssignmentRulesManagement })));
const WebhookManagement = lazy(() => import('../components/admin/WebhookManagement').then((module) => ({ default: module.WebhookManagement })));

function AdminTabLoader() {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );
}

export function AdminDashboard() {
  const { profile, organization } = useAuth();
  const { isAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const organizationId = profile?.organization_id || organization?.id || null;
  const organizationName = organization?.name || 'Unknown Organization';

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-slate-600 text-center max-w-md">
          You do not have permission to access the Admin Dashboard. Please contact your system administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 'users' as TabType, label: 'User Management', icon: Users },
    { id: 'invitations' as TabType, label: 'Invitations', icon: Mail },
    { id: 'permissions' as TabType, label: 'Roles & Permissions', icon: Shield },
    { id: 'teams' as TabType, label: 'Team Management', icon: UsersRound },
    { id: 'assignmentRules' as TabType, label: 'Assignment Rules', icon: GitBranch },
    { id: 'webhooks' as TabType, label: 'Webhook Integrations', icon: Webhook },
  ];

  const activeContent = useMemo(() => {
    switch (activeTab) {
      case 'users':
        return <UserManagement organizationId={organizationId} isSuperAdminView={false} />;
      case 'invitations':
        return <InvitationManagement />;
      case 'permissions':
        return <RolePermissionsMatrix />;
      case 'teams':
        return <TeamManagement organizationId={organizationId} isSuperAdminView={false} />;
      case 'assignmentRules':
        return <AssignmentRulesManagement />;
      case 'webhooks':
        return <WebhookManagement />;
      default:
        return null;
    }
  }, [activeTab, organizationId]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage users, invitations, roles, and teams for{' '}
            <span className="font-medium text-orange-600">{organizationName}</span>
          </p>
        </div>

        <div className="px-6">
          <div className="flex gap-1 border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? 'border-orange-600 text-orange-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Suspense fallback={<AdminTabLoader />}>
          {activeContent}
        </Suspense>
      </div>
    </div>
  );
}
