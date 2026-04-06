import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TournamentInviteModal from './TournamentInviteModal';

const mockUseTournamentInvitationsQuery = jest.fn();
const mockInviteMutateAsync = jest.fn();
const mockDeleteMutateAsync = jest.fn();
const mockRefetch = jest.fn();

jest.mock('../../hooks/queries/useTournamentQueries', () => ({
  useTournamentInvitationsQuery: (...args: unknown[]) => mockUseTournamentInvitationsQuery(...args),
  useInviteUserToTournamentMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockInviteMutateAsync(...args),
    isPending: false,
  }),
  useDeleteTournamentInvitationMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockDeleteMutateAsync(...args),
  }),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: '99' } }),
}));

jest.mock('../league/UserSearchInput', () => ({
  __esModule: true,
  default: ({ onUserSelect }: { onUserSelect: (user: { id: number; pseudo: string; email: string }) => void }) => (
    <button type="button" onClick={() => onUserSelect({ id: 7, pseudo: 'Lucas', email: 'lucas@example.com' })}>
      Sélectionner Lucas
    </button>
  ),
}));

describe('TournamentInviteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
    mockUseTournamentInvitationsQuery.mockReturnValue({
      data: {
        tournament_id: 12,
        invitations: [
          {
            id: 4,
            status: 'pending',
            created_at: 1710000000000,
            user: { id: 22, pseudo: 'Emma', email: 'emma@example.com' },
          },
        ],
      },
      isLoading: false,
      refetch: mockRefetch,
    });
  });

  it('invite un joueur sélectionné puis recharge les invitations', async () => {
    mockInviteMutateAsync.mockResolvedValueOnce({ message: 'Invitation envoyée.' });

    render(
      <TournamentInviteModal
        isOpen
        tournamentId={12}
        tournamentName="Tournoi privé"
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /sélectionner lucas/i }));
    fireEvent.click(screen.getByRole('button', { name: /envoyer l’invitation/i }));

    await waitFor(() => expect(mockInviteMutateAsync).toHaveBeenCalledWith({ userId: 7 }));
    expect(mockRefetch).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invitation envoyée.'));
  });

  it('supprime une invitation existante', async () => {
    mockDeleteMutateAsync.mockResolvedValueOnce({ message: 'Invitation retirée.' });

    render(
      <TournamentInviteModal
        isOpen
        tournamentId={12}
        tournamentName="Tournoi privé"
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /retirer/i }));

    await waitFor(() => expect(mockDeleteMutateAsync).toHaveBeenCalledWith({ invitationId: 4 }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invitation retirée.'));
  });

  it('désactive le retrait pour une invitation non pending', () => {
    mockUseTournamentInvitationsQuery.mockReturnValue({
      data: {
        tournament_id: 12,
        invitations: [
          {
            id: 9,
            status: 'accepted',
            created_at: 1710000000000,
            user: { id: 22, pseudo: 'Emma', email: 'emma@example.com' },
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(
      <TournamentInviteModal
        isOpen
        tournamentId={12}
        tournamentName="Tournoi privé"
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /retirer/i })).toBeDisabled();
  });
});
