// DTOs API: invitations

export interface ApiInvitationActionResponse {
  message: string;
  success: boolean;
  error?: string;
}

// Read model tel que renvoyé par l'API
export interface ApiInvitationReceivedItem {
  id: number;
  league: ApiInvitationLeagueSummary;
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

// --- Réponses API ---

export interface ApiInvitationsReceivedResponse {
  invitations: ApiInvitationReceivedItem[];
  total?: number;
  page?: number;
  page_size?: number;
}

