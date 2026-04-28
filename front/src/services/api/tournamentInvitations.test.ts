import http from '../http';

import {
  deleteTournamentInvitation,
  getTournamentInvitations,
  inviteUserToTournament,
} from './tournament';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('tournament invitation api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invite un joueur à un tournoi', async () => {
    (http.post as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { message: 'Invitation envoyée.' },
      status: 200,
      headers: {},
    });

    await expect(inviteUserToTournament(12, 7)).resolves.toEqual({ message: 'Invitation envoyée.' });
    expect(http.post).toHaveBeenCalledWith('/tournament/12/7/invite');
  });

  it('charge les invitations de tournoi envoyées', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        tournament_id: 12,
        invitations: [
          { id: 4, status: 'pending', created_at: 1710000000000, user: { id: 22, pseudo: 'Emma', email: 'emma@example.com' } },
        ],
      },
      status: 200,
      headers: {},
    });

    await expect(getTournamentInvitations(12)).resolves.toEqual({
      tournament_id: 12,
      invitations: [
        { id: 4, status: 'pending', created_at: 1710000000000, user: { id: 22, pseudo: 'Emma', email: 'emma@example.com' } },
      ],
    });
    expect(http.get).toHaveBeenCalledWith('/tournament/12/invitations');
  });

  it('supprime une invitation de tournoi', async () => {
    (http.delete as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { message: 'Invitation supprimée.' },
      status: 202,
      headers: {},
    });

    await expect(deleteTournamentInvitation(4)).resolves.toEqual({ message: 'Invitation supprimée.' });
    expect(http.delete).toHaveBeenCalledWith('/tournament/invitation/4');
  });
});

