/**
 * Modèles d'entités TypeScript pour BetLeague
 * Architecture sécurisée et optimisée pour React
 */

export interface User {
  readonly id?: string; // UUID from API
  readonly email: string;
  readonly pseudo: string;
  readonly username: string;
  readonly avatar?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly isActive?: boolean;
  readonly btlBalance?: number;
  readonly twoFactorEnabled?: boolean;
  readonly isTournamentSubscriber?: boolean;
}

export interface UserProfile extends User {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly preferences?: UserPreferences;
  readonly statistics?: UserStatistics;
}

export interface UserPreferences {
  readonly theme: 'light' | 'dark' | 'auto';
  readonly language: 'fr' | 'en';
  readonly notifications: NotificationSettings;
  readonly privacy: PrivacySettings;
}

export interface NotificationSettings {
  readonly emailNotifications: boolean;
  readonly pushNotifications: boolean;
  readonly leagueInvites: boolean;
  readonly matchResults: boolean;
  readonly weeklyDigest: boolean;
}

export interface PrivacySettings {
  readonly profileVisible: boolean;
  readonly statsVisible: boolean;
  readonly allowFriendRequests: boolean;
}

export interface UserStatistics {
  readonly totalBets: number;
  readonly successfulBets: number;
  readonly totalWinnings: number;
  readonly favoriteLeague?: string;
  readonly winRate: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
}

export interface League {
  readonly id: number;
  readonly name: string;
  readonly maxPlayers: number;
  readonly currentPlayers: number;
  readonly isPrivate: boolean;
  readonly isFree: boolean;
  readonly nbBtl?: number;
  readonly createdBy: number;
  readonly status: LeagueStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

export type LeagueStatus =
  | 'draft'
  | 'open'
  | 'full'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface LeagueDetails extends League {
  readonly description?: string;
  readonly rules?: LeagueRules;
  readonly prizes?: LeaguePrizes;
  readonly participants: LeagueParticipant[];
  readonly matches: Match[];
  readonly leaderboard: LeaderboardEntry[];
}

export interface LeagueSummary {
  readonly id: number;
  readonly name: string;
  readonly startDate: string;
  readonly isStarted?: boolean;
  readonly playersRemaining?: number;
  readonly isFree?: boolean;
  readonly nbBtl?: number;
}

export interface LeagueRules {
  readonly maxBetsPerMatch: number;
  readonly minBetAmount: number;
  readonly maxBetAmount: number;
  readonly allowLiveBetting: boolean;
  readonly penaltyForMissedBets: number;
}

export interface LeaguePrizes {
  readonly firstPlace: number;
  readonly secondPlace?: number;
  readonly thirdPlace?: number;
  readonly totalPool: number;
}

export interface LeagueParticipant {
  readonly userId: number;
  readonly user: Pick<User, 'pseudo' | 'avatar'>;
  readonly joinedAt: string;
  readonly isActive: boolean;
  readonly currentScore: number;
  readonly position?: number;
}

export interface LeaderboardEntry {
  readonly position: number;
  readonly userId: number;
  readonly user: Pick<User, 'pseudo' | 'avatar'>;
  readonly score: number;
  readonly betsPlaced: number;
  readonly correctBets: number;
  readonly winRate: number;
  readonly trend: 'up' | 'down' | 'stable';
}


export interface Match {
  readonly id: number;
  readonly homeTeam: Team;
  readonly awayTeam: Team;
  readonly competition: Competition;
  readonly scheduledAt: string;
  readonly status: MatchStatus;
  readonly result?: MatchResult;
  readonly odds: MatchOdds;
  readonly statistics?: MatchStatistics;
}

export type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'half-time'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export interface Team {
  readonly id: number;
  readonly name: string;
  readonly shortName: string;
  readonly logo?: string;
  readonly country: string;
}

export interface Competition {
  readonly id: number;
  readonly name: string;
  readonly shortName: string;
  readonly country: string;
  readonly level: number;
  readonly logo?: string;
}

export interface MatchResult {
  readonly homeScore: number;
  readonly awayScore: number;
  readonly halfTimeScore?: {
    readonly home: number;
    readonly away: number;
  };
  readonly winner?: 'home' | 'away' | 'draw';
  readonly finishedAt: string;
}

export interface MatchOdds {
  readonly homeWin: number;
  readonly draw: number;
  readonly awayWin: number;
  readonly updatedAt: string;
}

export interface MatchStatistics {
  readonly possession: {
    readonly home: number;
    readonly away: number;
  };
  readonly shots: {
    readonly home: number;
    readonly away: number;
  };
  readonly corners: {
    readonly home: number;
    readonly away: number;
  };
  readonly yellowCards: {
    readonly home: number;
    readonly away: number;
  };
  readonly redCards: {
    readonly home: number;
    readonly away: number;
  };
}


export interface Bet {
  readonly id: number;
  readonly userId: number;
  readonly matchId: number;
  readonly leagueId: number;
  readonly prediction: BetPrediction;
  readonly amount: number;
  readonly odds: number;
  readonly status: BetStatus;
  readonly placedAt: string;
  readonly settledAt?: string;
  readonly potentialWin: number;
  readonly actualWin?: number;
}

export type BetPrediction = 'home' | 'draw' | 'away';

export type BetStatus =
  | 'pending'
  | 'won'
  | 'lost'
  | 'void'
  | 'cancelled';

export interface BetDetails extends Bet {
  readonly match: Pick<Match, 'homeTeam' | 'awayTeam' | 'scheduledAt' | 'status' | 'result'>;
  readonly league: Pick<League, 'name'>;
}


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

export type NotificationType =
  | 'league_invitation'
  | 'match_result'
  | 'bet_won'
  | 'bet_lost'
  | 'league_started'
  | 'league_ended'
  | 'system_announcement'
  | 'account_update';

/**
 * ⚠️ Compat (à migrer)
 *
 * Historiquement, certains types API ont été exportés depuis `types/entities.ts`.
 * On les conserve temporairement en alias vers `types/api/*` pour migration progressive.
 */
import type {
  ApiResponse as _ApiResponse,
  ApiError as _ApiError,
  ApiPaginatedResponse as _ApiPaginatedResponse,
} from './api/common';
import type {
  ApiLoginResponse as _ApiLoginResponse,
  ApiRegisterResponse as _ApiRegisterResponse,
} from './api/auth';

export type ApiResponse<T = unknown> = _ApiResponse<T>;
export type ApiError = _ApiError;
export type PaginatedResponse<T = unknown> = _ApiPaginatedResponse<T>;

export type LoginResponse = _ApiLoginResponse;
export type RegisterResponse = _ApiRegisterResponse;

// Toast UI types (utilisés par `useToast` et `ToastContainer`)
export interface Toast {
  readonly id: string;
  readonly type: 'success' | 'error' | 'warning' | 'info';
  readonly title: string;
  readonly message?: string;
  readonly duration?: number;
  readonly actions?: readonly ToastAction[];
}

export interface ToastAction {
  readonly label: string;
  readonly action: () => void;
  readonly variant?: 'primary' | 'secondary';
}

