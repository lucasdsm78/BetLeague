// services/api/invitations.ts
// API module: invitations (aligned with tickets.ts pattern)

import http, { type ApiResponse } from '../http';
import type {
  ApiInvitationActionResponse,
  ApiLeagueInvitationsSentResponse,
  ApiInvitationsReceivedResponse,
  ApiInvitationsSentResponse,
  ApiLeagueInvitationSentItem,
  ApiInvitationReceivedItem,
  ApiInvitationSentItem,
} from '../../types/api/invitations';
import type {
  InvitationsReceivedResponse,
  InvitationsSentResponse,
  InvitationReceivedReadModel,
  InvitationSentReadModel,
  LeagueSentInvitationsResponse,
} from '../../types/entities/invitation';
import { tryMapApiInvitationToUi } from '../mappers/invitationMapper';

export type InvitationActionResponse = ApiInvitationActionResponse;

export type InvitationStatusParam = 'PENDING' | 'ACCEPTED' | 'REFUSED';

export type InvitationsListParams = {
  page?: number;
  pageSize?: number;
  status?: InvitationStatusParam | null;
};

export type InvitationCounts = {
  pending: number;
  accepted: number;
  refused: number;
};

export type InvitationCountsParams = {
  isReceived?: boolean;
};

function buildInvitationsQuery(params?: InvitationsListParams): string {
  const q = new URLSearchParams();
  q.set('is_received', 'true');
  if (!params) return q.toString();
  if (typeof params.page === 'number') q.set('page', String(params.page));
  if (typeof params.pageSize === 'number') q.set('page_size', String(params.pageSize));
  if (typeof params.status === 'string') q.set('status', params.status);
  return q.toString();
}

function normalizeReceived(
  data: ApiInvitationsReceivedResponse | { invitations?: ApiInvitationReceivedItem[] } | ApiInvitationReceivedItem[] | unknown,
): InvitationsReceivedResponse {
  const invitationsPayload = (data as any)?.invitations ?? (data as any)?.invitation ?? data;
  const invitations = Array.isArray(invitationsPayload) ? (invitationsPayload as ApiInvitationReceivedItem[]) : [];

  const mapped: InvitationReceivedReadModel[] = [];
  for (const inv of invitations) {
    const ui = tryMapApiInvitationToUi(inv);
    if (ui) mapped.push(ui);
  }

  const total = typeof (data as any)?.total === 'number' ? (data as any).total : undefined;
  const page = typeof (data as any)?.page === 'number' ? (data as any).page : undefined;
  const page_size = typeof (data as any)?.page_size === 'number' ? (data as any).page_size : undefined;

  return { invitations: mapped, total, page, page_size };
}

function normalizeSentLeagueInvitations(
  data: ApiLeagueInvitationsSentResponse | unknown,
): LeagueSentInvitationsResponse {
  const invitationsPayload = (data as any)?.invitations;
  const invitations = Array.isArray(invitationsPayload) ? (invitationsPayload as ApiLeagueInvitationSentItem[]) : [];

  return {
    league_id: typeof (data as any)?.league_id === 'number' ? (data as any).league_id : 0,
    invitations: invitations
      .filter((inv) => inv && typeof inv.id === 'number' && inv.user && typeof inv.user.id === 'number')
      .map((inv) => ({
        id: inv.id,
        status: String(inv.status ?? ''),
        created_at: Number(inv.created_at ?? 0),
        user: {
          id: Number(inv.user.id),
          pseudo: String(inv.user.pseudo ?? ''),
          email: String(inv.user.email ?? ''),
        },
      })),
  };
}

function normalizeSent(
  data: ApiInvitationsSentResponse | { invitations?: ApiInvitationSentItem[] } | ApiInvitationSentItem[] | unknown,
): InvitationsSentResponse {
  const invitationsPayload = (data as any)?.invitations ?? (data as any)?.invitation ?? data;
  const invitations = Array.isArray(invitationsPayload) ? (invitationsPayload as ApiInvitationSentItem[]) : [];

  const mapped: InvitationSentReadModel[] = invitations
    .filter((inv) => inv && typeof inv.id === 'number' && inv.user && typeof inv.user.id === 'number')
    .map((inv) => ({
      id: inv.id,
      type: inv.type,
      league: inv.league,
      tournament: inv.tournament,
      status: String(inv.status ?? ''),
      created_at: Number(inv.created_at ?? 0),
      user: {
        id: Number(inv.user.id),
        pseudo: String(inv.user.pseudo ?? ''),
        email: String(inv.user.email ?? ''),
      },
    }));

  const total = typeof (data as any)?.total === 'number' ? (data as any).total : undefined;
  const page = typeof (data as any)?.page === 'number' ? (data as any).page : undefined;
  const page_size = typeof (data as any)?.page_size === 'number' ? (data as any).page_size : undefined;

  return { invitations: mapped, total, page, page_size };
}

export async function getReceivedInvitations(
  params?: InvitationsListParams,
): Promise<InvitationsReceivedResponse> {
  const query = buildInvitationsQuery(params);
  const url = `/invitations?${query}`;

  const res: ApiResponse<unknown> = await http.get(url, {
    skipCache: true,
    cache: 'no-store',
  });
  return normalizeReceived(res.data);
}

export async function getSentLeagueInvitations(leagueId: number): Promise<LeagueSentInvitationsResponse> {
  if (!Number.isInteger(leagueId) || leagueId <= 0) throw new Error('ID de ligue invalide');

  const res: ApiResponse<unknown> = await http.get(`/league/${leagueId}/invitations`, {
    skipCache: true,
    cache: 'no-store',
  });
  return normalizeSentLeagueInvitations(res.data);
}

export async function getSentInvitations(
  params?: InvitationsListParams,
): Promise<InvitationsSentResponse> {
  const q = new URLSearchParams();
  if (params && typeof params.page === 'number') q.set('page', String(params.page));
  if (params && typeof params.pageSize === 'number') q.set('page_size', String(params.pageSize));
  if (typeof params?.status === 'string') q.set('status', params.status);
  const query = q.toString();
  const url = query ? `/invitations/sent?${query}` : '/invitations/sent';

  const res: ApiResponse<unknown> = await http.get(url, {
    skipCache: true,
    cache: 'no-store',
  });
  return normalizeSent(res.data);
}

export async function getInvitationCounts(params?: InvitationCountsParams): Promise<InvitationCounts> {
  const isReceived = params?.isReceived ?? true;
  const res: ApiResponse<InvitationCounts> = await http.get(`/invitations/counts?is_received=${isReceived ? 'true' : 'false'}`);
  return res.data ?? { pending: 0, accepted: 0, refused: 0 };
}

export async function updateInvitation(invitationId: number, accept: boolean): Promise<InvitationActionResponse> {
  if (!Number.isInteger(invitationId) || invitationId <= 0) throw new Error("ID d'invitation invalide");
  const endpoint = `/league/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`;
  const res: ApiResponse<InvitationActionResponse> = await http.put(endpoint);
  return (res.data ?? { message: '', success: true }) as InvitationActionResponse;
}

export async function updateTournamentInvitation(invitationId: number, accept: boolean): Promise<InvitationActionResponse> {
  if (!Number.isInteger(invitationId) || invitationId <= 0) throw new Error("ID d'invitation invalide");
  const endpoint = `/tournament/invitation/${accept ? 'true' : 'false'}?invitation_id=${invitationId}`;
  const res: ApiResponse<InvitationActionResponse> = await http.put(endpoint);
  return (res.data ?? { message: '', success: true }) as InvitationActionResponse;
}

export async function deleteLeagueInvitation(invitationId: number): Promise<InvitationActionResponse> {
  if (!Number.isInteger(invitationId) || invitationId <= 0) throw new Error("ID d'invitation invalide");
  const res: ApiResponse<InvitationActionResponse> = await http.delete(`/league/invitation/${invitationId}`);
  return (res.data ?? { message: '', success: true }) as InvitationActionResponse;
}
