// services/api/packs.ts
// API module: packs (BTL packs purchase)

import http, { type ApiResponse } from '../http';
import { ApiClientError } from '../secureApiClient';
import type { ApiPack, ApiPacksListResponse, ApiPurchaseCreateResponse } from '../../types/api/packs';

function rethrowBTLPurchaseError(error: unknown, fallbackMessage: string): never {
  if (error instanceof ApiClientError && error.status === 403) {
    if (error.code === 'BTL_PURCHASE_DISABLED' || error.code === 'SHOP_FEATURE_DISABLED') {
      throw new Error(error.message || "L'achat de BTL est temporairement indisponible.");
    }
  }

  throw error instanceof Error ? error : new Error(fallbackMessage);
}

export async function getAllPacks(): Promise<ApiPack[]> {
  try {
    const response: ApiResponse<ApiPacksListResponse> = await http.get('/packs');
    if (!response.data) throw new Error('Impossible de récupérer les packs');
    return Array.isArray(response.data.packs) ? response.data.packs : [];
  } catch (error) {
    rethrowBTLPurchaseError(error, 'Impossible de récupérer les packs');
  }
}

export async function createPurchaseIntent(packId: number): Promise<ApiPurchaseCreateResponse> {
  try {
    const response: ApiResponse<ApiPurchaseCreateResponse> = await http.post('/purchase/create-intent', { pack_id: packId });
    if (!response.data) throw new Error("Impossible de créer l'intention de paiement");
    return response.data;
  } catch (error) {
    rethrowBTLPurchaseError(error, "Impossible de créer l'intention de paiement");
  }
}
