/**
 * Modèles d'entités TypeScript pour BetLeague
 * Architecture sécurisée et optimisée pour React
 */

// ============= User Entity =============
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
  // Indique si la double authentification est activée pour l'utilisateur
  readonly twoFactorEnabled?: boolean;
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

// ============= League Entity =============
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

// Ajout: résumé léger des ligues renvoyé par /api/leagues
export interface LeagueSummary {
  readonly id: number;
  readonly name: string;
  readonly startDate: string; // ISO string
  readonly isStarted?: boolean;
  readonly playersRemaining?: number; // nb_players_remaining
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

// ============= Match Entity =============
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

// ============= Bet Entity =============
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

// ============= Invitation Entity =============
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

// ============= Notification Entity =============
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

// ============= API Response Types =============
export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly error?: string;
  readonly errors?: Record<string, string[]>;
}

export interface LoginResponseData {
  readonly token_auth: string;
  readonly uuid: string;
  readonly token_expiration?: string;
  readonly two_factor_enabled?: boolean; // ajouté
}

export interface RegisterResponseData {
  readonly token_auth: string;
  readonly uuid: string;
  readonly token_expiration?: string;
  readonly two_factor_enabled?: boolean; // ajouté (cas futur d'activation automatique)
}

export type LoginResponse = ApiResponse<LoginResponseData>;
export type RegisterResponse = ApiResponse<RegisterResponseData>;

export interface PaginatedResponse<T = unknown> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface ApiError {
  readonly message: string;
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
}

export interface TwoFactorSetupResponse {
  readonly otpauth_url?: string;
  readonly secret?: string;
  readonly qr_code?: string; // data URL d'une image QR éventuelle
  readonly recovery_codes?: readonly string[];
}

// ============= Form Types =============
export interface LoginForm {
  readonly email: string;
  readonly password: string;
  readonly code?: string;
  readonly rememberMe?: boolean;
}

export interface RegisterForm {
  readonly pseudo: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly acceptTerms: boolean;
}

export interface LeagueCreateForm {
  readonly name: string;
  readonly maxMembers: number;
  readonly type: 'public' | 'private';
  readonly entryFee: number;
  readonly description?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

// ============= UI State Types =============
export interface PaginationState {
  readonly currentPage: number;
  readonly pageSize: number;
  readonly totalItems: number;
}

export interface FilterState {
  readonly search: string;
  readonly status?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly sortBy: string;
  readonly sortOrder: 'asc' | 'desc';
}

// ============= Store Types =============
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  twoFactorChallenge?: { email: string; password: string } | null;
}

export interface LeaguesState {
  readonly leagues: readonly League[];
  readonly currentLeague: LeagueDetails | null;
  readonly invitations: readonly Invitation[];
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface MatchesState {
  readonly matches: readonly Match[];
  readonly selectedMatch: Match | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly filters: FilterState;
}

export interface BetsState {
  readonly bets: readonly Bet[];
  readonly currentBet: BetDetails | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface NotificationsState {
  readonly notifications: readonly Notification[];
  readonly unreadCount: number;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface UIState {
  readonly theme: 'light' | 'dark' | 'auto';
  readonly sidebarOpen: boolean;
  readonly modals: Record<string, boolean>;
  readonly toasts: readonly Toast[];
}

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

// ============= Validation Types =============
export interface ValidationRule<T = unknown> {
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: RegExp;
  readonly custom?: (value: T, allValues?: any) => string | null;
}

export type ValidationSchema<T = Record<string, unknown>> = {
  readonly [K in keyof T]?: ValidationRule<T[K]>;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: Record<string, string>;
}

// ============= Security Types =============
export interface SecurityConfig {
  readonly maxLoginAttempts: number;
  readonly lockoutDuration: number;
  readonly sessionTimeout: number;
  readonly csrfTokenRequired: boolean;
  readonly rateLimitRequests: number;
  readonly rateLimitWindow: number;
}

export interface SecurityContext {
  readonly permissions: readonly string[];
  readonly roles: readonly string[];
  readonly sessionId: string;
  readonly lastActivity: string;
  readonly deviceFingerprint?: string;
}
