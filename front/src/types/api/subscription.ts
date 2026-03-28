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
}

export interface ApiSubscriptionPlansResponse {
  plans: Omit<ApiSubscriptionPlan, 'features'>[];
  yearly_savings_cents: number;
  yearly_discount_percent: number;
}

export interface ApiCreateSubscriptionRequest {
  subscription_plan: ApiSubscriptionPlanId;
}

export interface ApiCreateSubscriptionResponse {
  checkout_url: string;
}

export interface ApiCancelSubscriptionResponse {
  success: boolean;
  message: string;
}
