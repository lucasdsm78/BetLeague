import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import InvitationsSection from './InvitationsSection';

const mockDeleteLeagueInvitation = jest.fn();
const mockUpdateInvitation = jest.fn();
const mockUpdateTournamentInvitation = jest.fn();
const mockDeleteTournamentInvitation = jest.fn();
const mockInvalidateAll = jest.fn();
const mockRefetchReceived = jest.fn();
const mockRefetchSent = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();

jest.mock('../../services/api/invitations', () => ({
  deleteLeagueInvitation: (...args: unknown[]) => mockDeleteLeagueInvitation(...args),
  updateInvitation: (...args: unknown[]) => mockUpdateInvitation(...args),
  updateTournamentInvitation: (...args: unknown[]) => mockUpdateTournamentInvitation(...args),
}));

jest.mock('../../services/api/tournament', () => ({
  deleteTournamentInvitation: (...args: unknown[]) => mockDeleteTournamentInvitation(...args),
}));

jest.mock('../../hooks/queries/useInvitationsQueries', () => ({
  useReceivedInvitationsQuery: () => ({
    data: {
      invitations: [
        {
          id: 9,
          type: 'tournament',
          status: 'PENDING',
          tournament: {
            id: 77,
            name: 'Tournoi Knockout',
            max_players: 16,
            current_players: 9,
            start_date: 1710100000000,
            end_date: 1710700000000,
            is_private: true,
            status: 'PENDING',
            user_creator: { id: 3, pseudo: 'organizer' },
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    },
    isLoading: false,
    error: null,
    refetch: mockRefetchReceived,
  }),
  useSentInvitationsQuery: () => ({
    data: {
      invitations: [
        {
          id: 15,
          type: 'league',
          status: 'PENDING',
          created_at: 1710200000000,
          user: { id: 22, pseudo: 'Emma', email: 'emma@example.com' },
          league: {
            id: 10,
            name: 'Ligue VIP',
            max_players: 20,
            start_date: 1710000000000,
            nb_players_remaining: 8,
            user_creator: { id: 9, pseudo: 'captain' },
            is_started: false,
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    },
    isLoading: false,
    error: null,
    refetch: mockRefetchSent,
  }),
  useInvalidateInvitations: () => ({
    invalidateAll: mockInvalidateAll,
  }),
}));

jest.mock('../../toast/ToastProvider', () => ({
  useGlobalToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showInfo: jest.fn(),
  }),
}));

describe('InvitationsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepte une invitation tournoi reçue depuis le dashboard', async () => {
    mockUpdateTournamentInvitation.mockResolvedValueOnce({
      message: 'Tournament invitation accepted successfully',
      success: true,
    });

    render(<InvitationsSection />);

    fireEvent.click(screen.getByRole('button', { name: /accepter/i }));

    await waitFor(() => expect(mockUpdateTournamentInvitation).toHaveBeenCalledWith(9, true));
    expect(mockInvalidateAll).toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalledWith(
      'Invitation acceptée',
      'Tournament invitation accepted successfully',
    );
  });

  it('refuse une invitation tournoi reçue depuis le dashboard', async () => {
    mockUpdateTournamentInvitation.mockResolvedValueOnce({
      message: 'Tournament invitation declined successfully',
      success: true,
    });

    render(<InvitationsSection />);

    fireEvent.click(screen.getByRole('button', { name: /refuser/i }));

    await waitFor(() => expect(mockUpdateTournamentInvitation).toHaveBeenCalledWith(9, false));
    expect(mockInvalidateAll).toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalledWith(
      'Invitation refusée',
      'Tournament invitation declined successfully',
    );
  });

  it('affiche les invitations envoyées dans un onglet dédié puis retire une invitation de ligue', async () => {
    mockDeleteLeagueInvitation.mockResolvedValueOnce({
      message: 'Invitation retirée avec succès',
      success: true,
    });

    render(<InvitationsSection />);

    expect(screen.getByText(/tournoi knockout/i)).toBeInTheDocument();
    expect(screen.queryByText(/ligue vip/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /envoyées/i }));

    expect(screen.getByText(/ligue vip/i)).toBeInTheDocument();
    expect(screen.getByText(/emma@example.com/i)).toBeInTheDocument();
    expect(screen.queryByText(/tournoi knockout/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^retirer$/i }));

    await waitFor(() => expect(mockDeleteLeagueInvitation).toHaveBeenCalledWith(15));
    expect(mockInvalidateAll).toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalledWith('Invitation retirée', 'Invitation retirée avec succès');
  });

  it('revient aux invitations reçues uniquement après avoir cliqué sur reçues', () => {
    render(<InvitationsSection />);

    fireEvent.click(screen.getByRole('tab', { name: /envoyées/i }));
    expect(screen.getByText(/ligue vip/i)).toBeInTheDocument();
    expect(screen.queryByText(/tournoi knockout/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /reçues/i }));
    expect(screen.getByText(/tournoi knockout/i)).toBeInTheDocument();
    expect(screen.queryByText(/ligue vip/i)).not.toBeInTheDocument();
  });
});

