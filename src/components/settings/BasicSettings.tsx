import { useState } from 'react';
import { TemplateManagement } from './TemplateManagement';
import { WebhookIntegrations } from './WebhookIntegrations';
import { usePermissions } from '../../contexts/PermissionsContext';

type Tab = 'email' | 'whatsapp' | 'webhooks';

export function BasicSettings() {
  const { isAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<Tab>('email');

  const tabs: {id: Tab; label: string}[] = [
    { id: 'email', label: 'Email Templates' },
    { id: 'whatsapp', label: 'WhatsApp Templates' }
  ];

  if (isAdmin) {
    tabs.push({ id: 'webhooks', label: 'Webhooks' });
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-0 px-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`settings-tab-${tab.id}`}
              className={`px-6 py-4 font-medium text-sm whitespace-nowrap transition border-b-2 ${
                activeTab === tab.id
                  ? 'border-orange-500 text-slate-900'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'email' && (
        <div className="flex-1 overflow-auto px-6 py-6">
          <TemplateManagement templateType="email" />
        </div>
      )}

      {activeTab === 'whatsapp' && (
        <div className="flex-1 overflow-auto px-6 py-6">
          <TemplateManagement templateType="whatsapp" />
        </div>
      )}

      {activeTab === 'webhooks' && isAdmin && (
        <div className="flex-1 overflow-auto px-6 py-6">
          <WebhookIntegrations />
        </div>
      )}
    </div>
  );
}
