
// services/api/subscription.ts
// API module: subscription (tournament subscription)

import http, { type ApiResponse } from '../http';

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

export async function createSubscriptionIntent(request: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
  const response: ApiResponse<CreateSubscriptionResponse> = await http.post('/subscription/create-intent', request);
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Impossible de créer l\'abonnement');
  }
  return response.data;
}

export async function cancelSubscription(): Promise<CancelSubscriptionResponse> {
  const response: ApiResponse<CancelSubscriptionResponse> = await http.post('/subscription/cancel');
  if (!response.success || !response.data) {
    throw new Error(response.error || "Impossible d'annuler l'abonnement");
  }
  return response.data;
}

export function formatPrice(priceCents: number): string {
  return (priceCents / 100).toFixed(2);
}

// Plan UI (peut venir du back à terme)
export function getSubscriptionPlan(): SubscriptionPlan {
  return {
    name: 'Accès tournois',
    price: 499,
    currency: 'EUR',
    interval: 'month',
    features: [
      'Accès illimité aux tournois',
      'Création de tournois privés',
      'Participation aux tournois publics',
      'Système de brackets avancé',
    ],
  };
}

