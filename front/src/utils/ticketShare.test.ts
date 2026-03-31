import {
  buildSharedWinningTicketUrl,
  buildWinningTicketShareMessage,
  shareWinningTicket,
} from './ticketShare';

describe('ticketShare utils', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('construit l’url publique du ticket partagé', () => {
    expect(buildSharedWinningTicketUrl('abc-123', 'https://betleague.app/')).toBe('https://betleague.app/tickets/shared/abc-123');
  });

  it('génère un message prédéfini pour une story Instagram', () => {
    expect(buildWinningTicketShareMessage({
      ticketUuid: 'abc-123',
      gain: 42.5,
      leagueName: 'Ligue VIP',
      network: 'instagram',
      variant: 'story',
      origin: 'https://betleague.app',
    })).toContain('Je partage aussi le ticket en story sur Instagram.');
  });

  it('utilise le partage natif et copie le message pour Instagram', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn().mockReturnValue(true);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'navigator', {
      value: { share, canShare, clipboard: { writeText } },
      configurable: true,
    });

    await expect(shareWinningTicket({
      ticketUuid: 'abc-123',
      gain: 42.5,
      leagueName: 'Ligue VIP',
      origin: 'https://betleague.app',
      network: 'instagram',
      variant: 'story',
    })).resolves.toEqual(expect.objectContaining({
      method: 'native+clipboard',
      url: 'https://betleague.app/tickets/shared/abc-123',
      network: 'instagram',
      variant: 'story',
    }));

    expect(writeText).toHaveBeenCalled();
    expect(share).toHaveBeenCalled();
  });

  it('copie uniquement le message quand demandé', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'navigator', {
      value: { clipboard: { writeText } },
      configurable: true,
    });

    const result = await shareWinningTicket({
      ticketUuid: 'abc-123',
      gain: 42.5,
      leagueName: 'Ligue VIP',
      action: 'copy-message',
      origin: 'https://betleague.app',
    });

    expect(result.method).toBe('clipboard');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://betleague.app/tickets/shared/abc-123'));
  });
});
