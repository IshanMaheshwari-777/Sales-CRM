import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Copy,
  Mail,
  Pencil,
  Play,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../contexts/PermissionsContext';
import {
  CHANNEL_OPTIONS,
  getCategoryLabel,
  getOperatorsForFieldType,
  UPDATEABLE_LEAD_FIELDS,
  WORKFLOW_CATEGORIES,
  WORKFLOW_FILTER_FIELDS,
  type WorkflowActionDraft,
  type WorkflowCategory,
  type WorkflowConditionDraft,
  type WorkflowConditionGate,
} from '../lib/workflowAutomation';

type WorkflowRecord = {
  id: string;
  name: string;
  category: WorkflowCategory;
  start_at: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  organization_id: string;
};

type ProfileOption = { id: string; full_name: string };
type StatusOption = { id: string; display_name: string; status_type: string; parent_status_id: string | null };
type SourceOption = { id: string; name: string };
type TemplateOption = { id: string; template_name: string; subject?: string | null };

type WorkflowFormState = {
  name: string;
  category: WorkflowCategory;
  startDate: string;
  startTime: string;
  isActive: boolean;
  conditions: WorkflowConditionDraft[];
  actions: WorkflowActionDraft[];
};

const emptyCondition = (): WorkflowConditionDraft => ({
  id: crypto.randomUUID(),
  fieldKey: 'status_id',
  operator: 'equals',
  value: '',
  gate: 'AND',
});

const emptyAction = (): WorkflowActionDraft => ({
  id: crypto.randomUUID(),
  actionType: 'update_field',
  payload: {
    fieldKey: 'status_id',
    value: '',
  },
});

const initialFormState = (): WorkflowFormState => ({
  name: '',
  category: 'UPDATE_ATTRIBUTES',
  startDate: new Date().toISOString().split('T')[0],
  startTime: '09:00',
  isActive: false,
  conditions: [emptyCondition()],
  actions: [emptyAction()],
});

function ActionTypeBadge({ type }: { type: string }) {
  const label = type === 'update_field' ? 'Field Update' : type === 'create_followup' ? 'Follow-up' : 'Email';
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {label}
    </span>
  );
}

export function WorkflowAutomationPage() {
  const { isAdmin, loading: permissionsLoading, userProfile } = usePermissions();
  const db = supabase as any;

  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [workflowConditions, setWorkflowConditions] = useState<Record<string, any[]>>({});
  const [workflowActions, setWorkflowActions] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [formState, setFormState] = useState<WorkflowFormState>(initialFormState());

  useEffect(() => {
    if (userProfile?.organization_id) {
      void loadAll();
    }
  }, [userProfile?.organization_id]);

  const createdByLookup = useMemo(() => {
    return Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name]));
  }, [profiles]);

  const mainStatuses = statuses.filter((status) => status.status_type === 'main');
  const subStatuses = statuses.filter((status) => status.parent_status_id);

  async function loadAll() {
    if (!userProfile?.organization_id) return;

    setLoading(true);
    setError(null);

    try {
      const [workflowRes, profilesRes, statusRes, sourceRes, templateRes] = await Promise.all([
        db.from('workflows').select('*').eq('organization_id', userProfile.organization_id).order('created_at', { ascending: false }),
        db.from('profiles').select('id, full_name').eq('organization_id', userProfile.organization_id).order('full_name'),
        db.from('lead_statuses').select('id, display_name, status_type, parent_status_id').eq('organization_id', userProfile.organization_id).eq('is_active', true).order('order_index'),
        db.from('lead_sources').select('id, name').eq('is_active', true).eq('organization_id', userProfile.organization_id).order('name'),
        db.from('message_templates').select('id, template_name, subject').eq('organization_id', userProfile.organization_id).eq('template_type', 'email').eq('is_active', true).order('template_name'),
      ]);

      if (workflowRes.error) throw workflowRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (statusRes.error) throw statusRes.error;
      if (sourceRes.error) throw sourceRes.error;
      if (templateRes.error) throw templateRes.error;

      const workflowIds = new Set((workflowRes.data || []).map((workflow: WorkflowRecord) => workflow.id));
      let groupedConditions: Record<string, any[]> = {};
      let groupedActions: Record<string, any[]> = {};

      if (workflowIds.size > 0) {
        const workflowIdList = Array.from(workflowIds);
        const [conditionRes, actionRes] = await Promise.all([
          db.from('workflow_conditions').select('*').in('workflow_id', workflowIdList).order('position'),
          db.from('workflow_actions').select('*').in('workflow_id', workflowIdList).order('position'),
        ]);

        if (conditionRes.error) throw conditionRes.error;
        if (actionRes.error) throw actionRes.error;

        groupedConditions = (conditionRes.data || []).reduce((acc: Record<string, any[]>, item: any) => {
          acc[item.workflow_id] = acc[item.workflow_id] || [];
          acc[item.workflow_id].push(item);
          return acc;
        }, {});
        groupedActions = (actionRes.data || []).reduce((acc: Record<string, any[]>, item: any) => {
          acc[item.workflow_id] = acc[item.workflow_id] || [];
          acc[item.workflow_id].push(item);
          return acc;
        }, {});
      }

      setWorkflows((workflowRes.data || []) as WorkflowRecord[]);
      setProfiles((profilesRes.data || []) as ProfileOption[]);
      setStatuses((statusRes.data || []) as StatusOption[]);
      setSources((sourceRes.data || []) as SourceOption[]);
      setTemplates((templateRes.data || []) as TemplateOption[]);
      setWorkflowConditions(groupedConditions);
      setWorkflowActions(groupedActions);
    } catch (loadError: any) {
      console.error('Error loading workflows:', loadError);
      setError(loadError.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }

  function resetAndOpenCreate() {
    setEditingWorkflowId(null);
    setFormState(initialFormState());
    setError(null);
    setShowModal(true);
  }

  async function openEdit(workflowId: string) {
    const workflow = workflows.find((item) => item.id === workflowId);
    if (!workflow) return;

    const conditions = (workflowConditions[workflowId] || []).map((condition: any) => ({
      id: condition.id,
      fieldKey: condition.field_key,
      operator: condition.operator,
      value: String(condition.value_json?.value ?? ''),
      gate: condition.logical_gate || 'AND',
    }));

    const actions = (workflowActions[workflowId] || []).map((action: any) => ({
      id: action.id,
      actionType: action.action_type,
      payload: action.payload_json || {},
    }));

    const startAt = new Date(workflow.start_at);

    setEditingWorkflowId(workflow.id);
    setFormState({
      name: workflow.name,
      category: workflow.category,
      startDate: workflow.start_at ? startAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      startTime: workflow.start_at ? `${String(startAt.getHours()).padStart(2, '0')}:${String(startAt.getMinutes()).padStart(2, '0')}` : '09:00',
      isActive: workflow.is_active,
      conditions: conditions.length > 0 ? conditions : [emptyCondition()],
      actions: actions.length > 0 ? actions : [emptyAction()],
    });
    setError(null);
    setShowModal(true);
  }

  async function writeAudit(actionType: string, metadata: Record<string, unknown>) {
    try {
      await db.from('audit_log').insert({
        actor_user_id: userProfile?.id,
        action_type: actionType,
        target_organization_id: userProfile?.organization_id,
        metadata,
      });
    } catch (auditError) {
      console.error('Workflow audit error:', auditError);
    }
  }

  async function saveWorkflow() {
    if (!userProfile?.organization_id) return;
    if (!formState.name.trim()) {
      setError('Workflow name is required');
      return;
    }
    if (formState.conditions.some((condition) => !condition.fieldKey || (!['is_true', 'is_false'].includes(condition.operator) && !condition.value))) {
      setError('Please complete all workflow conditions');
      return;
    }
    if (formState.actions.length === 0) {
      setError('At least one action is required');
      return;
    }
    if (
      formState.category === 'SEND_IMMEDIATE_COMMUNICATION' &&
      (formState.actions.length !== 1 || formState.actions[0].actionType !== 'send_email')
    ) {
      setError('Immediate communication workflows must contain exactly one email action');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const startAt = new Date(`${formState.startDate}T${formState.startTime}:00`);
      const workflowPayload = {
        organization_id: userProfile.organization_id,
        name: formState.name.trim(),
        category: formState.category,
        start_at: startAt.toISOString(),
        is_active: formState.isActive,
        created_by: userProfile.id,
      };

      let workflowId = editingWorkflowId;

      if (editingWorkflowId) {
        const { error: updateError } = await db.from('workflows').update(workflowPayload).eq('id', editingWorkflowId);
        if (updateError) throw updateError;

        await db.from('workflow_conditions').delete().eq('workflow_id', editingWorkflowId);
        await db.from('workflow_actions').delete().eq('workflow_id', editingWorkflowId);
      } else {
        const { data: createdWorkflow, error: createError } = await db.from('workflows').insert(workflowPayload).select('id').single();
        if (createError) throw createError;
        workflowId = createdWorkflow.id;
      }

      const conditionRows = formState.conditions.map((condition, index) => ({
        workflow_id: workflowId,
        position: index,
        field_key: condition.fieldKey,
        operator: condition.operator,
        logical_gate: index === 0 ? 'AND' : condition.gate,
        value_json: ['is_true', 'is_false'].includes(condition.operator)
          ? { value: condition.operator === 'is_true' }
          : { value: condition.value },
      }));

      const actionRows = formState.actions.map((action, index) => ({
        workflow_id: workflowId,
        position: index,
        action_type: action.actionType,
        payload_json: action.payload,
      }));

      if (conditionRows.length > 0) {
        const { error: conditionError } = await db.from('workflow_conditions').insert(conditionRows);
        if (conditionError) throw conditionError;
      }

      if (actionRows.length > 0) {
        const { error: actionError } = await db.from('workflow_actions').insert(actionRows);
        if (actionError) throw actionError;
      }

      await writeAudit(editingWorkflowId ? 'workflow_updated' : 'workflow_created', {
        workflow_id: workflowId,
        workflow_name: formState.name,
        category: formState.category,
      });

      setShowModal(false);
      setFormState(initialFormState());
      setEditingWorkflowId(null);
      await loadAll();
    } catch (saveError: any) {
      console.error('Error saving workflow:', saveError);
      setError(saveError.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }

  async function toggleWorkflow(workflow: WorkflowRecord) {
    try {
      const { error: toggleError } = await db
        .from('workflows')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id);

      if (toggleError) throw toggleError;
      await writeAudit('workflow_toggled', {
        workflow_id: workflow.id,
        is_active: !workflow.is_active,
      });
      await loadAll();
    } catch (toggleErr: any) {
      alert(toggleErr.message || 'Failed to update workflow status');
    }
  }

  async function deleteWorkflow(workflow: WorkflowRecord) {
    if (!confirm(`Delete workflow "${workflow.name}"?`)) {
      return;
    }

    try {
      const { error: deleteError } = await db.from('workflows').delete().eq('id', workflow.id);
      if (deleteError) throw deleteError;
      await writeAudit('workflow_deleted', {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
      });
      await loadAll();
    } catch (deleteErr: any) {
      alert(deleteErr.message || 'Failed to delete workflow');
    }
  }

  async function duplicateWorkflow(workflow: WorkflowRecord) {
    const conditions = workflowConditions[workflow.id] || [];
    const actions = workflowActions[workflow.id] || [];

    try {
      const { data: createdWorkflow, error: createError } = await db
        .from('workflows')
        .insert({
          organization_id: workflow.organization_id,
          name: `${workflow.name} (Copy)`,
          category: workflow.category,
          start_at: workflow.start_at,
          is_active: false,
          created_by: userProfile?.id,
        })
        .select('id')
        .single();

      if (createError) throw createError;

      if (conditions.length > 0) {
        await db.from('workflow_conditions').insert(
          conditions.map((condition: any, index: number) => ({
            workflow_id: createdWorkflow.id,
            position: index,
            field_key: condition.field_key,
            operator: condition.operator,
            logical_gate: condition.logical_gate || 'AND',
            value_json: condition.value_json,
          })),
        );
      }

      if (actions.length > 0) {
        await db.from('workflow_actions').insert(
          actions.map((action: any, index: number) => ({
            workflow_id: createdWorkflow.id,
            position: index,
            action_type: action.action_type,
            payload_json: action.payload_json,
          })),
        );
      }

      await writeAudit('workflow_duplicated', {
        workflow_id: createdWorkflow.id,
        source_workflow_id: workflow.id,
      });
      await loadAll();
    } catch (duplicateErr: any) {
      alert(duplicateErr.message || 'Failed to duplicate workflow');
    }
  }

  function updateCondition(conditionId: string, updates: Partial<WorkflowConditionDraft>) {
    setFormState((current) => ({
      ...current,
      conditions: current.conditions.map((condition) =>
        condition.id === conditionId ? { ...condition, ...updates } : condition,
      ),
    }));
  }

  function updateConditionGate(conditionId: string, gate: WorkflowConditionGate) {
    updateCondition(conditionId, { gate });
  }

  function addCondition() {
    setFormState((current) => ({
      ...current,
      conditions: [...current.conditions, emptyCondition()],
    }));
  }

  function removeCondition(conditionId: string) {
    setFormState((current) => ({
      ...current,
      conditions: current.conditions.length === 1
        ? current.conditions
        : current.conditions.filter((condition) => condition.id !== conditionId),
    }));
  }

  function updateAction(actionId: string, updates: Partial<WorkflowActionDraft>) {
    setFormState((current) => ({
      ...current,
      actions: current.actions.map((action) => (action.id === actionId ? { ...action, ...updates } : action)),
    }));
  }

  function addAction() {
    setFormState((current) => ({
      ...current,
      actions: [...current.actions, emptyAction()],
    }));
  }

  function removeAction(actionId: string) {
    setFormState((current) => ({
      ...current,
      actions: current.actions.length === 1
        ? current.actions
        : current.actions.filter((action) => action.id !== actionId),
    }));
  }

  function updateActionPayload(actionId: string, key: string, value: unknown) {
    setFormState((current) => ({
      ...current,
      actions: current.actions.map((action) =>
        action.id === actionId
          ? { ...action, payload: { ...action.payload, [key]: value } }
          : action,
      ),
    }));
  }

  function getFieldDefinition(fieldKey: string) {
    return WORKFLOW_FILTER_FIELDS.find((field) => field.key === fieldKey) || WORKFLOW_FILTER_FIELDS[0];
  }

  function getLeadFieldDefinition(fieldKey: string) {
    return UPDATEABLE_LEAD_FIELDS.find((field) => field.key === fieldKey) || UPDATEABLE_LEAD_FIELDS[0];
  }

  function renderValueInput(fieldKey: string, value: string, onChange: (value: string) => void) {
    const definition = getFieldDefinition(fieldKey);

    if (definition.type === 'select') {
      let options: Array<{ value: string; label: string }> = [];
      if (fieldKey === 'current_lead_owner') {
        options = profiles.map((profile) => ({ value: profile.id, label: profile.full_name }));
      } else if (fieldKey === 'source_id') {
        options = sources.map((source) => ({ value: source.id, label: source.name }));
      } else if (fieldKey === 'status_id') {
        options = mainStatuses.map((status) => ({ value: status.id, label: status.display_name }));
      } else if (fieldKey === 'sub_status_id') {
        options = subStatuses.map((status) => ({ value: status.id, label: status.display_name }));
      } else if (fieldKey === 'channel') {
        options = CHANNEL_OPTIONS.map((channel) => ({ value: channel, label: channel }));
      }

      return (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (definition.type === 'boolean') {
      return (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
          placeholder="true / false handled by operator"
          disabled
        />
      );
    }

    return (
      <input
        type={definition.type === 'number' ? 'number' : definition.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
    );
  }

  function renderUpdateValueInput(action: WorkflowActionDraft) {
    const fieldKey = String(action.payload.fieldKey || 'status_id');
    const value = String(action.payload.value || '');
    const definition = getLeadFieldDefinition(fieldKey);

    if (definition.type === 'select') {
      let options: Array<{ value: string; label: string }> = [];
      if (fieldKey === 'current_lead_owner') {
        options = profiles.map((profile) => ({ value: profile.id, label: profile.full_name }));
      } else if (fieldKey === 'status_id') {
        options = mainStatuses.map((status) => ({ value: status.id, label: status.display_name }));
      } else if (fieldKey === 'sub_status_id') {
        options = subStatuses.map((status) => ({ value: status.id, label: status.display_name }));
      } else if (fieldKey === 'channel') {
        options = CHANNEL_OPTIONS.map((channel) => ({ value: channel, label: channel }));
      }

      return (
        <select
          value={value}
          onChange={(event) => updateActionPayload(action.id, 'value', event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        >
          <option value="">Select a value</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (definition.type === 'boolean') {
      return (
        <select
          value={value}
          onChange={(event) => updateActionPayload(action.id, 'value', event.target.value === 'true')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        >
          <option value="">Select</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(event) => updateActionPayload(action.id, 'value', event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
    );
  }

  if (permissionsLoading || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-2xl font-bold text-slate-800">Workflow Automation</h2>
          <p className="mt-2 text-sm text-slate-700">
            Workflow Automation is restricted to admin and super admin users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="workflow-automation-page" className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-100 p-3 text-orange-600">
              <Workflow className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Workflow Automation</h1>
              <p className="mt-1 text-sm text-slate-600">
                Build lead-based workflows that update records, create follow-ups, and queue emails automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => void loadAll()}
            data-testid="workflow-refresh-button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={resetAndOpenCreate}
            data-testid="workflow-create-button"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Create Workflow
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_1.4fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <div>Workflow</div>
          <div>Category</div>
          <div>Created By</div>
          <div>Start Time</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-500">
              <Bot className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No workflows yet</h3>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Create your first automation to target leads using existing CRM filters and trigger updates, follow-ups, or queued emails.
            </p>
          </div>
        ) : (
          workflows.map((workflow) => {
            const actions = workflowActions[workflow.id] || [];
            const conditions = workflowConditions[workflow.id] || [];

            return (
              <div key={workflow.id} className="border-b border-slate-100 px-6 py-5 last:border-b-0">
                <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_1.4fr] gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{workflow.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {conditions.length} conditions, {actions.length} actions
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actions.slice(0, 3).map((action: any) => (
                        <ActionTypeBadge key={action.id} type={action.action_type} />
                      ))}
                    </div>
                  </div>

                  <div className="text-sm text-slate-700">{getCategoryLabel(workflow.category)}</div>
                  <div className="text-sm text-slate-700">{createdByLookup[workflow.created_by || ''] || 'Unknown'}</div>
                  <div className="text-sm text-slate-700">{new Date(workflow.start_at).toLocaleString()}</div>
                  <div>
                    <button
                      onClick={() => void toggleWorkflow(workflow)}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                        workflow.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void openEdit(workflow.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => void duplicateWorkflow(workflow)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicate
                    </button>
                    <button
                      onClick={() => void deleteWorkflow(workflow)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div data-testid="workflow-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingWorkflowId ? 'Edit Workflow' : 'Create Workflow'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Configure an IF block using CRM lead attributes, then define the actions that should run.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-base font-semibold text-slate-900">Workflow Basics</h3>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Workflow Name</label>
                    <input
                      value={formState.name}
                      onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      placeholder="High intent leads - same day follow-up"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
                    <div className="grid gap-3">
                      {WORKFLOW_CATEGORIES.map((category) => (
                        <button
                          key={category.value}
                          type="button"
                          onClick={() => setFormState((current) => ({ ...current, category: category.value }))}
                          className={`rounded-xl border p-4 text-left ${
                            formState.category === category.value
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="font-semibold text-slate-900">{category.label}</div>
                          <div className="mt-1 text-sm text-slate-600">{category.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Start Date</label>
                      <input
                        type="date"
                        value={formState.startDate}
                        onChange={(event) => setFormState((current) => ({ ...current, startDate: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Start Time</label>
                      <input
                        type="time"
                        value={formState.startTime}
                        onChange={(event) => setFormState((current) => ({ ...current, startTime: event.target.value }))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={formState.isActive}
                      onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Activate this workflow immediately after saving
                    </span>
                  </label>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">IF Conditions</h3>
                    <button
                      type="button"
                      onClick={addCondition}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add Condition
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formState.conditions.map((condition, index) => {
                      const definition = getFieldDefinition(condition.fieldKey);
                      const operators = getOperatorsForFieldType(definition.type);

                      return (
                        <div key={condition.id}>
                          {index > 0 && (
                            <div className="mb-3 flex justify-center">
                              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                                {(['AND', 'OR'] as WorkflowConditionGate[]).map((gateOption) => (
                                  <button
                                    key={gateOption}
                                    type="button"
                                    onClick={() => updateConditionGate(condition.id, gateOption)}
                                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                                      condition.gate === gateOption
                                        ? 'bg-orange-500 text-white'
                                        : 'text-slate-600 hover:bg-white'
                                    }`}
                                  >
                                    {gateOption}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="rounded-xl border border-slate-200 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-800">Condition {index + 1}</div>
                            <button
                              type="button"
                              onClick={() => removeCondition(condition.id)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>

                            <div className="grid gap-3">
                              <select
                                value={condition.fieldKey}
                                onChange={(event) =>
                                  updateCondition(condition.id, {
                                    fieldKey: event.target.value,
                                    operator: getOperatorsForFieldType(getFieldDefinition(event.target.value).type)[0].value as any,
                                    value: '',
                                  })
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                              >
                                {WORKFLOW_FILTER_FIELDS.map((field) => (
                                  <option key={field.key} value={field.key}>
                                    {field.label}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={condition.operator}
                                onChange={(event) => updateCondition(condition.id, { operator: event.target.value as any, value: '' })}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                              >
                                {operators.map((operator) => (
                                  <option key={operator.value} value={operator.value}>
                                    {operator.label}
                                  </option>
                                ))}
                              </select>

                              {!['is_true', 'is_false'].includes(condition.operator) && renderValueInput(condition.fieldKey, condition.value, (value) => updateCondition(condition.id, { value }))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">THEN Actions</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Actions execute sequentially once a lead is enrolled.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addAction}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Action
                  </button>
                </div>

                <div className="space-y-4">
                  {formState.actions.map((action, index) => (
                    <div key={action.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800">Action {index + 1}</div>
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3">
                        <select
                          value={action.actionType}
                          onChange={(event) => {
                            const actionType = event.target.value as WorkflowActionDraft['actionType'];
                            const nextPayload =
                              actionType === 'update_field'
                                ? { fieldKey: 'status_id', value: '' }
                                : actionType === 'create_followup'
                                  ? { offsetDays: 0, time: '09:00', remarks: '', assignToType: 'current_owner', userId: '' }
                                  : { templateId: '' };
                            updateAction(action.id, { actionType, payload: nextPayload });
                          }}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                        >
                          <option value="update_field">Update Lead Field</option>
                          <option value="create_followup">Create Follow-up</option>
                          <option value="send_email">Queue Email</option>
                        </select>

                        {action.actionType === 'update_field' && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <select
                              value={String(action.payload.fieldKey || 'status_id')}
                              onChange={(event) => updateAction(action.id, {
                                payload: { ...action.payload, fieldKey: event.target.value, value: '' },
                              })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                            >
                              {UPDATEABLE_LEAD_FIELDS.map((field) => (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                </option>
                              ))}
                            </select>
                            {renderUpdateValueInput(action)}
                          </div>
                        )}

                        {action.actionType === 'create_followup' && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                                Offset Days
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={String(action.payload.offsetDays ?? 0)}
                                onChange={(event) => updateActionPayload(action.id, 'offsetDays', Number(event.target.value))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                                Follow-up Time
                              </label>
                              <input
                                type="time"
                                value={String(action.payload.time || '09:00')}
                                onChange={(event) => updateActionPayload(action.id, 'time', event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                                Assign To
                              </label>
                              <select
                                value={String(action.payload.assignToType || 'current_owner')}
                                onChange={(event) => updateActionPayload(action.id, 'assignToType', event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                              >
                                <option value="current_owner">Current lead owner</option>
                                <option value="specific_user">Specific user</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                                Specific User
                              </label>
                              <select
                                value={String(action.payload.userId || '')}
                                disabled={String(action.payload.assignToType || 'current_owner') !== 'specific_user'}
                                onChange={(event) => updateActionPayload(action.id, 'userId', event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-slate-100"
                              >
                                <option value="">Select user</option>
                                {profiles.map((profile) => (
                                  <option key={profile.id} value={profile.id}>
                                    {profile.full_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                                Remarks
                              </label>
                              <textarea
                                rows={3}
                                value={String(action.payload.remarks || '')}
                                onChange={(event) => updateActionPayload(action.id, 'remarks', event.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                                placeholder="Add context for the assigned user"
                              />
                            </div>
                          </div>
                        )}

                        {action.actionType === 'send_email' && (
                          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                            <select
                              value={String(action.payload.templateId || '')}
                              onChange={(event) => updateActionPayload(action.id, 'templateId', event.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                            >
                              <option value="">Select email template</option>
                              {templates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.template_name}
                                </option>
                              ))}
                            </select>
                            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                              <Mail className="h-4 w-4" />
                              Queued via email queue
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="text-sm text-slate-500">
                Workflows are processed by the backend workflow processor and can enroll matching leads after the start time.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveWorkflow()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {editingWorkflowId ? 'Save Changes' : 'Create Workflow'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
