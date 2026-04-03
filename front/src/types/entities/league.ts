// Entités UI - League

import type { Match } from './match';
import type { Bet } from './bet';
import type { User } from './user';

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
  readonly status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
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

// Lien League -> Bet
export type LeagueBet = Bet;
