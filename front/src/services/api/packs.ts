// services/api/packs.ts
// API module: packs (BTL packs purchase)

import http, { type ApiResponse } from '../http';
import type { ApiPack, ApiPacksListResponse, ApiPurchaseCreateResponse } from '../../types/api/packs';

export async function getAllPacks(): Promise<ApiPack[]> {
  const response: ApiResponse<ApiPacksListResponse> = await http.get('/packs');
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Impossible de récupérer les packs');
  }
  return Array.isArray(response.data.packs) ? response.data.packs : [];
}

export async function createPurchaseIntent(packId: number): Promise<ApiPurchaseCreateResponse> {
  const response: ApiResponse<ApiPurchaseCreateResponse> = await http.post('/purchase/create-intent', { pack_id: packId });
  if (!response.success || !response.data) {
    throw new Error(response.error || "Impossible de créer l'intention de paiement");
  }
  return response.data;
}
