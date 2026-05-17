import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import BTLPurchaseModal from './BTLPurchaseModal';

const mockGetAllPacks = jest.fn();
const mockCreatePurchaseIntent = jest.fn();
const mockUseProfileMeQuery = jest.fn();

jest.mock('../../services/api/packs', () => ({
  getAllPacks: () => mockGetAllPacks(),
  createPurchaseIntent: (...args: unknown[]) => mockCreatePurchaseIntent(...args),
}));

jest.mock('../../hooks/queries/useProfileQuery', () => ({
  useProfileMeQuery: () => mockUseProfileMeQuery(),
}));

describe('BTLPurchaseModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProfileMeQuery.mockReturnValue({
      data: {
        commerce_availability: {
          shop_enabled: true,
          btl_purchase_enabled: true,
          tournament_subscription_enabled: true,
        },
      },
      isLoading: false,
    });
    mockGetAllPacks.mockResolvedValue([
      {
        id: 1,
        name: 'Pack Starter',
        price_cents: 399,
        nb_btl: 50,
        bonus: 0,
        total_btl: 50,
        price_per_100: 7.98,
        note: 'Parfait pour démarrer sans pression et lancer vos premiers paris.',
      },
      {
        id: 2,
        name: 'Pack Pro',
        price_cents: 1299,
        nb_btl: 180,
        bonus: 40,
        total_btl: 220,
        price_per_100: 5.9,
        note: 'Le meilleur choix pour jouer régulièrement et profiter d’un vrai bonus.',
      },
      {
        id: 3,
        name: 'Pack Elite',
        price_cents: 2499,
        nb_btl: 450,
        bonus: 125,
        total_btl: 575,
        price_per_100: 4.35,
        note: 'L’offre la plus rentable pour maximiser vos BTL et dominer les ligues.',
      },
    ]);
  });

  it('affiche les badges marketing pour Pack Pro et Pack Elite', async () => {
    render(<BTLPurchaseModal onClose={() => {}} />);

    expect(await screen.findByText('Pack Pro')).toBeInTheDocument();

    expect(screen.getByText('Recommandé')).toBeInTheDocument();
    expect(screen.getByText('Meilleure valeur')).toBeInTheDocument();
    expect(screen.getByText(/Le meilleur choix pour jouer régulièrement/i)).toBeInTheDocument();
    expect(screen.getByText(/L’offre la plus rentable/i)).toBeInTheDocument();
  });

  it('affiche un état indisponible sans charger les packs si l’achat BTL est désactivé', async () => {
    mockUseProfileMeQuery.mockReturnValue({
      data: {
        commerce_availability: {
          shop_enabled: true,
          btl_purchase_enabled: false,
          tournament_subscription_enabled: true,
        },
      },
      isLoading: false,
    });

    render(<BTLPurchaseModal onClose={() => {}} />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("L'achat de BTL est temporairement indisponible."));

    expect(mockGetAllPacks).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /acheter/i })).toBeDisabled();
    expect(screen.getByText(/boutique BTL est temporairement indisponible/i)).toBeInTheDocument();
  });
});

