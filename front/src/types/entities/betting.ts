// UI entities for betting in MatchesSection

export type BetType = 'home' | 'draw' | 'away';

export interface BetSelection {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;

  /**
   * Legacy 1X2 selection (compat).
   * Si défini, marketKey/marketValue peuvent être omis.
   */
  betType?: BetType;

  /**
   * Nouveau modèle: marché (ex: MATCH_WINNER, OVER_UNDER) + valeur (ex: Home, Over 2.5).
   * Utilisé pour afficher et créer des tickets multi-marchés.
   */
  marketKey?: string;
  marketLabel?: string;
  marketValue?: string;

  /** Identifiant de la cote (match_odds.id) utilisé côté API */
  matchOddId?: number;

  odd: number;
}
