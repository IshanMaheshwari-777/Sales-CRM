import {
  Users,
  Calendar,
  CheckSquare,
  Workflow,
  Settings,
  LifeBuoy,
  Activity,
  Shield,
  ShieldCheck
} from 'lucide-react';
import { usePermissions } from '../../contexts/PermissionsContext';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  requiredPermission?: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { id: 'leads', label: 'Lead Manager', icon: Users },
  { id: 'followups', label: 'Follow-ups Manager', icon: Calendar },
  { id: 'analytics', label: 'System Analytics', icon: Activity },
  { id: 'bulk-actions', label: 'Bulk Actions', icon: CheckSquare, requiredPermission: 'bulk_actions.upload' },
  { id: 'workflow', label: 'Workflow Automation', icon: Workflow, adminOnly: true },
  { id: 'settings', label: 'Basic Settings', icon: Settings },
  { id: 'super-admin', label: 'Super Admin Dashboard', icon: ShieldCheck, superAdminOnly: true },
  { id: 'admin', label: 'Admin Dashboard', icon: Shield, adminOnly: true },
];

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { hasPermission, isAdmin, isSuperAdmin, loading } = usePermissions();

  const isMenuItemVisible = (item: MenuItem): boolean => {
    if (loading && (item.adminOnly || item.superAdminOnly || item.requiredPermission)) {
      return false;
    }

    if (item.superAdminOnly && !isSuperAdmin) {
      return false;
    }

    if (item.adminOnly && !isAdmin) {
      return false;
    }

    if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
      return false;
    }

    return true;
  };
  return (
    <div data-testid="app-sidebar" className="w-60 bg-slate-50 border-r border-slate-200 flex flex-col h-screen">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">ExtraEdge</h1>
            <p className="text-xs text-slate-500">CRM System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="space-y-2 px-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                <div className="w-5 h-5 bg-slate-200 rounded"></div>
                <div className="h-4 bg-slate-200 rounded w-32"></div>
              </div>
            ))}
          </div>
        ) : (
          menuItems.filter(isMenuItemVisible).map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                data-testid={`nav-${item.id}`}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-orange-50 border-r-4 border-orange-500 text-orange-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })
        )}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <a href="mailto:support@extraedge.com" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <LifeBuoy className="w-5 h-5" />
          <span className="text-sm font-medium">Raise a Ticket</span>
        </a>
      </div>
    </div>
  );
}
