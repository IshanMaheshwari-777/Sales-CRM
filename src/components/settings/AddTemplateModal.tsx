// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { X, Mail, MessageCircle, Eye, Sparkles } from 'lucide-react';
import { TEMPLATE_VARIABLES, insertVariableAtCursor, getPreviewData, replaceTemplateVariables, validateTemplateVariables } from '../../lib/templateVariables';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useToast } from '../../contexts/ToastContext';

interface User {
  id: string;
  full_name: string;
  email: string;
}

interface TemplateData {
  id?: string;
  template_name: string;
  template_type: 'email' | 'whatsapp';
  subject: string;
  body_content: string;
  assigned_users: string[];
}

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTemplate?: TemplateData | null;
}

export function AddTemplateModal({ isOpen, onClose, onSuccess, editingTemplate }: AddTemplateModalProps) {
  const { user, profile, organizationMember, organization } = useAuth();
  const { isAdmin } = usePermissions();
  const { showError, showWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState<TemplateData>({
    template_name: '',
    template_type: 'email',
    subject: '',
    body_content: '',
    assigned_users: [],
  });
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const [activeInput, setActiveInput] = useState<'subject' | 'body'>('body');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      if (editingTemplate) {
        setFormData(editingTemplate);
      } else {
        setFormData({
          template_name: '',
          template_type: 'email',
          subject: '',
          body_content: '',
          assigned_users: [],
        });
      }
      setShowPreview(false);
    }
  }, [isOpen, editingTemplate, user?.id, profile?.id, organizationMember?.organization_id, organization?.id]);

  const resolveOrganizationId = async (): Promise<string | null> => {
    const contextOrganizationId =
      organizationMember?.organization_id || profile?.organization_id || organization?.id || null;

    if (contextOrganizationId) {
      return contextOrganizationId;
    }

    if (!user?.id) {
      return null;
    }

    const { data, error } = await supabase
      .rpc('get_user_organization_id', { user_uuid: user.id });

    if (error) {
      console.error('Error resolving organization for template flow:', error);
      return null;
    }

    return data || null;
  };

  const getFallbackCurrentUser = (): User[] => {
    if (!user?.id || !user.email) {
      return [];
    }

    const fallbackName = profile?.full_name?.trim() || user.email;

    return [{
      id: user.id,
      full_name: fallbackName,
      email: user.email,
    }];
  };

  const fetchUsers = async () => {
    await resolveOrganizationId();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');

    if (error) {
      console.error('Error loading template users:', error);
      setUsers(getFallbackCurrentUser());
      return;
    }

    const dedupedUsers = new Map<string, User>();

    (data || []).forEach((profileRow) => {
      if (!profileRow.id || !profileRow.email) {
        return;
      }

      dedupedUsers.set(profileRow.id, {
        id: profileRow.id,
        full_name: profileRow.full_name?.trim() || profileRow.email,
        email: profileRow.email,
      });
    });

    getFallbackCurrentUser().forEach((fallbackUser) => {
      dedupedUsers.set(fallbackUser.id, fallbackUser);
    });

    const resolvedUsers = Array.from(dedupedUsers.values()).sort((left, right) =>
      left.full_name.localeCompare(right.full_name)
    );

    setUsers(resolvedUsers);
  };

  const handleVariableClick = (variableKey: string) => {
    if (activeInput === 'subject' && subjectInputRef.current) {
      insertVariableAtCursor(
        subjectInputRef.current as any,
        variableKey,
        (value) => setFormData({ ...formData, subject: value })
      );
    } else if (activeInput === 'body' && bodyTextareaRef.current) {
      insertVariableAtCursor(
        bodyTextareaRef.current,
        variableKey,
        (value) => setFormData({ ...formData, body_content: value })
      );
    }
  };

  const handleUserToggle = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_users: prev.assigned_users.includes(userId)
        ? prev.assigned_users.filter(id => id !== userId)
        : [...prev.assigned_users, userId]
    }));
  };

  const handleSelectAll = () => {
    if (formData.assigned_users.length === users.length) {
      setFormData({ ...formData, assigned_users: [] });
    } else {
      setFormData({ ...formData, assigned_users: users.map(u => u.id) });
    }
  };

  const handleSubmit = async (submitType: 'draft' | 'approval' | 'approve') => {
    if (!user) return;

    const organizationId = await resolveOrganizationId();

    if (!organizationId) {
      showError('Unable to determine your organization. Please refresh and try again.');
      return;
    }

    if (!formData.template_name.trim()) {
      showWarning('Please enter a template name');
      return;
    }

    if (formData.template_type === 'email' && !formData.subject.trim()) {
      showWarning('Please enter a subject for email template');
      return;
    }

    if (!formData.body_content.trim()) {
      showWarning('Please enter template content');
      return;
    }

    if (formData.assigned_users.length === 0) {
      showWarning('Please select at least one user');
      return;
    }

    const invalidVars = validateTemplateVariables(formData.body_content);
    if (formData.template_type === 'email') {
      invalidVars.push(...validateTemplateVariables(formData.subject));
    }
    if (invalidVars.length > 0) {
      showWarning(`Invalid variables found: ${invalidVars.join(', ')}\n\nPlease use the variable picker to insert valid variables.`);
      return;
    }

    setLoading(true);

    try {
      const isDraft = submitType === 'draft';
      const isApproved = submitType === 'approve' && isAdmin;

      const templateData = {
        template_name: formData.template_name,
        template_type: formData.template_type,
        subject: formData.template_type === 'email' ? formData.subject : null,
        body_content: formData.body_content,
        created_by: user.id,
        is_draft: isDraft,
        is_approved: isApproved,
        approved_by: isApproved ? user.id : null,
        approved_at: isApproved ? new Date().toISOString() : null,
        organization_id: organizationId,
      };

      let templateId = editingTemplate?.id;

      if (editingTemplate?.id) {
        const { error } = await supabase
          .from('message_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('message_templates')
          .insert(templateData)
          .select()
          .single();

        if (error) throw error;
        templateId = data.id;
      }

      if (templateId) {
        await supabase
          .from('message_template_users')
          .delete()
          .eq('template_id', templateId);

        const userAssignments = formData.assigned_users.map(userId => ({
          template_id: templateId,
          user_id: userId,
        }));

        const { error: assignError } = await supabase
          .from('message_template_users')
          .insert(userAssignments);

        if (assignError) throw assignError;
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving template:', error);
      showError('Failed to save template: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getPreviewContent = () => {
    const previewData = getPreviewData();
    return {
      subject: replaceTemplateVariables(formData.subject, previewData),
      body: replaceTemplateVariables(formData.body_content, previewData)
    };
  };

  const characterCount = formData.body_content.length;
  const isWhatsAppOverLimit = formData.template_type === 'whatsapp' && characterCount > 1000;

  if (!isOpen) return null;

  return (
    <div data-testid="template-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${formData.template_type === 'email' ? 'bg-blue-100' : 'bg-green-100'}`}>
              {formData.template_type === 'email' ? (
                <Mail className={`w-5 h-5 ${formData.template_type === 'email' ? 'text-blue-600' : 'text-green-600'}`} />
              ) : (
                <MessageCircle className="w-5 h-5 text-green-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h2>
              <p className="text-sm text-slate-600">
                {formData.template_type === 'email' ? 'Email Template' : 'WhatsApp Template'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="template-modal-close"
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  data-testid="template-name-input"
                  type="text"
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder="e.g., Welcome Email, Follow-up Message"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Template Type <span className="text-red-500">*</span>
                </label>
                <select
                  data-testid="template-type-select"
                  value={formData.template_type}
                  onChange={(e) => setFormData({ ...formData, template_type: e.target.value as 'email' | 'whatsapp' })}
                  disabled={!!editingTemplate}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>

              {formData.template_type === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={subjectInputRef}
                    data-testid="template-subject-input"
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    onFocus={() => setActiveInput('subject')}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="Email subject line..."
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Message Content <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-sm ${isWhatsAppOverLimit ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                    {characterCount} {formData.template_type === 'whatsapp' && '/ 1000'} characters
                  </span>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  data-testid="template-body-input"
                  value={formData.body_content}
                  onChange={(e) => setFormData({ ...formData, body_content: e.target.value })}
                  onFocus={() => setActiveInput('body')}
                  rows={12}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none font-mono text-sm"
                  placeholder="Type your message here. Use the variable picker on the right to insert dynamic fields..."
                />
                {isWhatsAppOverLimit && (
                  <p className="text-sm text-red-600 mt-1">
                    WhatsApp messages should be under 1000 characters
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assign to Users <span className="text-red-500">*</span>
                </label>
                <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer border-b border-slate-200 mb-2">
                    <input
                      type="checkbox"
                      data-testid="template-select-all-users"
                      checked={formData.assigned_users.length === users.length && users.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="font-semibold text-slate-700">Select All ({users.length})</span>
                  </label>
                  {users.map(user => (
                    <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid={`template-assign-user-${user.id}`}
                        checked={formData.assigned_users.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-800">{user.full_name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {formData.assigned_users.length} user{formData.assigned_users.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Variables
                  </label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    data-testid="template-preview-toggle"
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    {showPreview ? 'Hide' : 'Show'} Preview
                  </button>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  Click to insert at cursor position
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase px-2 py-1">Counselor Fields</div>
                  {TEMPLATE_VARIABLES.filter(v => v.category === 'counselor').map(variable => (
                    <button
                      key={variable.key}
                      onClick={() => handleVariableClick(variable.key)}
                      className="w-full text-left px-3 py-2 text-sm bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition border border-orange-200"
                    >
                      <div className="font-medium">{variable.label}</div>
                      <div className="text-xs text-orange-600 font-mono">{'{{' + variable.key + '}}'}</div>
                    </button>
                  ))}

                  <div className="text-xs font-semibold text-slate-500 uppercase px-2 py-1 mt-3">Lead Fields</div>
                  {TEMPLATE_VARIABLES.filter(v => v.category === 'lead').map(variable => (
                    <button
                      key={variable.key}
                      onClick={() => handleVariableClick(variable.key)}
                      className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition border border-blue-200"
                    >
                      <div className="font-medium">{variable.label}</div>
                      <div className="text-xs text-blue-600 font-mono">{'{{' + variable.key + '}}'}</div>
                    </button>
                  ))}
                </div>
              </div>

              {showPreview && (
                <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Preview with Sample Data
                  </h3>
                  {formData.template_type === 'email' && formData.subject && (
                    <div className="mb-3">
                      <div className="text-xs text-slate-600 mb-1">Subject:</div>
                      <div className="text-sm font-medium text-slate-800 bg-white p-2 rounded border border-slate-200">
                        {getPreviewContent().subject}
                      </div>
                    </div>
                  )}
                  {formData.body_content && (
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Message:</div>
                      <div className="text-sm text-slate-800 bg-white p-2 rounded border border-slate-200 whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {getPreviewContent().body}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            data-testid="template-cancel-button"
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition"
            disabled={loading}
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit('draft')}
              data-testid="template-save-draft-button"
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
              disabled={loading}
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmit('approval')}
              data-testid="template-submit-approval-button"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
              disabled={loading}
            >
              Submit for Approval
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
