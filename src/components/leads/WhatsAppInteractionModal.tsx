// @ts-nocheck
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logWhatsAppSent } from '../../services/activityLogger';
import { openWhatsApp } from '../../lib/communicationUtils';
import { TemplateSelectionModal } from '../common/TemplateSelectionModal';

interface WhatsAppInteractionModalProps {
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadData: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function WhatsAppInteractionModal({
  leadId,
  leadName,
  leadPhone,
  leadData,
  onClose,
  onSuccess,
}: WhatsAppInteractionModalProps) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleTemplateConfirm(
    template: any,
    personalizedContent: { body: string }
  ) {
    if (!user) return;

    setLoading(true);

    const success = openWhatsApp(leadPhone, personalizedContent.body);

    if (success) {
      const { data: lead } = await supabase
        .from('leads')
        .select('organization_id')
        .eq('id', leadId)
        .single();

      await supabase.from('lead_interactions').insert({
        lead_id: leadId,
        user_id: user.id,
        interaction_type: 'whatsapp',
        interaction_notes: null,
        interaction_metadata: {
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

      await logWhatsAppSent(
        leadId,
        user.id,
        profile?.full_name || 'Unknown User',
        personalizedContent.body
      );

      await supabase.from('message_template_usage_log').insert({
        template_id: template.id,
        lead_id: leadId,
        user_id: user.id,
        template_content_used: template.body_content,
        actual_content_sent: personalizedContent.body,
        was_edited: false,
      });

      setLoading(false);
      onSuccess();
      onClose();
    } else {
      setLoading(false);
      showError('Failed to open WhatsApp. Please check the phone number and try again.');
    }
  }

  return (
    <TemplateSelectionModal
      type="whatsapp"
      leadData={leadData}
      onClose={onClose}
      onConfirm={handleTemplateConfirm}
      title={`Send WhatsApp Message - ${leadName}`}
      confirmButtonText="Open WhatsApp"
    />
  );
}
