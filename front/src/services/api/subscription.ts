// services/api/subscription.ts
// API module: subscription (tournament subscription)

import http, { type ApiResponse } from '../http';
import type {
  ApiCreateSubscriptionRequest,
  ApiCreateSubscriptionResponse,
  ApiCancelSubscriptionResponse,
} from '../../types/api/subscription';

export async function createSubscriptionIntent(request: ApiCreateSubscriptionRequest): Promise<ApiCreateSubscriptionResponse> {
  const response: ApiResponse<ApiCreateSubscriptionResponse> = await http.post('/subscription/create-intent', request);
  if (!response.data) throw new Error("Impossible de créer l'abonnement");
  return response.data;
}

export async function cancelSubscription(): Promise<ApiCancelSubscriptionResponse> {
  const response: ApiResponse<ApiCancelSubscriptionResponse> = await http.post('/subscription/cancel');
  if (!response.data) throw new Error("Impossible d'annuler l'abonnement");
  return response.data;
}
