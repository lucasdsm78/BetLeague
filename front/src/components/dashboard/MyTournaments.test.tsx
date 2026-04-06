import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import MyTournaments from './MyTournaments';

const mockMutateAsync = jest.fn();
const mockShowSuccess = jest.fn();

const mockUseMyTournamentsQuery = jest.fn();
const mockUseLeaveTournamentMutation = jest.fn();

jest.mock('../../hooks/queries/useTournamentQueries', () => ({
  useMyTournamentsQuery: (...args: unknown[]) => mockUseMyTournamentsQuery(...args),
  useLeaveTournamentMutation: (...args: unknown[]) => mockUseLeaveTournamentMutation(...args),
}));

jest.mock('../../toast/ToastProvider', () => ({
  useGlobalToast: () => ({
    showSuccess: mockShowSuccess,
    showError: jest.fn(),
  }),
}));

jest.mock('./TournamentStages', () => ({
  __esModule: true,
  default: ({ tournamentName }: { tournamentName: string }) => <div>Étapes de {tournamentName}</div>,
}));

describe('MyTournaments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMyTournamentsQuery.mockReturnValue({
      data: {
        tournaments: [
          {
            id: 12,
            uuid: 'uuid-12',
            name: 'Tournoi Knockout',
            is_private: false,
            max_players: 16,
          },
        ],
        total_count: 1,
        page: 1,
        page_size: 10,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseLeaveTournamentMutation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it('ouvre la modale puis quitte un tournoi avec toast de succès', async () => {
    mockMutateAsync.mockResolvedValueOnce({ message: 'The player is well deleted to the tournament' });

    render(<MyTournaments />);

    fireEvent.click(screen.getByRole('button', { name: /quitter le tournoi tournoi knockout/i }));
    const dialog = screen.getByRole('dialog', { name: /quitter le tournoi/i });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /quitter le tournoi/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({ tournamentId: 12 }));
    expect(mockShowSuccess).toHaveBeenCalledWith('Tournoi quitté', 'Vous avez quitté le tournoi Tournoi Knockout');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /quitter le tournoi/i })).not.toBeInTheDocument();
    });
  });

  it('affiche le message d’erreur dans la modale si la désinscription échoue', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Le tournoi a déjà commencé'));

    render(<MyTournaments />);

    fireEvent.click(screen.getByRole('button', { name: /quitter le tournoi tournoi knockout/i }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /quitter le tournoi/i })).getByRole('button', { name: /quitter le tournoi/i })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Le tournoi a déjà commencé');
    });
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('déplie les étapes avec les attributs aria attendus', () => {
    render(<MyTournaments />);

    const toggleButton = screen.getByRole('button', { name: /voir les étapes/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/étapes de tournoi knockout/i)).toBeInTheDocument();
  });
});



