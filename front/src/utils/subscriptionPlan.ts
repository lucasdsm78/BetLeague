// utils/subscriptionPlan.ts

import type { ApiSubscriptionPlan } from '../types/api/subscription';

// Modèle UI (hardcodé). Peut venir du back à terme.
export function getSubscriptionPlan(): ApiSubscriptionPlan {
  return {
    name: 'Création tournoi illimitée',
    price: 499,
    currency: 'EUR',
    interval: 'month',
    features: [
      'Création illimitée de tournois après vos 2 gratuits mensuels',
      'Organisation de tournois publics et privés sans limite',
      'Expérience tournoi premium optimisée mobile',
      'Gestion continue de vos brackets et invitations',
    ],
  };
}
