import http from '../http';
import { getMyPurchases } from './purchases';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe('purchases api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retourne les achats de l’utilisateur connecté', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        purchases: [
          {
            id: 1,
            uuid: 'purchase-1',
            status: 'SUCCEEDED',
            created_at: 1710000000000,
            pack_id: 2,
            pack_name: 'Pack Pro',
            pack_price_cents: 1999,
            pack_total_btl: 220,
          },
        ],
      },
      status: 200,
      headers: {},
    });

    await expect(getMyPurchases()).resolves.toEqual([
      {
        id: 1,
        uuid: 'purchase-1',
        status: 'SUCCEEDED',
        created_at: 1710000000000,
        pack_id: 2,
        pack_name: 'Pack Pro',
        pack_price_cents: 1999,
        pack_total_btl: 220,
      },
    ]);
  });
});

