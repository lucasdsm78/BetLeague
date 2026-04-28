// DTOs API: subscription

export type ApiSubscriptionInterval = 'month' | 'year';
export type ApiSubscriptionPlanId = 'monthly' | 'yearly';

export interface ApiSubscriptionPlan {
  id: ApiSubscriptionPlanId;
  name: string;
  price_cents: number;
  currency: string;
  interval: ApiSubscriptionInterval;
  is_recommended: boolean;
  features: string[];
  price?: number;
}

export interface ApiSubscriptionPlansResponse {
  plans: ApiSubscriptionPlan[];
  yearly_savings_cents: number;
  yearly_discount_percent: number;
}

export interface ApiCreateSubscriptionRequest {
  subscription_plan: ApiSubscriptionPlanId;
  success_url?: string;
  cancel_url?: string;
}

export interface ApiCreateSubscriptionResponse {
  checkout_url: string;
}

export interface ApiCancelSubscriptionResponse {
  success: boolean;
  message: string;
  cancel_at_period_end: boolean;
  current_period_end?: number | null;
  has_tournament_access: boolean;
}

export interface ApiCurrentTournamentSubscription {
  plan_id: ApiSubscriptionPlanId;
  plan_name: string;
  price_cents: number;
  currency: string;
  interval: ApiSubscriptionInterval;
  status: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end: boolean;
  cancellation_requested_at?: number | null;
  has_tournament_access: boolean;
}
