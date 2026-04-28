import http from '../http';
import { ApiClientError } from '../secureApiClient';
import {
  cancelSubscription,
  createSubscriptionIntent,
  getCurrentTournamentSubscription,
  getSubscriptionPlans,
} from './subscription';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('subscription api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retourne les plans d’abonnement tournoi', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        plans: [
          { id: 'monthly', name: 'Mensuel', price_cents: 499, currency: 'EUR', interval: 'month', is_recommended: false },
          { id: 'yearly', name: 'Annuel', price_cents: 2999, currency: 'EUR', interval: 'year', is_recommended: true },
        ],
        yearly_savings_cents: 2989,
        yearly_discount_percent: 50,
      },
      status: 200,
      headers: {},
    });

    await expect(getSubscriptionPlans()).resolves.toEqual({
      plans: [
        { id: 'monthly', name: 'Mensuel', price_cents: 499, currency: 'EUR', interval: 'month', is_recommended: false },
        { id: 'yearly', name: 'Annuel', price_cents: 2999, currency: 'EUR', interval: 'year', is_recommended: true },
      ],
      yearly_savings_cents: 2989,
      yearly_discount_percent: 50,
    });
  });

  it('crée une session Stripe avec le plan sélectionné uniquement', async () => {
    (http.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { checkout_url: 'https://checkout.stripe.test/session' },
      status: 200,
      headers: {},
    });

    await expect(createSubscriptionIntent({ subscription_plan: 'yearly' })).resolves.toEqual({
      checkout_url: 'https://checkout.stripe.test/session',
    });

    expect(http.post).toHaveBeenCalledWith('/subscription/create-intent', {
      subscription_plan: 'yearly',
    });
  });

  it('annule l’abonnement tournoi via le bon endpoint', async () => {
    (http.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        message: 'Votre abonnement tournoi sera résilié à la fin de la période en cours.',
        cancel_at_period_end: true,
        current_period_end: 1800000000000,
        has_tournament_access: true,
      },
      status: 200,
      headers: {},
    });

    await expect(cancelSubscription()).resolves.toEqual({
      success: true,
      message: 'Votre abonnement tournoi sera résilié à la fin de la période en cours.',
      cancel_at_period_end: true,
      current_period_end: 1800000000000,
      has_tournament_access: true,
    });

    expect(http.post).toHaveBeenCalledWith('/subscription/cancel');
  });

  it('remonte une erreur exploitable si la réponse de résiliation est vide', async () => {
    (http.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: null,
      status: 200,
      headers: {},
    });

    await expect(cancelSubscription()).rejects.toThrow("Impossible d'annuler l'abonnement");
  });

  it('retourne l’abonnement tournoi courant pour le mode gérer', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        plan_id: 'yearly',
        plan_name: 'Annuel',
        price_cents: 2999,
        currency: 'EUR',
        interval: 'year',
        status: 'active',
        current_period_start: 1700000000000,
        current_period_end: 1800000000000,
        cancel_at_period_end: true,
        cancellation_requested_at: 1750000000000,
        has_tournament_access: true,
      },
      status: 200,
      headers: {},
    });

    await expect(getCurrentTournamentSubscription()).resolves.toEqual({
      plan_id: 'yearly',
      plan_name: 'Annuel',
      price_cents: 2999,
      currency: 'EUR',
      interval: 'year',
      status: 'active',
      current_period_start: 1700000000000,
      current_period_end: 1800000000000,
      cancel_at_period_end: true,
      cancellation_requested_at: 1750000000000,
      has_tournament_access: true,
    });

    expect(http.get).toHaveBeenCalledWith('/subscription/me');
  });

  it('remonte le message métier si la souscription tournoi est désactivée', async () => {
    (http.get as jest.Mock).mockRejectedValueOnce(new ApiClientError("L'abonnement tournoi est temporairement indisponible.", {
      status: 403,
      code: 'TOURNAMENT_SUBSCRIPTION_DISABLED',
    }));

    await expect(getSubscriptionPlans()).rejects.toThrow("L'abonnement tournoi est temporairement indisponible.");
  });

  it('remonte le message métier si la boutique entière est désactivée pendant la création', async () => {
    (http.post as jest.Mock).mockRejectedValueOnce(new ApiClientError('La boutique est temporairement indisponible.', {
      status: 403,
      code: 'SHOP_FEATURE_DISABLED',
    }));

    await expect(createSubscriptionIntent({ subscription_plan: 'yearly' })).rejects.toThrow('La boutique est temporairement indisponible.');
  });
});
