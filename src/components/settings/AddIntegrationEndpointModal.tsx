// @ts-nocheck
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface AddIntegrationEndpointModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type EndpointType = 'slack' | 'webhook' | 'custom';
type AuthType = 'none' | 'api_key' | 'hmac' | 'bearer';

export function AddIntegrationEndpointModal({ onClose, onSuccess }: AddIntegrationEndpointModalProps) {
  const { showError } = useToast();
  const [endpointName, setEndpointName] = useState('');
  const [endpointType, setEndpointType] = useState<EndpointType>('webhook');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [authType, setAuthType] = useState<AuthType>('none');
  const [authApiKey, setAuthApiKey] = useState('');
  const [authHmacSecret, setAuthHmacSecret] = useState('');
  const [authBearerToken, setAuthBearerToken] = useState('');
  const [subscribeToEvents, setSubscribeToEvents] = useState({
    'lead.created': true,
    'lead.reassigned': false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organization not found');

      const authConfig: any = {};
      if (authType === 'api_key') {
        authConfig.api_key = authApiKey;
      } else if (authType === 'hmac') {
        authConfig.secret = authHmacSecret;
      } else if (authType === 'bearer') {
        authConfig.token = authBearerToken;
      }

      const { data: endpoint, error: insertError } = await supabase
        .from('integration_endpoints')
        .insert({
          organization_id: profile.organization_id,
          endpoint_name: endpointName,
          endpoint_type: endpointType,
          endpoint_url: endpointUrl,
          authentication_type: authType,
          authentication_config: authConfig,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const subscriptions = Object.entries(subscribeToEvents)
        .filter(([, enabled]) => enabled)
        .map(([eventType]) => ({
          organization_id: profile.organization_id,
          endpoint_id: endpoint.id,
          event_type: eventType,
          is_active: true,
        }));

      if (subscriptions.length > 0) {
        const { error: subError } = await supabase
          .from('webhook_event_subscriptions')
          .insert(subscriptions);

        if (subError) throw subError;
      }

      onSuccess();
    } catch (err: any) {
      showError(err.message || 'Failed to create integration endpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">Add Integration Endpoint</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endpoint Name
            </label>
            <input
              type="text"
              value={endpointName}
              onChange={(e) => setEndpointName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Slack Notifications"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endpoint Type
            </label>
            <select
              value={endpointType}
              onChange={(e) => setEndpointType(e.target.value as EndpointType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="slack">Slack</option>
              <option value="webhook">Generic Webhook</option>
              <option value="custom">Custom Integration</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endpoint URL
            </label>
            <input
              type="url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={endpointType === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://example.com/webhook'}
              required
            />
            {endpointType === 'slack' && (
              <p className="text-sm text-gray-500 mt-1">
                Get this URL from your Slack workspace's Incoming Webhooks configuration
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Authentication Type
            </label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={endpointType === 'slack'}
            >
              <option value="none">No Authentication</option>
              <option value="api_key">API Key</option>
              <option value="hmac">HMAC Signature</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </div>

          {authType === 'api_key' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="text"
                value={authApiKey}
                onChange={(e) => setAuthApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter API key"
                required
              />
            </div>
          )}

          {authType === 'hmac' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HMAC Secret
              </label>
              <input
                type="text"
                value={authHmacSecret}
                onChange={(e) => setAuthHmacSecret(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter HMAC secret key"
                required
              />
            </div>
          )}

          {authType === 'bearer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bearer Token
              </label>
              <input
                type="text"
                value={authBearerToken}
                onChange={(e) => setAuthBearerToken(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter bearer token"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subscribe to Events
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={subscribeToEvents['lead.created']}
                  onChange={(e) => setSubscribeToEvents(prev => ({ ...prev, 'lead.created': e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Lead Created & Assigned</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={subscribeToEvents['lead.reassigned']}
                  onChange={(e) => setSubscribeToEvents(prev => ({ ...prev, 'lead.reassigned': e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Lead Reassigned</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Endpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
