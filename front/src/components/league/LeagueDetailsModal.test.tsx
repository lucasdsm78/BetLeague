import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import LeagueDetailsModal from './LeagueDetailsModal';
import { getLeagueDetails, joinLeague, startLeague } from '../../services/api/leagues';

jest.mock('../../services/api/leagues', () => ({
  getLeagueDetails: jest.fn(),
  joinLeague: jest.fn(),
  startLeague: jest.fn(),
}));

jest.mock('../../hooks/useAuth.enhanced', () => ({
  useEnhancedAuth: () => ({
    user: { id: 4, email: 'owner@example.com', pseudo: 'owner' },
  }),
}));

describe('LeagueDetailsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (joinLeague as jest.Mock).mockResolvedValue({ message: 'joined' });
    (startLeague as jest.Mock).mockResolvedValue({ message: 'started' });
  });

  it('affiche le pot actuel et le nombre courant de participants', async () => {
    (getLeagueDetails as jest.Mock).mockResolvedValueOnce({
      id: 12,
      name: 'Ligue Premium',
      status: 'OPEN',
      is_free: false,
      start_date: 1_710_000_000_000,
      end_date: 1_710_604_800_000,
      max_players: 10,
      min_players: 3,
      current_players_count: 3,
      nb_players_remaining: 7,
      current_total_pot: 30,
      user_creator: {
        id: 4,
        pseudo: 'owner',
      },
    });

    render(
      <LeagueDetailsModal
        isOpen
        leagueId={12}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(getLeagueDetails).toHaveBeenCalledWith(12);
    });

    expect(await screen.findByText('Pot actuel')).toBeInTheDocument();
    expect(screen.getByText('30 BTL')).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.queryByText('Code de la ligue')).not.toBeInTheDocument();
  });

  it('n’affiche pas de bloc pot quand la donnée n’est pas applicable', async () => {
    (getLeagueDetails as jest.Mock).mockResolvedValueOnce({
      id: 13,
      name: 'Ligue Gratuite',
      status: 'OPEN',
      is_free: true,
      start_date: 1_710_000_000_000,
      max_players: 10,
      min_players: 4,
      current_players_count: 1,
      nb_players_remaining: 9,
      current_total_pot: null,
    });

    render(
      <LeagueDetailsModal
        isOpen
        leagueId={13}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(getLeagueDetails).toHaveBeenCalledWith(13);
    });

    expect(screen.queryByText('Pot actuel')).not.toBeInTheDocument();
    expect(screen.queryByText('0 BTL')).not.toBeInTheDocument();
  });

  it('affiche un bouton démarrer activé pour le créateur quand le minimum est atteint', async () => {
    (getLeagueDetails as jest.Mock).mockResolvedValueOnce({
      id: 12,
      name: 'Ligue Premium',
      status: 'OPEN',
      is_started: false,
      is_free: true,
      start_date: 1_710_000_000_000,
      end_date: 1_710_604_800_000,
      max_players: 10,
      min_players: 3,
      current_players_count: 3,
      nb_players_remaining: 7,
      user_creator: {
        id: 4,
        pseudo: 'owner',
      },
    });

    render(
      <LeagueDetailsModal
        isOpen
        leagueId={12}
        onClose={jest.fn()}
      />
    );

    const startButton = await screen.findByRole('button', { name: /commencer la ligue/i });
    expect(startButton).toBeEnabled();

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(startLeague).toHaveBeenCalledWith(12);
    });
  });
});

