export type ApiPurchaseStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface ApiUserPurchase {
  id: number;
  uuid: string;
  status: ApiPurchaseStatus;
  created_at?: number;
  pack_id: number;
  pack_name: string;
  pack_price_cents: number;
  pack_total_btl: number;
}

export interface ApiUserPurchasesResponse {
  purchases: ApiUserPurchase[];
}

