import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TournamentSubscriptionModal from './TournamentSubscriptionModal';

const mockCreateSubscriptionIntent = jest.fn();
const mockUseTournamentSubscriptionPlansQuery = jest.fn();
const mockUseCurrentTournamentSubscriptionQuery = jest.fn();
const mockCancelSubscriptionMutateAsync = jest.fn();
const mockUseCancelTournamentSubscriptionMutation = jest.fn();
const mockUseProfileMeQuery = jest.fn();
const mockAssign = jest.fn();
let consoleErrorSpy: jest.SpyInstance;

jest.mock('../../services/api/subscription', () => ({
  createSubscriptionIntent: (...args: unknown[]) => mockCreateSubscriptionIntent(...args),
}));

jest.mock('../../hooks/queries/useTournamentQueries', () => ({
  useTournamentSubscriptionPlansQuery: () => mockUseTournamentSubscriptionPlansQuery(),
  useCurrentTournamentSubscriptionQuery: () => mockUseCurrentTournamentSubscriptionQuery(),
  useCancelTournamentSubscriptionMutation: () => mockUseCancelTournamentSubscriptionMutation(),
}));

jest.mock('../../hooks/queries/useProfileQuery', () => ({
  useProfileMeQuery: () => mockUseProfileMeQuery(),
}));

describe('TournamentSubscriptionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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
    mockUseTournamentSubscriptionPlansQuery.mockReturnValue({
      data: {
        plans: [
          { id: 'monthly', name: 'Mensuel', price_cents: 499, currency: 'EUR', interval: 'month', is_recommended: false },
          { id: 'yearly', name: 'Annuel', price_cents: 2999, currency: 'EUR', interval: 'year', is_recommended: true },
        ],
        yearly_savings_cents: 2989,
        yearly_discount_percent: 50,
      },
      isLoading: false,
      error: null,
    });
    mockUseCancelTournamentSubscriptionMutation.mockReturnValue({
      isPending: false,
      mutateAsync: mockCancelSubscriptionMutateAsync,
    });
    mockUseCurrentTournamentSubscriptionQuery.mockReturnValue({
      data: {
        plan_id: 'yearly',
        plan_name: 'Annuel',
        price_cents: 2999,
        currency: 'EUR',
        interval: 'year',
        status: 'active',
        current_period_start: 1700000000000,
        current_period_end: 1800000000000,
        cancel_at_period_end: false,
        cancellation_requested_at: null,
        has_tournament_access: true,
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
    expect(screen.getAllByText(/économisez 50%/i).length).toBeGreaterThan(0);
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

  it('permet d’annuler un abonnement actif et ferme la modale', async () => {
    const onClose = jest.fn();
    const onCancellationComplete = jest.fn();
    mockCancelSubscriptionMutateAsync.mockResolvedValueOnce({
      success: true,
      message: 'Votre abonnement tournoi sera résilié à la fin de la période en cours. Votre accès reste actif jusque-là.',
      cancel_at_period_end: true,
      current_period_end: 1800000000000,
      has_tournament_access: true,
    });

    render(
      <TournamentSubscriptionModal
        onClose={onClose}
        onCancellationComplete={onCancellationComplete}
        isSubscriber
      />,
    );

    expect(screen.getByText(/gérer mon abonnement tournoi/i)).toBeInTheDocument();
    expect(screen.getByText(/annuel/i)).toBeInTheDocument();
    expect(screen.getByText(/prochaine échéance/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /planifier la résiliation/i }));

    await waitFor(() => expect(mockCancelSubscriptionMutateAsync).toHaveBeenCalled());

    expect(onCancellationComplete).toHaveBeenCalledWith('Votre abonnement tournoi sera résilié à la fin de la période en cours. Votre accès reste actif jusque-là.');
    expect(onClose).toHaveBeenCalled();
  });

  it('désactive l’action si la résiliation est déjà planifiée', () => {
    mockUseCurrentTournamentSubscriptionQuery.mockReturnValue({
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
      isLoading: false,
      error: null,
    });

    render(<TournamentSubscriptionModal onClose={() => {}} isSubscriber />);

    expect(screen.getByRole('button', { name: /résiliation déjà planifiée/i })).toBeDisabled();
    expect(screen.getByText(/résiliation demandée le/i)).toBeInTheDocument();
  });

  it('affiche un état indisponible et ne déclenche pas le chargement des offres si la souscription est désactivée', async () => {
    mockUseProfileMeQuery.mockReturnValue({
      data: {
        commerce_availability: {
          shop_enabled: true,
          btl_purchase_enabled: true,
          tournament_subscription_enabled: false,
        },
      },
      isLoading: false,
    });

    render(<TournamentSubscriptionModal onClose={() => {}} />);

    expect(mockUseTournamentSubscriptionPlansQuery).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent("L'abonnement tournoi est temporairement indisponible.");
    expect(screen.getByText(/souscription à l’abonnement tournoi est actuellement suspendue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abonnement indisponible/i })).toBeDisabled();
    expect(mockCreateSubscriptionIntent).not.toHaveBeenCalled();
  });
});
