import {
  buildSharedWinningTicketUrl,
  buildWinningTicketShareMessage,
  shareWinningTicket,
} from './ticketShare';

describe('ticketShare utils', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn(() => 'blob:ticket-share'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: jest.fn(),
      configurable: true,
    });
    (global as any).Image = class {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    };
  });

  it('construit l’url publique du ticket partagé', () => {
    expect(buildSharedWinningTicketUrl('abc-123', 'https://betleague.app/')).toBe('https://betleague.app/tickets/shared/abc-123');
  });

  it('génère un message prédéfini pour une story Instagram', () => {
    const message = buildWinningTicketShareMessage({
      ticketUuid: 'abc-123',
      gain: 42.5,
      mise: 12.99,
      leagueName: 'Ligue VIP',
      network: 'instagram',
      variant: 'story',
      origin: 'https://betleague.app',
    });

    expect(message).toContain("J'ai misé 12.99€ et gagné 42.50€ sur BetLeague dans Ligue VIP");
    expect(message).toContain('https://betleague.app/tickets/shared/abc-123');
  });

  it('utilise le partage natif et copie le message pour Instagram', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn().mockReturnValue(true);
    const writeText = jest.fn().mockResolvedValue(undefined);
    const drawImage = jest.fn();
    const toBlob = jest.fn((cb: (blob: Blob) => void) => cb(new Blob(['png'], { type: 'image/png' })));
    jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ clearRect: jest.fn(), drawImage }),
          toBlob,
        } as any;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as any);
    Object.defineProperty(window, 'navigator', {
      value: { share, canShare, clipboard: { writeText } },
      configurable: true,
    });

    await expect(shareWinningTicket({
      ticketUuid: 'abc-123',
      gain: 42.5,
      mise: 12.99,
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
    const sharedPayload = share.mock.calls[0][0];
    expect(sharedPayload.files).toHaveLength(1);
    expect(sharedPayload.files[0].type).toBe('image/png');
    expect(sharedPayload.text).toBeUndefined();
    expect(sharedPayload.url).toBeUndefined();
  });
});
