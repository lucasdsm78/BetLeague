/**
 * Types UI - State (stores)
 */

import type { League, LeagueDetails, Invitation, Match, Bet, BetDetails, Notification, Toast, User } from './entities';

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

