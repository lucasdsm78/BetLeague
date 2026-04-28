import http from '../http';
import { ApiClientError } from '../secureApiClient';
import { createPurchaseIntent, getAllPacks } from './packs';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('packs api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retourne les packs disponibles', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        packs: [
          { id: 1, name: 'Pack Starter', price_cents: 399, nb_btl: 50, bonus: 0, total_btl: 50, price_per_100: 7.98, note: null },
        ],
      },
      status: 200,
      headers: {},
    });

    await expect(getAllPacks()).resolves.toEqual([
      { id: 1, name: 'Pack Starter', price_cents: 399, nb_btl: 50, bonus: 0, total_btl: 50, price_per_100: 7.98, note: null },
    ]);
  });

  it('remonte le message métier quand l’achat de BTL est désactivé', async () => {
    (http.get as jest.Mock).mockRejectedValueOnce(new ApiClientError("L'achat de BTL est temporairement indisponible.", {
      status: 403,
      code: 'BTL_PURCHASE_DISABLED',
    }));

    await expect(getAllPacks()).rejects.toThrow("L'achat de BTL est temporairement indisponible.");
  });

  it('remonte le message métier lors de la création d’intention de paiement bloquée', async () => {
    (http.post as jest.Mock).mockRejectedValueOnce(new ApiClientError('La boutique est temporairement indisponible.', {
      status: 403,
      code: 'SHOP_FEATURE_DISABLED',
    }));

    await expect(createPurchaseIntent(2)).rejects.toThrow('La boutique est temporairement indisponible.');
  });
});

