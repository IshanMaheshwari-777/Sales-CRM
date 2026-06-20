// @ts-nocheck
import { useEffect, useState } from 'react';
import { Webhook, Plus, Copy, Check, Trash2, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AddIntegrationEndpointModal } from './AddIntegrationEndpointModal';
import { WebhookLogsViewer } from './WebhookLogsViewer';
import { isIgnorableRequestError } from '../../lib/requestErrors';
import { useAuth } from '../../contexts/AuthContext';

interface WebhookConfig {
  id: string;
  webhook_name: string;
  api_key: string;
  is_enabled: boolean;
  rate_limit_per_minute: number;
  created_at: string;
}

interface IntegrationEndpoint {
  id: string;
  endpoint_name: string;
  endpoint_type: string;
  endpoint_url: string;
  is_active: boolean;
  created_at: string;
}

type ActiveView = 'incoming' | 'outgoing' | 'logs';

const canonicalPayload = `{
  "source": "Facebook Ads",
  "lead": {
    "full_name": "John Doe",
    "mobile_number": "+919999999999",
    "email": "john@example.com",
    "city": "Pune",
    "state": "Maharashtra",
    "country": "India",
    "company": "Acme",
    "course": "MBA",
    "specialization": "Marketing",
    "campaign_name": "April Campaign",
    "campaign_id": "123",
    "adgroup_id": "456"
  }
}`;

export function WebhookIntegrations() {
  const { profile, organization, organizationMember } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('incoming');
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfig[]>([]);
  const [endpoints, setEndpoints] = useState<IntegrationEndpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAddEndpointModal, setShowAddEndpointModal] = useState(false);

  const webhookInboundUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-inbound`;
  const activeOrganizationId =
    profile?.organization_id || organization?.id || organizationMember?.organization_id || null;
  const activeOrganizationName = organization?.name || 'Organization';

  useEffect(() => {
    if (!activeOrganizationId) {
      setWebhookConfigs([]);
      setEndpoints([]);
      return;
    }

    const controller = new AbortController();
    fetchWebhookConfigs(activeOrganizationId, controller.signal);
    fetchIntegrationEndpoints(activeOrganizationId, controller.signal);
    return () => controller.abort();
  }, [activeOrganizationId]);

  const generateApiKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return 'whk_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const generateCompatSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const ensurePrimaryWebhookConfig = async (organizationId: string) => {
    const { data: existingConfig, error: existingError } = await supabase
      .from('webhook_configurations')
      .select('id, webhook_name, api_key, is_enabled, rate_limit_per_minute, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    if (existingConfig && existingConfig.length > 0) {
      return existingConfig;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: insertedConfig, error: insertError } = await supabase
      .from('webhook_configurations')
      .insert({
        organization_id: organizationId,
        webhook_name: `${activeOrganizationName} Primary Webhook`,
        api_key: generateApiKey(),
        hmac_secret: generateCompatSecret(),
        is_enabled: true,
        rate_limit_per_minute: 60,
        created_by: user.id,
      })
      .select('id, webhook_name, api_key, is_enabled, rate_limit_per_minute, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    return insertedConfig ? [insertedConfig] : [];
  };

  const fetchWebhookConfigs = async (organizationId: string, signal?: AbortSignal) => {
    setLoading(true);
    setConfigError(null);
    try {
      const data = await ensurePrimaryWebhookConfig(organizationId);
      setWebhookConfigs(data);
    } catch (error) {
      if (!isIgnorableRequestError(error)) {
        console.error('Error fetching webhook configs:', error);
        setConfigError(error instanceof Error ? error.message : 'Unable to prepare webhook key');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrationEndpoints = async (organizationId: string, signal?: AbortSignal) => {
    try {
      const { data, error } = await supabase
        .from('integration_endpoints')
        .select('*')
        .eq('organization_id', organizationId)
        .abortSignal(signal ?? new AbortController().signal)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEndpoints(data || []);
    } catch (error) {
      if (!isIgnorableRequestError(error)) {
        console.error('Error fetching endpoints:', error);
      }
    }
  };

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const toggleConfigStatus = async (configId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('webhook_configurations')
        .update({ is_enabled: !currentStatus })
        .eq('id', configId)
        .eq('organization_id', activeOrganizationId);

      if (error) throw error;
      if (activeOrganizationId) {
        await fetchWebhookConfigs(activeOrganizationId);
      }
    } catch (error) {
      console.error('Error toggling config status:', error);
    }
  };

  const toggleEndpointStatus = async (endpointId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('integration_endpoints')
        .update({ is_active: !currentStatus })
        .eq('id', endpointId)
        .eq('organization_id', activeOrganizationId);

      if (error) throw error;
      if (activeOrganizationId) {
        await fetchIntegrationEndpoints(activeOrganizationId);
      }
    } catch (error) {
      console.error('Error toggling endpoint status:', error);
    }
  };

  const deleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this webhook configuration?')) return;

    try {
      const { error } = await supabase
        .from('webhook_configurations')
        .delete()
        .eq('id', configId)
        .eq('organization_id', activeOrganizationId);

      if (error) throw error;
      if (activeOrganizationId) {
        await fetchWebhookConfigs(activeOrganizationId);
      }
    } catch (error) {
      console.error('Error deleting config:', error);
    }
  };

  const deleteEndpoint = async (endpointId: string) => {
    if (!confirm('Are you sure you want to delete this integration endpoint?')) return;

    try {
      const { error } = await supabase
        .from('integration_endpoints')
        .delete()
        .eq('id', endpointId)
        .eq('organization_id', activeOrganizationId);

      if (error) throw error;
      if (activeOrganizationId) {
        await fetchIntegrationEndpoints(activeOrganizationId);
      }
    } catch (error) {
      console.error('Error deleting endpoint:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Webhook Integrations</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure one canonical inbound lead contract and your outbound integrations.
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveView('incoming')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeView === 'incoming'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Incoming Webhooks
          </button>
          <button
            onClick={() => setActiveView('outgoing')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeView === 'outgoing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Outgoing Integrations
          </button>
          <button
            onClick={() => setActiveView('logs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeView === 'logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Webhook Logs
          </button>
        </nav>
      </div>

      {activeView === 'incoming' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Incoming Webhook Configuration</h3>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Webhook className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Webhook Endpoint URL</h4>
                    <div className="flex items-center gap-2 bg-white p-3 rounded border border-blue-200">
                      <code className="text-sm text-gray-700 flex-1 break-all">{webhookInboundUrl}</code>
                      <button
                        onClick={() => copyToClipboard(webhookInboundUrl, 'webhook-url')}
                        className="p-2 hover:bg-gray-100 rounded"
                      >
                        {copiedField === 'webhook-url' ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Canonical inbound contract</p>
                    <p>Authenticate with a single `X-API-Key` header. No timestamp or HMAC signature is required.</p>
                  </div>

                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">Mandatory fields</p>
                    <p>`source`, `lead.full_name`, `lead.mobile_number`, and `lead.email` are required for every webhook lead.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-medium text-gray-900">Required Header</h4>
                <div className="bg-gray-50 border border-gray-200 rounded p-3 mt-2">
                  <code className="text-sm text-gray-700">X-API-Key: your_organization_webhook_key</code>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">Canonical Payload Example</h4>
                  <button
                    onClick={() => copyToClipboard(canonicalPayload, 'canonical-payload')}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    {copiedField === 'canonical-payload' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
                <pre className="mt-2 bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto text-gray-700">
                  {canonicalPayload}
                </pre>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : configError ? (
            <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
              <Webhook className="w-12 h-12 text-red-300 mx-auto mb-3" />
              <p className="text-red-700 font-medium">Unable to prepare the organization webhook key</p>
              <p className="text-sm text-red-600 mt-2">{configError}</p>
              {activeOrganizationId && (
                <button
                  onClick={() => fetchWebhookConfigs(activeOrganizationId)}
                  className="mt-4 text-red-700 hover:text-red-800 font-medium"
                >
                  Retry
                </button>
              )}
            </div>
          ) : webhookConfigs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <Webhook className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Preparing the organization webhook key...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhookConfigs.map((config) => (
                <div key={config.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${config.is_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <h4 className="font-semibold text-gray-900">{config.webhook_name}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleConfigStatus(config.id, config.is_enabled)}
                        className={`px-3 py-1 text-sm rounded ${
                          config.is_enabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {config.is_enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => deleteConfig(config.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Webhook API Key</label>
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                      <code className="text-sm text-gray-700 flex-1 truncate">{config.api_key}</code>
                      <button
                        onClick={() => copyToClipboard(config.api_key, `api-key-${config.id}`)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {copiedField === `api-key-${config.id}` ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                    <span>Rate Limit: {config.rate_limit_per_minute} requests/minute</span>
                    <span>Created: {new Date(config.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'outgoing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Outgoing Integration Endpoints</h3>
            <button
              onClick={() => setShowAddEndpointModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Endpoint
            </button>
          </div>

          {endpoints.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No integration endpoints configured</p>
              <button
                onClick={() => setShowAddEndpointModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Add your first endpoint
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {endpoints.map((endpoint) => (
                <div key={endpoint.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${endpoint.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{endpoint.endpoint_name}</h4>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 mt-1">
                          {endpoint.endpoint_type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleEndpointStatus(endpoint.id, endpoint.is_active)}
                        className={`px-3 py-1 text-sm rounded ${
                          endpoint.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {endpoint.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => deleteEndpoint(endpoint.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="text-sm text-gray-700 font-mono break-all">{endpoint.endpoint_url}</p>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    Created: {new Date(endpoint.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'logs' && activeOrganizationId && (
        <WebhookLogsViewer activeOrganizationId={activeOrganizationId} />
      )}

      {showAddEndpointModal && (
        <AddIntegrationEndpointModal
          onClose={() => setShowAddEndpointModal(false)}
          onSuccess={() => {
            if (activeOrganizationId) {
              fetchIntegrationEndpoints(activeOrganizationId);
            }
            setShowAddEndpointModal(false);
          }}
        />
      )}
    </div>
  );
}
