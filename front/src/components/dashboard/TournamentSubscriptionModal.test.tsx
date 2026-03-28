import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TournamentSubscriptionModal from './TournamentSubscriptionModal';

const mockCreateSubscriptionIntent = jest.fn();
const mockUseTournamentSubscriptionPlansQuery = jest.fn();
const mockAssign = jest.fn();
let consoleErrorSpy: jest.SpyInstance;

jest.mock('../../services/api/subscription', () => ({
  createSubscriptionIntent: (...args: unknown[]) => mockCreateSubscriptionIntent(...args),
}));

jest.mock('../../hooks/queries/useTournamentQueries', () => ({
  useTournamentSubscriptionPlansQuery: () => mockUseTournamentSubscriptionPlansQuery(),
}));

describe('TournamentSubscriptionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseTournamentSubscriptionPlansQuery.mockReturnValue({
      data: {
        plans: [
          { id: 'monthly', name: 'Mensuel', price_cents: 499, currency: 'EUR', interval: 'month', is_recommended: false },
          { id: 'yearly', name: 'Annuel', price_cents: 4999, currency: 'EUR', interval: 'year', is_recommended: true },
        ],
        yearly_savings_cents: 989,
      },
      isLoading: false,
      error: null,
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: mockAssign },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('sélectionne l’offre annuelle recommandée par défaut', () => {
    render(<TournamentSubscriptionModal onClose={() => {}} />);

    expect(screen.getByRole('button', { name: /choisir l’offre annuelle/i })).toBeInTheDocument();
    expect(screen.getByText(/9.89€ économisés par an/i)).toBeInTheDocument();
  });

  it('envoie le plan mensuel choisi puis redirige vers Stripe', async () => {
    mockCreateSubscriptionIntent.mockResolvedValueOnce({
      checkout_url: 'https://checkout.stripe.test/session',
    });

    render(<TournamentSubscriptionModal onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /mensuel/i }));
    fireEvent.click(screen.getByRole('button', { name: /choisir l’offre mensuelle/i }));

    await waitFor(() => expect(mockCreateSubscriptionIntent).toHaveBeenCalledWith({
      subscription_plan: 'monthly',
    }));

    expect(mockAssign).toHaveBeenCalledWith('https://checkout.stripe.test/session');
  });

  it('affiche une erreur exploitable si la création de session échoue', async () => {
    mockCreateSubscriptionIntent.mockRejectedValueOnce(new Error('Stripe indisponible'));

    render(<TournamentSubscriptionModal onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /choisir l’offre annuelle/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Stripe indisponible'));
  });
});
