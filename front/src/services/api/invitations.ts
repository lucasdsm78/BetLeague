// services/api/invitations.ts
// API module: invitations

import http, { type ApiResponse } from '../http';
import type { ApiInvitationReceived } from '../../types/api/leagues';

// DTO local : peut être déplacé dans types/api/leagues.ts ou types/api/invitations.ts plus tard
export interface InvitationActionResponse {
  message: string;
  success: boolean;
  error?: string;
}

export async function getReceivedInvitations(): Promise<ApiInvitationReceived[]> {
  const res: ApiResponse<ApiInvitationReceived[]> = await http.get('/invitations?is_received=true');
  if (!res.success) throw new Error(res.error || 'Erreur lors du chargement des invitations');

  const data = res.data;
  if (!data) return [];
  if (!Array.isArray(data)) throw new Error('Format de réponse invalide');
  return data;
}

export async function updateInvitation(invitationId: number, accept: boolean): Promise<InvitationActionResponse> {
  if (!Number.isInteger(invitationId) || invitationId <= 0) throw new Error("ID d'invitation invalide");
  const endpoint = `/league/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`;
  const res: ApiResponse<InvitationActionResponse> = await http.put(endpoint);
  if (!res.success) throw new Error(res.error || "Erreur lors de la mise à jour de l'invitation");
  return (res.data ?? { message: '', success: true }) as InvitationActionResponse;
}
