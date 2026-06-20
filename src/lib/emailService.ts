import { supabase } from './supabase';

interface QueueEmailParams {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  cc?: string[];
  bcc?: string[];
  priority?: number;
  organizationId?: string;
}

export const emailService = {
  async queueEmail(params: QueueEmailParams) {
    try {
      const { error } = await (supabase.from('email_queue') as any).insert({
        to_email: params.to,
        cc_emails: params.cc || [],
        bcc_emails: params.bcc || [],
        subject: params.subject,
        body_html: params.bodyHtml,
        body_text: params.bodyText || params.bodyHtml.replace(/<[^>]*>/g, ''),
        template_id: params.templateId,
        template_data: params.templateData || {},
        priority: params.priority || 5,
        organization_id: params.organizationId,
        status: 'pending',
        scheduled_at: new Date().toISOString(),
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error queueing email:', error);
      return { success: false, error };
    }
  },

  async sendInvitation(
    email: string,
    inviteLink: string,
    organizationName: string,
    roleName: string,
    inviterName: string
  ) {
    const { data: template } = await (supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', 'invitation_sent')
      .single() as any);

    if (!template) {
      console.error('Invitation email template not found');
      return { success: false };
    }

    const bodyHtml = template.body_html
      .replace(/{{organization_name}}/g, organizationName)
      .replace(/{{role_name}}/g, roleName)
      .replace(/{{invite_link}}/g, inviteLink)
      .replace(/{{inviter_name}}/g, inviterName);

    const bodyText = template.body_text
      ?.replace(/{{organization_name}}/g, organizationName)
      .replace(/{{role_name}}/g, roleName)
      .replace(/{{invite_link}}/g, inviteLink)
      .replace(/{{inviter_name}}/g, inviterName);

    return this.queueEmail({
      to: email,
      subject: template.subject.replace(/{{organization_name}}/g, organizationName),
      bodyHtml,
      bodyText,
      templateId: template.id,
      templateData: { organization_name: organizationName, role_name: roleName, invite_link: inviteLink, inviter_name: inviterName },
      priority: 8,
    });
  },

  async sendWelcomeEmail(email: string, organizationName: string, userName: string) {
    const { data: template } = await (supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', 'welcome_email')
      .single() as any);

    if (!template) return { success: false };

    const bodyHtml = template.body_html
      .replace(/{{organization_name}}/g, organizationName)
      .replace(/{{user_name}}/g, userName);

    const bodyText = template.body_text
      ?.replace(/{{organization_name}}/g, organizationName)
      .replace(/{{user_name}}/g, userName);

    return this.queueEmail({
      to: email,
      subject: template.subject.replace(/{{organization_name}}/g, organizationName),
      bodyHtml,
      bodyText,
      templateId: template.id,
      templateData: { organization_name: organizationName, user_name: userName },
      priority: 6,
    });
  },

  async sendAccountDisabledEmail(email: string, organizationName: string) {
    const { data: template } = await (supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', 'account_disabled')
      .single() as any);

    if (!template) return { success: false };

    const bodyHtml = template.body_html.replace(/{{organization_name}}/g, organizationName);
    const bodyText = template.body_text?.replace(/{{organization_name}}/g, organizationName);

    return this.queueEmail({
      to: email,
      subject: template.subject,
      bodyHtml,
      bodyText,
      templateId: template.id,
      templateData: { organization_name: organizationName },
      priority: 9,
    });
  },

  async sendInviteAcceptedEmail(adminEmail: string, userName: string, organizationName: string) {
    const { data: template } = await (supabase
      .from('email_templates')
      .select('*')
      .eq('template_key', 'invite_accepted')
      .single() as any);

    if (!template) return { success: false };

    const bodyHtml = template.body_html
      .replace(/{{user_name}}/g, userName)
      .replace(/{{organization_name}}/g, organizationName);

    const bodyText = template.body_text
      ?.replace(/{{user_name}}/g, userName)
      .replace(/{{organization_name}}/g, organizationName);

    return this.queueEmail({
      to: adminEmail,
      subject: template.subject.replace(/{{user_name}}/g, userName),
      bodyHtml,
      bodyText,
      templateId: template.id,
      templateData: { user_name: userName, organization_name: organizationName },
      priority: 6,
    });
  },
};
