// DTOs API: invitations

export interface ApiInvitationActionResponse {
  message: string;
  success: boolean;
  error?: string;
}

// Read model tel que renvoyé par l'API
export interface ApiInvitationReceivedItem {
  id: number;
  type: 'league' | 'tournament';
  league?: ApiInvitationLeagueSummary;
  tournament?: ApiInvitationTournamentSummary;
  status: string;
}

export interface ApiInvitationLeagueSummary {
  id: number;
  name: string;
  max_players: number;
  start_date?: string | number;
  user_creator?: { id: number; pseudo: string };
  nb_players_remaining?: number;
  is_started?: boolean;
}

export interface ApiInvitationTournamentSummary {
  id: number;
  name: string;
  max_players: number;
  current_players: number;
  start_date?: string | number;
  end_date?: string | number;
  is_private?: boolean;
  status?: string;
  user_creator?: { id: number; pseudo: string };
}

export interface ApiLeagueInvitationSentUser {
  id: number;
  pseudo: string;
  email: string;
}

export interface ApiLeagueInvitationSentItem {
  id: number;
  status: string;
  created_at: number;
  user: ApiLeagueInvitationSentUser;
}

// --- Réponses API ---

export interface ApiInvitationsReceivedResponse {
  invitations: ApiInvitationReceivedItem[];
  total?: number;
  page?: number;
  page_size?: number;
}

export interface ApiLeagueInvitationsSentResponse {
  league_id: number;
  invitations: ApiLeagueInvitationSentItem[];
}
