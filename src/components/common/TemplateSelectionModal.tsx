// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { X, Search, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { replaceTemplateVariables } from '../../lib/templateVariables';
import { copyToClipboard } from '../../lib/communicationUtils';

interface Template {
  id: string;
  template_name: string;
  template_type: 'email' | 'whatsapp';
  subject?: string;
  body_content: string;
  is_active: boolean;
}

interface TemplateSelectionModalProps {
  type: 'email' | 'whatsapp';
  leadData: any;
  onClose: () => void;
  onConfirm: (template: Template, personalizedContent: { subject?: string; body: string }) => void;
  title?: string;
  confirmButtonText?: string;
}

export function TemplateSelectionModal({
  type,
  leadData,
  onClose,
  onConfirm,
  title,
  confirmButtonText = 'Continue',
}: TemplateSelectionModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [type]);

  async function loadTemplates() {
    setLoading(true);

    const userId = (await supabase.auth.getUser()).data.user?.id;

    if (!userId) {
      setTemplates([]);
      setSelectedTemplate(null);
      setLoading(false);
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('profile_id', userId)
      .maybeSingle();

    if (membershipError) {
      console.error('Error loading template organization:', membershipError);
      setTemplates([]);
      setSelectedTemplate(null);
      setLoading(false);
      return;
    }

    const organizationId = membership?.organization_id;

    if (!organizationId) {
      setTemplates([]);
      setSelectedTemplate(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('template_type', type)
      .eq('is_active', true)
      .eq('is_approved', true)
      .eq('organization_id', organizationId)
      .order('template_name');

    if (error) {
      console.error('Error loading templates:', error);
    } else {
      setTemplates(data || []);
      if (data && data.length > 0) {
        setSelectedTemplate(data[0]);
      }
    }
    setLoading(false);
  }

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter((t) =>
      t.template_name.toLowerCase().includes(query) ||
      t.body_content.toLowerCase().includes(query) ||
      (t.subject && t.subject.toLowerCase().includes(query))
    );
  }, [templates, searchQuery]);

  const personalizedContent = useMemo(() => {
    if (!selectedTemplate) return { subject: '', body: '' };

    const subject = selectedTemplate.subject
      ? replaceTemplateVariables(selectedTemplate.subject, leadData)
      : '';
    const body = replaceTemplateVariables(selectedTemplate.body_content, leadData);

    return { subject, body };
  }, [selectedTemplate, leadData]);

  const characterCount = personalizedContent.body.length;
  const isWhatsAppLong = type === 'whatsapp' && characterCount > 1000;

  function handleConfirm() {
    if (selectedTemplate) {
      onConfirm(selectedTemplate, personalizedContent);
    }
  }

  async function handleCopy() {
    const textToCopy =
      type === 'email'
        ? `Subject: ${personalizedContent.subject}\n\n${personalizedContent.body}`
        : personalizedContent.body;

    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div
          className={`${
            type === 'whatsapp' ? 'bg-green-600' : 'bg-blue-600'
          } text-white px-6 py-4 rounded-t-xl flex items-center justify-between`}
        >
          <h2 className="text-xl font-bold">
            {title || `Select ${type === 'whatsapp' ? 'WhatsApp' : 'Email'} Template`}
          </h2>
          <button
            onClick={onClose}
            className={`p-1 ${
              type === 'whatsapp' ? 'hover:bg-green-700' : 'hover:bg-blue-700'
            } rounded-lg transition`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/3 border-r border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-slate-500">Loading templates...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  {searchQuery ? 'No templates match your search' : 'No templates available'}
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition ${
                        selectedTemplate?.id === template.id
                          ? 'bg-blue-50 border-l-4 border-blue-600'
                          : ''
                      }`}
                    >
                      <div className="font-medium text-slate-900 text-sm">
                        {template.template_name}
                      </div>
                      {template.subject && (
                        <div className="text-xs text-slate-500 mt-1 truncate">
                          {template.subject}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Preview</h3>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {selectedTemplate ? (
                <div className="space-y-4">
                  {type === 'email' && personalizedContent.subject && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase">
                        Subject
                      </label>
                      <div className="bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-800">
                        {personalizedContent.subject}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase flex items-center justify-between">
                      <span>{type === 'email' ? 'Body' : 'Message'}</span>
                      <span
                        className={`font-normal ${
                          isWhatsAppLong ? 'text-orange-600' : 'text-slate-500'
                        }`}
                      >
                        {characterCount} characters
                        {isWhatsAppLong && ' (long message)'}
                      </span>
                    </label>
                    <div className="bg-white border border-slate-300 rounded-lg p-4 text-sm text-slate-800 whitespace-pre-wrap min-h-[200px]">
                      {personalizedContent.body}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  Select a template to preview
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTemplate}
            className={`flex-1 px-6 py-3 ${
              type === 'whatsapp'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
