import http from '../http';

import { getSharedTicketDetail } from './tickets';

jest.mock('../http', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe('tickets api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('charge un ticket partagé sans auth', async () => {
    (http.get as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: {
        uuid: 'ticket-uuid',
        mise: 10,
        gain: 28.5,
        status: 'CORRECT',
        league_summary: { id: 11, name: 'Ligue VIP', max_players: 20 },
        match_choice_summaries: [],
      },
      status: 200,
      headers: {},
    });

    await expect(getSharedTicketDetail('ticket-uuid')).resolves.toEqual({
      uuid: 'ticket-uuid',
      mise: 10,
      gain: 28.5,
      status: 'CORRECT',
      league_summary: { id: 11, name: 'Ligue VIP' },
      tournament_match_summary: null,
      match_choice_summaries: [],
    });

    expect(http.get).toHaveBeenCalledWith('/ticket/shared/ticket-uuid', {
      signal: undefined,
      skipAuth: true,
      skipRetry: true,
      skipCache: true,
      cache: 'no-store',
    });
  });
});

