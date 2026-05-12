import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import LeagueDetail from './LeagueDetail';
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

jest.mock('./LeagueRankingModal', () => ({
  __esModule: true,
  default: () => null,
}));

describe('LeagueDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (joinLeague as jest.Mock).mockResolvedValue({ message: 'joined' });
    (startLeague as jest.Mock).mockResolvedValue({ message: 'started' });
  });

  it('n’affiche plus le code de la ligue quand les détails sont chargés', async () => {
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LeagueDetail leagueId={12} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getLeagueDetails).toHaveBeenCalledWith(12);
    });

    expect(await screen.findByText('Ligue Premium')).toBeInTheDocument();
    expect(screen.getByText('Pot actuel')).toBeInTheDocument();
    expect(screen.queryByText('Code de la ligue')).not.toBeInTheDocument();
  });

  it('affiche le bouton commencer la ligue pour le créateur quand le minimum est atteint', async () => {
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LeagueDetail leagueId={12} />
      </MemoryRouter>
    );

    const startButton = await screen.findByRole('button', { name: /commencer la ligue/i });
    expect(startButton).toBeEnabled();

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(startLeague).toHaveBeenCalledWith(12);
    });
  });
});



