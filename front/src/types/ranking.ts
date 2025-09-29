// Types pour le classement des ligues
export interface RankingEntry {
  position: number;
  pseudo: string;
  nb_btl: number;
  nb_win: number;
  nb_lose: number;
}

export interface RankingData {
  entries: RankingEntry[];
  totalPlayers: number;
  leagueId: number;
  lastUpdated: string; // ISO string
}

