export interface ShareWinningTicketInput {
  ticketUuid: string;
  gain: number;
  leagueName?: string | null;
  origin?: string;
}

export interface ShareWinningTicketResult {
  method: 'native' | 'clipboard';
  url: string;
}

function resolveOrigin(origin?: string): string {
  if (origin && origin.trim()) return origin.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/$/, '');
  return '';
}

export function buildSharedWinningTicketUrl(ticketUuid: string, origin?: string): string {
  const base = resolveOrigin(origin);
  const path = `/tickets/shared/${encodeURIComponent(ticketUuid)}`;
  return base ? `${base}${path}` : path;
}

export async function shareWinningTicket(input: ShareWinningTicketInput): Promise<ShareWinningTicketResult> {
  const url = buildSharedWinningTicketUrl(input.ticketUuid, input.origin);
  const gain = Number.isFinite(input.gain) ? input.gain.toFixed(2) : '0.00';
  const title = 'Ticket gagnant BetLeague';
  const text = input.leagueName
    ? `J'ai gagné ${gain}€ sur BetLeague dans ${input.leagueName}. Regardez mon ticket !`
    : `J'ai gagné ${gain}€ sur BetLeague. Regardez mon ticket !`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title, text, url });
    return { method: 'native', url };
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return { method: 'clipboard', url };
  }

  if (typeof window !== 'undefined') {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return { method: 'clipboard', url };
  }

  throw new Error('Partage indisponible sur cet appareil');
}

