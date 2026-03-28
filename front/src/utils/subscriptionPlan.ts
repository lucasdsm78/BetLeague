// utils/subscriptionPlan.ts

import type {
  ApiSubscriptionPlan,
  ApiSubscriptionPlanId,
  ApiSubscriptionPlansResponse,
} from '../types/api/subscription';

const PLAN_FEATURES: Record<ApiSubscriptionPlanId, string[]> = {
  monthly: [
    'Création illimitée de tournois après vos 2 gratuits mensuels',
    'Organisation de tournois publics et privés sans limite',
    'Expérience tournoi premium optimisée mobile',
    'Annulation possible à tout moment',
  ],
  yearly: [
    'Création illimitée de tournois pendant 12 mois',
    'Organisation de tournois publics et privés sans limite',
    'Expérience tournoi premium optimisée mobile',
    'Meilleur tarif annuel avec paiement sécurisé Stripe',
  ],
};

export function enrichSubscriptionPlans(response: ApiSubscriptionPlansResponse): ApiSubscriptionPlan[] {
  return response.plans.map((plan) => ({
    ...plan,
    price: plan.price_cents,
    features: plan.features?.length ? plan.features : PLAN_FEATURES[plan.id],
  }));
}

export function getDefaultSubscriptionPlanId(plans: ApiSubscriptionPlan[]): ApiSubscriptionPlanId {
  return plans.find((plan) => plan.is_recommended)?.id ?? plans[0]?.id ?? 'monthly';
}

export function getSubscriptionPlanById(
  plans: ApiSubscriptionPlan[],
  planId: ApiSubscriptionPlanId,
): ApiSubscriptionPlan | undefined {
  return plans.find((plan) => plan.id === planId);
}

export function getSubscriptionIntervalLabel(plan: Pick<ApiSubscriptionPlan, 'interval'>): string {
  return plan.interval === 'year' ? '/ an' : '/ mois';
}

export function getSubscriptionEquivalentMonthlyPrice(plan: Pick<ApiSubscriptionPlan, 'interval' | 'price_cents'>): number | null {
  if (plan.interval !== 'year') return null;
  return Math.round(plan.price_cents / 12);
}

export function getYearlyDiscountBadgeLabel(yearlyDiscountPercent: number): string {
  return `Économisez ${yearlyDiscountPercent}%`;
}

export function getSubscriptionPlan(): ApiSubscriptionPlan {
  return {
    id: 'monthly',
    name: 'Création tournoi illimitée',
    price_cents: 499,
    price: 499,
    currency: 'EUR',
    interval: 'month',
    is_recommended: false,
    features: PLAN_FEATURES.monthly,
  };
}
