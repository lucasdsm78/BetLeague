// services/api/subscription.ts
// API module: subscription (tournament subscription)

import http, { type ApiResponse } from '../http';
import { ApiClientError } from '../secureApiClient';
import type {
  ApiCreateSubscriptionRequest,
  ApiCreateSubscriptionResponse,
  ApiCancelSubscriptionResponse,
  ApiCurrentTournamentSubscription,
  ApiSubscriptionPlansResponse,
} from '../../types/api/subscription';

function rethrowTournamentSubscriptionError(error: unknown, fallbackMessage: string): never {
  if (error instanceof ApiClientError && error.status === 403) {
    if (error.code === 'TOURNAMENT_SUBSCRIPTION_DISABLED' || error.code === 'SHOP_FEATURE_DISABLED') {
      throw new Error(error.message || "L'abonnement tournoi est temporairement indisponible.");
    }
  }

  throw error instanceof Error ? error : new Error(fallbackMessage);
}

export async function getSubscriptionPlans(): Promise<ApiSubscriptionPlansResponse> {
  try {
    const response: ApiResponse<ApiSubscriptionPlansResponse> = await http.get('/subscription/plans');
    if (!response.data) throw new Error("Impossible de charger les formules d'abonnement");
    return response.data;
  } catch (error) {
    rethrowTournamentSubscriptionError(error, "Impossible de charger les formules d'abonnement");
  }
}

export async function getCurrentTournamentSubscription(): Promise<ApiCurrentTournamentSubscription> {
  const response: ApiResponse<ApiCurrentTournamentSubscription> = await http.get('/subscription/me');
  if (!response.data) throw new Error("Impossible de charger votre abonnement tournoi");
  return response.data;
}

export async function createSubscriptionIntent(request: ApiCreateSubscriptionRequest): Promise<ApiCreateSubscriptionResponse> {
  try {
    const response: ApiResponse<ApiCreateSubscriptionResponse> = await http.post('/subscription/create-intent', request);
    if (!response.data) throw new Error("Impossible de créer l'abonnement");
    return response.data;
  } catch (error) {
    rethrowTournamentSubscriptionError(error, "Impossible de créer l'abonnement");
  }
}

export async function cancelSubscription(): Promise<ApiCancelSubscriptionResponse> {
  const response: ApiResponse<ApiCancelSubscriptionResponse> = await http.post('/subscription/cancel');
  if (!response.data) throw new Error("Impossible d'annuler l'abonnement");
  return response.data;
}
