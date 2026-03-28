import http from '../http';
import {
  createSubscriptionIntent,
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
});
