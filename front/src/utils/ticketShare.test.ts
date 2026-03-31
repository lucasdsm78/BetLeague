import { buildSharedWinningTicketUrl, shareWinningTicket } from './ticketShare';

describe('ticketShare utils', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('construit l’url publique du ticket partagé', () => {
    expect(buildSharedWinningTicketUrl('abc-123', 'https://betleague.app/')).toBe('https://betleague.app/tickets/shared/abc-123');
  });

  it('utilise le partage natif quand disponible', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'navigator', {
      value: { share },
      configurable: true,
    });

    await expect(shareWinningTicket({ ticketUuid: 'abc-123', gain: 42.5, leagueName: 'Ligue VIP', origin: 'https://betleague.app' }))
      .resolves.toEqual({ method: 'native', url: 'https://betleague.app/tickets/shared/abc-123' });

    expect(share).toHaveBeenCalled();
  });
});

