import http, { type ApiResponse } from '../http';
import type { ApiUserPurchase, ApiUserPurchasesResponse } from '../../types/api/purchases';

export async function getMyPurchases(): Promise<ApiUserPurchase[]> {
  const response: ApiResponse<ApiUserPurchasesResponse> = await http.get('/purchases');
  if (!response.data) throw new Error("Impossible de récupérer l'historique des achats");
  return Array.isArray(response.data.purchases) ? response.data.purchases : [];
}

