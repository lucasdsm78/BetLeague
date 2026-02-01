// utils/subscriptionPlan.ts

import type { ApiSubscriptionPlan } from '../types/api/subscription';

// Modèle UI (hardcodé). Peut venir du back à terme.
export function getSubscriptionPlan(): ApiSubscriptionPlan {
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

