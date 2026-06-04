import { useState, useEffect, useRef } from 'react';
import { Mail, MessageCircle, Plus, Search, MoreVertical, CreditCard as Edit, Copy, Trash2, CheckCircle, XCircle, Clock, Eye, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { AddTemplateModal } from './AddTemplateModal';

interface Template {
  id: string;
  template_name: string;
  template_type: 'email' | 'whatsapp';
  subject: string | null;
  body_content: string;
  is_approved: boolean;
  is_active: boolean;
  is_draft: boolean;
  created_by: string;
  created_at: string;
  approved_at: string | null;
  creator_name: string;
  assigned_user_count: number;
  usage_count: number;
  assigned_users: string[];
}

interface TemplateManagementProps {
  templateType: 'email' | 'whatsapp';
}

function mapTemplateRow(template: any): Template {
  return {
    id: template.id,
    template_name: template.template_name,
    template_type: template.template_type,
    subject: template.subject,
    body_content: template.body_content,
    is_approved: template.is_approved,
    is_active: template.is_active,
    is_draft: template.is_draft,
    created_by: template.created_by,
    created_at: template.created_at,
    approved_at: template.approved_at,
    creator_name: template.profiles?.full_name || 'Unknown',
    assigned_user_count: template.message_template_users?.length || 0,
    usage_count: 0,
    assigned_users: (template.message_template_users || []).map((u: any) => u.user_id),
  };
}

export function TemplateManagement({ templateType }: TemplateManagementProps) {
  const { user } = useAuth();
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'draft'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; openAbove: boolean } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    fetchTemplates();
  }, [templateType]);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, statusFilter]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if user can manage templates (admins and super admins can manage)
  // Only evaluate after permissions have loaded
  const canManageTemplates = !permissionsLoading && (isAdmin || hasPermission('settings:manage'));

  const handleDropdownToggle = (templateId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openDropdown === templateId) {
      setOpenDropdown(null);
      setDropdownPosition(null);
      return;
    }

    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const estimatedDropdownHeight = 300;

    const openAbove = spaceBelow < estimatedDropdownHeight && rect.top > estimatedDropdownHeight;

    setDropdownPosition({
      top: openAbove ? rect.top - 8 : rect.bottom + 8,
      left: rect.right - 192, // 192px = 12rem (w-48)
      openAbove
    });

    setOpenDropdown(templateId);
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('message_templates')
        .select(`
          *,
          profiles!message_templates_created_by_fkey(full_name),
          message_template_users(user_id)
        `)
        .eq('template_type', templateType)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      setTemplates((data || []).map(mapTemplateRow));
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.body_content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'approved') {
        filtered = filtered.filter(t => t.is_approved && !t.is_draft);
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(t => !t.is_approved && !t.is_draft);
      } else if (statusFilter === 'draft') {
        filtered = filtered.filter(t => t.is_draft);
      }
    }

    setFilteredTemplates(filtered);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate({
      id: template.id,
      template_name: template.template_name,
      template_type: template.template_type,
      subject: template.subject || '',
      body_content: template.body_content,
      assigned_users: template.assigned_users,
    });
    setShowAddModal(true);
    setOpenDropdown(null);
  };

  const handleDuplicate = async (template: Template) => {
    setEditingTemplate({
      template_name: `${template.template_name} (Copy)`,
      template_type: template.template_type,
      subject: template.subject || '',
      body_content: template.body_content,
      assigned_users: template.assigned_users,
    });
    setShowAddModal(true);
    setOpenDropdown(null);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      alert('Failed to delete template: ' + error.message);
    } else {
      fetchTemplates();
    }
    setOpenDropdown(null);
  };

  const handleToggleActive = async (templateId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('message_templates')
      .update({ is_active: !currentStatus })
      .eq('id', templateId);

    if (error) {
      alert('Failed to update template status: ' + error.message);
    } else {
      fetchTemplates();
    }
    setOpenDropdown(null);
  };

  const handleApprove = async (templateId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('message_templates')
      .update({
        is_approved: true,
        is_draft: false,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', templateId);

    if (error) {
      alert('Failed to approve template: ' + error.message);
    } else {
      fetchTemplates();
    }
    setOpenDropdown(null);
  };

  const handleReject = async (templateId: string) => {
    if (!confirm('Reject this template? It will be moved back to draft status.')) return;

    const { error } = await supabase
      .from('message_templates')
      .update({
        is_approved: false,
        is_draft: true,
      })
      .eq('id', templateId);

    if (error) {
      alert('Failed to reject template: ' + error.message);
    } else {
      fetchTemplates();
    }
    setOpenDropdown(null);
  };

  const getStatusBadge = (template: Template) => {
    if (template.is_draft) {
      return <span className="px-2 py-1 text-xs font-medium bg-slate-200 text-slate-700 rounded">Draft</span>;
    } else if (!template.is_approved) {
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>;
    } else if (!template.is_active) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded flex items-center gap-1"><XCircle className="w-3 h-3" />Inactive</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3" />Active</span>;
    }
  };

  const pendingCount = templates.filter(t => !t.is_approved && !t.is_draft).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          >
            <option value="all">All Templates</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending Approval {pendingCount > 0 && `(${pendingCount})`}</option>
            <option value="draft">Drafts</option>
          </select>
        </div>

        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
        >
          <Plus className="w-5 h-5" />
          Create Template
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <div className={`inline-flex p-4 rounded-full ${templateType === 'email' ? 'bg-blue-100' : 'bg-green-100'} mb-4`}>
            {templateType === 'email' ? (
              <Mail className={`w-8 h-8 ${templateType === 'email' ? 'text-blue-600' : 'text-green-600'}`} />
            ) : (
              <MessageCircle className="w-8 h-8 text-green-600" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No templates found</h3>
          <p className="text-slate-600 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : `Create your first ${templateType} template to get started`}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Template Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Users</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Created By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Created</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {templateType === 'email' ? (
                        <Mail className="w-4 h-4 text-blue-600" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-green-600" />
                      )}
                      <div>
                        <div className="font-medium text-slate-800">{template.template_name}</div>
                        {template.subject && (
                          <div className="text-xs text-slate-500 truncate max-w-xs">{template.subject}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(template)}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <Users className="w-4 h-4" />
                      {template.assigned_user_count}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{template.usage_count}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{template.creator_name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">
                      {new Date(template.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      ref={(el) => buttonRefs.current[template.id] = el}
                      onClick={(e) => handleDropdownToggle(template.id, e)}
                      className="p-2 hover:bg-slate-200 rounded-lg transition"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {openDropdown && dropdownPosition && (() => {
        const template = templates.find(t => t.id === openDropdown);
        if (!template) return null;

        return (
          <div
            ref={dropdownRef}
            className="fixed w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50"
            style={{
              top: dropdownPosition.openAbove ? 'auto' : `${dropdownPosition.top}px`,
              bottom: dropdownPosition.openAbove ? `${window.innerHeight - dropdownPosition.top}px` : 'auto',
              left: `${dropdownPosition.left}px`
            }}
          >
            <button
              onClick={() => {
                setShowPreview(template.id);
                setOpenDropdown(null);
                setDropdownPosition(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 rounded-t-lg"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            {canManageTemplates && (
              <>
                <button
                  onClick={() => handleEdit(template)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDuplicate(template)}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                {!template.is_approved && !template.is_draft && (
                  <>
                    <button
                      onClick={() => handleApprove(template.id)}
                      className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(template.id)}
                      className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}
                {template.is_approved && (
                  <button
                    onClick={() => handleToggleActive(template.id, template.is_active)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    {template.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    {template.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(template.id)}
                  className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2 border-t border-slate-200 rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        );
      })()}

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Template Preview</h3>
              <button
                onClick={() => setShowPreview(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            {(() => {
              const template = templates.find(t => t.id === showPreview);
              if (!template) return null;
              return (
                <div className="p-6 space-y-4">
                  {template.subject && (
                    <div>
                      <div className="text-sm font-semibold text-slate-600 mb-1">Subject:</div>
                      <div className="text-base text-slate-800 bg-slate-50 p-3 rounded-lg">{template.subject}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-1">Message:</div>
                    <div className="text-base text-slate-800 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap font-mono text-sm">
                      {template.body_content}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <AddTemplateModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingTemplate(null);
        }}
        onSuccess={async () => {
          setShowAddModal(false);
          setEditingTemplate(null);
          await fetchTemplates();
        }}
        editingTemplate={editingTemplate}
      />
    </div>
  );
}
