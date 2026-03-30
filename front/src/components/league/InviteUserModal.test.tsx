import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import InviteUserModal from './InviteUserModal';

const mockInviteUserToLeague = jest.fn();
const mockDeleteLeagueInvitation = jest.fn();
const mockUseLeagueSentInvitationsQuery = jest.fn();
const mockInvalidateLeagueSent = jest.fn();
const mockRefetch = jest.fn();

jest.mock('../../services/api/leagues', () => ({
  inviteUserToLeague: (...args: unknown[]) => mockInviteUserToLeague(...args),
}));

jest.mock('../../services/api/invitations', () => ({
  deleteLeagueInvitation: (...args: unknown[]) => mockDeleteLeagueInvitation(...args),
}));

jest.mock('../../hooks/queries/useInvitationsQueries', () => ({
  useLeagueSentInvitationsQuery: (...args: unknown[]) => mockUseLeagueSentInvitationsQuery(...args),
  useInvalidateInvitations: () => ({ invalidateLeagueSent: mockInvalidateLeagueSent }),
}));

jest.mock('./UserSearchInput', () => ({
  __esModule: true,
  default: ({ onUserSelect }: { onUserSelect: (user: { id: number; pseudo: string; email: string }) => void }) => (
    <button type="button" onClick={() => onUserSelect({ id: 8, pseudo: 'Lucas', email: 'lucas@example.com' })}>
      Sélectionner Lucas
    </button>
  ),
}));

describe('InviteUserModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue(undefined);
    mockInvalidateLeagueSent.mockResolvedValue(undefined);
    mockUseLeagueSentInvitationsQuery.mockReturnValue({
      data: {
        league_id: 12,
        invitations: [
          {
            id: 4,
            status: 'PENDING',
            created_at: 1710000000000,
            user: { id: 22, pseudo: 'Emma', email: 'emma@example.com' },
          },
        ],
      },
      isLoading: false,
      refetch: mockRefetch,
    });
  });

  it('affiche les invitations envoyées et permet de retirer une invitation', async () => {
    mockDeleteLeagueInvitation.mockResolvedValueOnce({ message: 'The invitation is well deleted.', success: true });

    render(
      <InviteUserModal
        isOpen
        leagueId={12}
        leagueName="Ligue VIP"
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(/emma@example.com/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retirer/i }));

    await waitFor(() => expect(mockDeleteLeagueInvitation).toHaveBeenCalledWith(4));
    expect(mockInvalidateLeagueSent).toHaveBeenCalledWith(12);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('envoie une invitation puis recharge la liste', async () => {
    mockInviteUserToLeague.mockResolvedValueOnce({ message: 'The user is invited to join this league' });

    render(
      <InviteUserModal
        isOpen
        leagueId={12}
        leagueName="Ligue VIP"
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /sélectionner lucas/i }));
    fireEvent.click(screen.getByRole('button', { name: /envoyer l'invitation/i }));

    await waitFor(() => expect(mockInviteUserToLeague).toHaveBeenCalledWith(12, 8));
    expect(mockInvalidateLeagueSent).toHaveBeenCalledWith(12);
    expect(mockRefetch).toHaveBeenCalled();
  });
});

