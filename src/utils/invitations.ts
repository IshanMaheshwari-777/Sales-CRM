export function buildInvitationLink(invitationToken: string) {
  return `https://sales-crm-lilac.vercel.app/?token=${encodeURIComponent(invitationToken)}`;
}
