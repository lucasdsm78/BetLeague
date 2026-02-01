// DTOs API: subscription

export type ApiSubscriptionInterval = 'month' | 'year';
export type ApiSubscriptionPlanId = 'monthly' | 'yearly';

export interface ApiSubscriptionPlan {
  name: string;
  price: number; // cents
  currency: string;
  interval: ApiSubscriptionInterval;
  features: string[];
}

export interface ApiCreateSubscriptionRequest {
  subscription_plan: ApiSubscriptionPlanId;
  success_url: string;
  cancel_url: string;
}

export interface ApiCreateSubscriptionResponse {
  checkout_url: string;
}

export interface ApiCancelSubscriptionResponse {
  success: boolean;
  message: string;
}

