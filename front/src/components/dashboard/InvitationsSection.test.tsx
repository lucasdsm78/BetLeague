import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import InvitationsSection from './InvitationsSection';

const mockUpdateInvitation = jest.fn();
const mockUpdateTournamentInvitation = jest.fn();
const mockInvalidateAll = jest.fn();
const mockRefetch = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();

jest.mock('../../services/api/invitations', () => ({
  updateInvitation: (...args: unknown[]) => mockUpdateInvitation(...args),
  updateTournamentInvitation: (...args: unknown[]) => mockUpdateTournamentInvitation(...args),
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
    refetch: mockRefetch,
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
});

