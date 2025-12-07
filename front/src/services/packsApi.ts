/**
 * Packs API Service - BTL Packs Purchase
 * Secure service for managing BTL pack purchases
 */

import secureApiClient, { ApiResponse } from './secureApiClient';

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

export interface PurchaseCreateRequest {
  pack_id: number;
}

export interface PurchaseCreateResponse {
  session_id?: string;
  client_secret?: string;
  url?: string;
}

/**
 * Récupère tous les packs BTL disponibles
 */
export const getAllPacks = async (): Promise<Pack[]> => {
  try {
    const response: ApiResponse<PacksListResponse> = await secureApiClient.get('/packs');

    if (!response.success || !response.data) {
      throw new Error('Impossible de récupérer les packs');
    }

    return response.data.packs;
  } catch (error) {
    console.error('Error fetching packs:', error);
    throw error;
  }
};

/**
 * Crée une intention de paiement pour un pack BTL
 */
export const createPurchaseIntent = async (packId: number): Promise<PurchaseCreateResponse> => {
  try {
    const response: ApiResponse<PurchaseCreateResponse> = await secureApiClient.post(
      '/purchase/create-intent',
      { pack_id: packId }
    );

    if (!response.success || !response.data) {
      throw new Error('Impossible de créer l\'intention de paiement');
    }

    return response.data;
  } catch (error) {
    console.error('Error creating purchase intent:', error);
    throw error;
  }
};

/**
 * Formatte le prix en centimes en euros
 */
export const formatPrice = (priceCents: number): string => {
  return (priceCents / 100).toFixed(2);
};

/**
 * Calcule le pourcentage de bonus
 */
export const calculateBonusPercentage = (nbBtl: number, bonus: number): number => {
  if (nbBtl === 0) return 0;
  return Math.round((bonus / nbBtl) * 100);
};

export default {
  getAllPacks,
  createPurchaseIntent,
  formatPrice,
  calculateBonusPercentage,
};