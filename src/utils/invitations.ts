export function buildInvitationLink(invitationToken: string) {
  return `${window.location.origin}?token=${encodeURIComponent(invitationToken)}`;
}
