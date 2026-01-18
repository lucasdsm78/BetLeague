export interface ApiUserProfile {
  id: number;
  email: string;
  pseudo: string;
  nb_win: number;
  nb_lose: number;
  nb_btl: number;
  is_tournament_subscriber?: boolean;
  is_two_factor_enabled?: boolean;
}

