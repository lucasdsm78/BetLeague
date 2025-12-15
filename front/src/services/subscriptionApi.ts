/**
 * Subscription API Service
 * Handles all tournament subscription-related API calls
 */

import apiClient from './secureApiClient';

export interface SubscriptionPlan {
  name: string;
  price: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export interface CreateSubscriptionRequest {
  subscription_plan: 'monthly' | 'yearly';
  success_url: string;
  cancel_url: string;
}

export interface CreateSubscriptionResponse {
  checkout_url: string;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  message: string;
}

/**
 * Create a tournament subscription intent (Stripe Checkout)
 * @param request - Subscription request data
 * @returns Checkout session URL and ID
 */
export const createSubscriptionIntent = async (
  request: CreateSubscriptionRequest
): Promise<CreateSubscriptionResponse> => {
  try {
    const response = await apiClient.post<CreateSubscriptionResponse>(
      '/subscription/create-intent',
      request
    );

    if (!response.data) {
      throw new Error('Réponse invalide du serveur');
    }

    return response.data;
  } catch (error: any) {
    console.error('Error creating subscription intent:', error);
    throw new Error(
      error.response?.data?.detail || 'Impossible de créer l\'abonnement'
    );
  }
};

/**
 * Cancel user's active subscription
 * @returns Cancellation result
 */
export const cancelSubscription = async (): Promise<CancelSubscriptionResponse> => {
  try {
    const response = await apiClient.post<CancelSubscriptionResponse>(
      '/subscription/cancel'
    );

    if (!response.data) {
      throw new Error('Réponse invalide du serveur');
    }

    return response.data;
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    throw new Error(
      error.response?.data?.detail || 'Impossible d\'annuler l\'abonnement'
    );
  }
};

/**
 * Format price from cents to euros
 * @param priceCents - Price in cents
 * @returns Formatted price string
 */
export const formatPrice = (priceCents: number): string => {
  return (priceCents / 100).toFixed(2);
};

/**
 * Get subscription plan details
 * Note: In a real app, this would come from the backend
 * For now, using hardcoded values
 */
export const getSubscriptionPlan = (): SubscriptionPlan => {
  return {
    name: 'Accès tournois',
    price: 499, // 4.99€
    currency: 'EUR',
    interval: 'month',
    features: [
      'Accès illimité aux tournois',
      'Création de tournois privés',
      'Participation aux tournois publics',
      'Système de brackets avancé'
    ]
  };
};
