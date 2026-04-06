import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import InviteUserModal from './InviteUserModal';

const mockInviteUserToLeague = jest.fn();
const mockInvalidateAll = jest.fn();

jest.mock('../../services/api/leagues', () => ({
  inviteUserToLeague: (...args: unknown[]) => mockInviteUserToLeague(...args),
}));

jest.mock('../../hooks/queries/useInvitationsQueries', () => ({
  useInvalidateInvitations: () => ({ invalidateAll: mockInvalidateAll }),
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
    mockInvalidateAll.mockResolvedValue(undefined);
  });

  it('ouvre la modale sans afficher de bloc invitations envoyées centralisées', () => {
    render(
      <InviteUserModal
        isOpen
        leagueId={12}
        leagueName="Ligue VIP"
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText(/invitations > envoyées/i)).not.toBeInTheDocument();
    expect(screen.getByText(/rechercher un utilisateur/i)).toBeInTheDocument();
  });

  it('envoie une invitation puis invalide les listes invitations', async () => {
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
    expect(mockInvalidateAll).toHaveBeenCalled();
  });
});

