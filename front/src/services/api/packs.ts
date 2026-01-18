// services/api/packs.ts
// API module: packs (BTL packs purchase)

import http, { type ApiResponse } from '../http';

export interface Pack {
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

export interface PacksListResponse {
  packs: Pack[];
}

export interface PurchaseCreateResponse {
  session_id?: string;
  client_secret?: string;
  url?: string;
}

export async function getAllPacks(): Promise<Pack[]> {
  const response: ApiResponse<PacksListResponse> = await http.get('/packs');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Impossible de récupérer les packs');
  }
  return Array.isArray(response.data.packs) ? response.data.packs : [];
}

export async function createPurchaseIntent(packId: number): Promise<PurchaseCreateResponse> {
  const response: ApiResponse<PurchaseCreateResponse> = await http.post('/purchase/create-intent', { pack_id: packId });
  if (!response.success || !response.data) {
    throw new Error(response.error || "Impossible de créer l'intention de paiement");
  }
  return response.data;
}

export function formatPrice(priceCents: number): string {
  return (priceCents / 100).toFixed(2);
}

export function calculateBonusPercentage(nbBtl: number, bonus: number): number {
  if (nbBtl === 0) return 0;
  return Math.round((bonus / nbBtl) * 100);
}

