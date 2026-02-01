// DTOs API: packs / purchases

export interface ApiPack {
  id: number;
  name: string;
  price_cents: number;
  nb_btl: number;
  bonus: number;
  total_btl: number;
  price_per_100: number;
  note?: string;
  created_at?: number;
}

export interface ApiPacksListResponse {
  packs: ApiPack[];
}

export interface ApiPurchaseCreateResponse {
  session_id?: string;
  client_secret?: string;
  url?: string;
}

