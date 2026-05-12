// DTO API - Notification

export interface NotificationDto {
  readonly id: number;
  readonly user_id: number;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
  readonly created_at: number;
  readonly read_at: number | null;
}

// Entité UI - Notification

export interface Notification {
  readonly id: number;
  readonly userId: number;
  readonly type: NotificationType;
  readonly title: string;
  readonly message: string;
  readonly data?: Record<string, unknown>;
  readonly isRead: boolean;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

/**
 * Types de notifications - alignes avec le backend
 * @see back/domain/notification/model/notification.py
 */
export type NotificationType =
  // Invitations de ligue
  | 'league_invitation'
  | 'league_invitation_accepted'
  | 'league_invitation_refused'
  // Resultats de paris
  | 'bet_won'
  | 'bet_lost'
  // Evenements de match
  | 'match_result'
  // Evenements de ligue
  | 'league_started'
  | 'league_minimum_players_reached'
  | 'league_ended'
  | 'league_overtaken'
  // Systeme
  | 'system_announcement'
  | 'account_update'
  // Tickets/Paris
  | 'ticket_created'
  // Generique (fallback)
  | 'generic';
