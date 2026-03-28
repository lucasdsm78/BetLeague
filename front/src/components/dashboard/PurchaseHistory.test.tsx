import React from 'react';
import { render, screen } from '@testing-library/react';

import PurchaseHistory from './PurchaseHistory';

const mockUseMyPurchasesQuery = jest.fn();

jest.mock('../../hooks/queries/usePurchaseQueries', () => ({
  useMyPurchasesQuery: (options?: { enabled?: boolean }) => mockUseMyPurchasesQuery(options),
}));

describe('PurchaseHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche un état vide si aucun achat n’existe', () => {
    mockUseMyPurchasesQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [],
    });

    render(<PurchaseHistory />);

    expect(screen.getByText(/tu n’as pas encore acheté de btl/i)).toBeInTheDocument();
  });

  it('affiche les achats avec statut et métriques', () => {
    mockUseMyPurchasesQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [
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
    });

    render(<PurchaseHistory />);

    expect(screen.getByText('Pack Pro')).toBeInTheDocument();
    expect(screen.getByText('Confirmé')).toBeInTheDocument();
    expect(screen.getByText(/220 BTL/i)).toBeInTheDocument();
  });
});
