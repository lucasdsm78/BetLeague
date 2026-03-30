import http from '../http';

import { deleteLeagueInvitation, getReceivedInvitations, getSentLeagueInvitations } from './invitations';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
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

  it('charge les invitations envoyées pour une ligue', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
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
      status: 200,
      headers: {},
    });

    await expect(getSentLeagueInvitations(12)).resolves.toEqual({
      league_id: 12,
      invitations: [
        {
          id: 4,
          status: 'PENDING',
          created_at: 1710000000000,
          user: { id: 22, pseudo: 'Emma', email: 'emma@example.com' },
        },
      ],
    });

    expect(http.get).toHaveBeenCalledWith('/league/12/invitations', {
      skipCache: true,
      cache: 'no-store',
    });
  });

  it('supprime une invitation de ligue envoyée', async () => {
    (http.delete as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { message: 'The invitation is well deleted.', success: true },
      status: 202,
      headers: {},
    });

    await expect(deleteLeagueInvitation(4)).resolves.toEqual({
      message: 'The invitation is well deleted.',
      success: true,
    });

    expect(http.delete).toHaveBeenCalledWith('/league/invitation/4');
  });
});
