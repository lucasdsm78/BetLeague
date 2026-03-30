// Entités UI - Invitation

import type { League } from './league';
import type { User } from './user';

export interface Invitation {
  readonly id: number;
  readonly leagueId: number;
  readonly league: Pick<League, 'name' | 'isPrivate' | 'nbBtl'>;
  readonly senderId: number;
  readonly sender: Pick<User, 'pseudo'>;
  readonly receiverId: number;
  readonly receiver: Pick<User, 'pseudo'>;
  readonly status: InvitationStatus;
  readonly message?: string;
  readonly sentAt: string;
  readonly respondedAt?: string;
  readonly expiresAt: string;
}

export type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

// --- Received invitation (UI entity, mapped from API) ---

export type InvitationResourceType = 'league' | 'tournament';

export interface InvitationLeagueSummary {
  id: number;
  name: string;
  max_players: number;
  start_date?: string | number;
  user_creator?: { id: number; pseudo: string };
  nb_players_remaining?: number;
  is_started?: boolean;
}

export interface InvitationTournamentSummary {
  id: number;
  name: string;
  max_players: number;
  current_players: number;
  start_date?: string | number;
  end_date?: string | number;
  user_creator?: { id: number; pseudo: string };
  is_private?: boolean;
  status?: string;
}

export interface InvitationReceivedReadModel {
  id: number;
  type: InvitationResourceType;
  league?: InvitationLeagueSummary;
  tournament?: InvitationTournamentSummary;
  status: string;
}

export interface InvitationsReceivedResponse {
  invitations: InvitationReceivedReadModel[];
  total?: number;
  page?: number;
  page_size?: number;
}

export interface LeagueSentInvitationUser {
  id: number;
  pseudo: string;
  email: string;
}

export interface LeagueSentInvitation {
  id: number;
  status: string;
  created_at: number;
  user: LeagueSentInvitationUser;
}

export interface LeagueSentInvitationsResponse {
  league_id: number;
  invitations: LeagueSentInvitation[];
}
