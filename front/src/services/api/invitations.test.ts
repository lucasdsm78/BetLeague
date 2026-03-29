import http from '../http';

import { getReceivedInvitations } from './invitations';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

describe('invitations api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalise les invitations ligue et tournoi reçues', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        invitations: [
          {
            id: 1,
            type: 'league',
            status: 'PENDING',
            league: {
              id: 10,
              name: 'Ligue VIP',
              max_players: 20,
              start_date: 1710000000000,
              user_creator: { id: 9, pseudo: 'captain' },
              nb_players_remaining: 8,
              is_started: false,
            },
          },
          {
            id: 2,
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
        total: 2,
        page: 1,
        page_size: 20,
      },
      status: 200,
      headers: {},
    });

    await expect(getReceivedInvitations({ page: 1, pageSize: 20, status: 'PENDING' })).resolves.toEqual({
      invitations: [
        {
          id: 1,
          type: 'league',
          status: 'PENDING',
          league: {
            id: 10,
            name: 'Ligue VIP',
            max_players: 20,
            start_date: 1710000000000,
            user_creator: { id: 9, pseudo: 'captain' },
            nb_players_remaining: 8,
            is_started: false,
          },
        },
        {
          id: 2,
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
      total: 2,
      page: 1,
      page_size: 20,
    });

    expect(http.get).toHaveBeenCalledWith('/invitations?is_received=true&page=1&page_size=20&status=PENDING', {
      skipCache: true,
      cache: 'no-store',
    });
  });
});

