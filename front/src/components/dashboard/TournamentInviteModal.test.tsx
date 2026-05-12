import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import TournamentInviteModal from './TournamentInviteModal';

const mockInviteMutateAsync = jest.fn();
const mockInvalidateAll = jest.fn();

jest.mock('../../hooks/queries/useTournamentQueries', () => ({
  useInviteUserToTournamentMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockInviteMutateAsync(...args),
    isPending: false,
  }),
}));

jest.mock('../../hooks/queries/useInvitationsQueries', () => ({
  useInvalidateInvitations: () => ({
    invalidateAll: mockInvalidateAll,
  }),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: '99' } }),
}));

jest.mock('../league/UserSearchInput', () => ({
  __esModule: true,
  default: ({ onUserSelect }: { onUserSelect: (user: { id: number; pseudo: string }) => void }) => (
    <button type="button" onClick={() => onUserSelect({ id: 7, pseudo: 'Lucas' })}>
      Sélectionner Lucas
    </button>
  ),
}));

describe('TournamentInviteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvalidateAll.mockResolvedValue(undefined);
  });

  it('invite un joueur sélectionné puis invalide les listes invitations', async () => {
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
    expect(screen.getByText('Lucas')).toBeInTheDocument();
    expect(screen.queryByText('lucas@example.com')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /envoyer l’invitation/i }));

    await waitFor(() => expect(mockInviteMutateAsync).toHaveBeenCalledWith({ userId: 7 }));
    expect(mockInvalidateAll).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invitation envoyée.'));
  });

  it('ouvre la modale sans afficher de bloc invitations envoyées centralisées', () => {
    render(
      <TournamentInviteModal
        isOpen
        tournamentId={12}
        tournamentName="Tournoi privé"
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText(/invitations > envoyées/i)).not.toBeInTheDocument();
    expect(screen.getByText(/rechercher un utilisateur/i)).toBeInTheDocument();
  });
});
