// @ts-nocheck
import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface AddWebhookConfigModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return 'whk_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateHmacSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function AddWebhookConfigModal({ onClose, onSuccess }: AddWebhookConfigModalProps) {
  const { showError } = useToast();
  const [webhookName, setWebhookName] = useState('');
  const [rateLimit, setRateLimit] = useState(60);
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

      const apiKey = generateApiKey();
      const { error: insertError } = await supabase
        .from('webhook_configurations')
        .insert({
          organization_id: profile.organization_id,
          webhook_name: webhookName,
          api_key: apiKey,
          // Kept for schema compatibility, but the inbound webhook no longer exposes HMAC setup.
          hmac_secret: generateHmacSecret(),
          is_enabled: true,
          rate_limit_per_minute: rateLimit,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      showError(err.message || 'Failed to create webhook configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Webhook Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Configuration Name
            </label>
            <input
              type="text"
              value={webhookName}
              onChange={(e) => setWebhookName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Facebook Ads Webhook"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              A descriptive name to identify this webhook configuration
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rate Limit (requests per minute)
            </label>
            <input
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="1000"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Maximum number of requests allowed per minute
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              A single organization webhook API key will be generated automatically after creation.
              Use that key in the `X-API-Key` header when sending leads into the CRM.
            </p>
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
              {loading ? 'Creating...' : 'Create Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
