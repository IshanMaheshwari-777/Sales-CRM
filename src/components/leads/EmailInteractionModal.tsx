// @ts-nocheck
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logEmailSent } from '../../services/activityLogger';
import { openEmailClient } from '../../lib/communicationUtils';
import { TemplateSelectionModal } from '../common/TemplateSelectionModal';

interface EmailInteractionModalProps {
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadData: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function EmailInteractionModal({
  leadId,
  leadName,
  leadEmail,
  leadData,
  onClose,
  onSuccess,
}: EmailInteractionModalProps) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleTemplateConfirm(
    template: any,
    personalizedContent: { subject?: string; body: string }
  ) {
    if (!user) return;

    setLoading(true);

    const success = openEmailClient(
      leadEmail,
      personalizedContent.subject || '',
      personalizedContent.body
    );

    if (success) {
      const { data: lead } = await supabase
        .from('leads')
        .select('organization_id')
        .eq('id', leadId)
        .single();

      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        user_id: user.id,
        interaction_type: 'email',
        interaction_notes: null,
        interaction_metadata: {
          subject: personalizedContent.subject,
          message: personalizedContent.body,
          template_id: template.id,
          template_name: template.template_name,
        },
      });

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      await logEmailSent(
        leadId,
        user.id,
        profile?.full_name || 'Unknown User',
        personalizedContent.subject || '',
        personalizedContent.body
      );

      await supabase.from('message_template_usage_log').insert({
        template_id: template.id,
        lead_id: leadId,
        user_id: user.id,
        template_content_used: `${template.subject || ''}\n\n${template.body_content}`,
        actual_content_sent: `${personalizedContent.subject || ''}\n\n${personalizedContent.body}`,
        was_edited: false,
      });

      setLoading(false);
      onSuccess();
      onClose();
    } else {
      setLoading(false);
      showError('Failed to open email client. Please check the email address and try again.');
    }
  }

  return (
    <TemplateSelectionModal
      type="email"
      leadData={leadData}
      onClose={onClose}
      onConfirm={handleTemplateConfirm}
      title={`Send Email - ${leadName}`}
      confirmButtonText="Open Email Client"
    />
  );
}
