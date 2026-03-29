import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TournamentInviteModal from './TournamentInviteModal';

const mockInviteUserToTournament = jest.fn();
const mockDeleteTournamentInvitation = jest.fn();
const mockUseTournamentInvitationsQuery = jest.fn();
const mockInvalidateInvitations = jest.fn();
const mockRefetch = jest.fn();

jest.mock('../../services/api/tournament', () => ({
  inviteUserToTournament: (...args: unknown[]) => mockInviteUserToTournament(...args),
  deleteTournamentInvitation: (...args: unknown[]) => mockDeleteTournamentInvitation(...args),
}));

jest.mock('../../hooks/queries/useTournamentQueries', () => ({
  useTournamentInvitationsQuery: (...args: unknown[]) => mockUseTournamentInvitationsQuery(...args),
  useTournamentLists: () => ({ invalidateInvitations: mockInvalidateInvitations }),
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
    mockInvalidateInvitations.mockResolvedValue(undefined);
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
    mockInviteUserToTournament.mockResolvedValueOnce({ message: 'Invitation envoyée.' });

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

    await waitFor(() => expect(mockInviteUserToTournament).toHaveBeenCalledWith(12, 7));
    expect(mockInvalidateInvitations).toHaveBeenCalledWith(12);
    expect(mockRefetch).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invitation envoyée.'));
  });

  it('supprime une invitation existante', async () => {
    mockDeleteTournamentInvitation.mockResolvedValueOnce({ message: 'Invitation supprimée.' });

    render(
      <TournamentInviteModal
        isOpen
        tournamentId={12}
        tournamentName="Tournoi privé"
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /supprimer/i }));

    await waitFor(() => expect(mockDeleteTournamentInvitation).toHaveBeenCalledWith(4));
    expect(mockInvalidateInvitations).toHaveBeenCalledWith(12);
  });
});
