import { Suspense, lazy, useState, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ReminderProvider } from '../../contexts/ReminderContext';
import { FollowupReminderToast } from '../notifications/FollowupReminderToast';

const LeadManager = lazy(() => import('../leads/LeadManager').then((module) => ({ default: module.LeadManager })));
const BasicSettings = lazy(() => import('../settings/BasicSettings').then((module) => ({ default: module.BasicSettings })));
const FollowupsManager = lazy(() => import('../followups/FollowupsManager').then((module) => ({ default: module.FollowupsManager })));
const AdminAnalytics = lazy(() => import('../../pages/AdminAnalytics').then((module) => ({ default: module.AdminAnalytics })));
const BulkActionsModule = lazy(() => import('../../pages/BulkActionsModule').then((module) => ({ default: module.BulkActionsModule })));
const AdminDashboard = lazy(() => import('../../pages/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const SuperAdminDashboard = lazy(() => import('../../pages/SuperAdminDashboard').then((module) => ({ default: module.SuperAdminDashboard })));
const WorkflowAutomationPage = lazy(() => import('../../pages/WorkflowAutomationPage').then((module) => ({ default: module.WorkflowAutomationPage })));

function SectionLoader() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-6">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );
}

export function MainLayout() {
  const [activeSection, setActiveSection] = useState('leads');
  const [showAddLead, setShowAddLead] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [selectedFollowupId, setSelectedFollowupId] = useState<string | null>(null);

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearchQuery('');
  };

  const handleViewFollowup = useCallback((followupId: string) => {
    setSelectedFollowupId(followupId);
    setActiveSection('followups');
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case 'leads':
        return <LeadManager onAddLead={() => setShowAddLead(true)} showAddLead={showAddLead} onCloseAddLead={() => setShowAddLead(false)} searchQuery={activeSearchQuery} />;
      case 'analytics':
        return <AdminAnalytics />;
      case 'settings':
        return <BasicSettings />;
      case 'followups':
        return <FollowupsManager selectedFollowupId={selectedFollowupId} onFollowupViewed={() => setSelectedFollowupId(null)} />;
      case 'bulk-actions':
        return <BulkActionsModule />;
      case 'workflow':
        return <WorkflowAutomationPage />;
      case 'super-admin':
        return <SuperAdminDashboard />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-slate-800 capitalize">
              {activeSection.replace('-', ' ')}
            </h2>
            <p className="text-slate-600 mt-2">This section is under development.</p>
          </div>
        );
    }
  };

  return (
    <ReminderProvider onViewFollowup={handleViewFollowup}>
      <div className="flex h-screen bg-slate-100">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            onAddLead={() => setShowAddLead(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearch={handleSearch}
            onClearSearch={handleClearSearch}
          />

          <main className="flex-1 overflow-auto">
            <Suspense fallback={<SectionLoader />}>
              {renderContent()}
            </Suspense>
          </main>
        </div>
      </div>
      <FollowupReminderToast />
    </ReminderProvider>
  );
}
