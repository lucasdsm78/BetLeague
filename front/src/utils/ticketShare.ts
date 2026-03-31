export type TicketShareNetwork = 'system' | 'instagram' | 'tiktok';
export type TicketShareVariant = 'feed' | 'story';
export type TicketShareAction = 'share' | 'copy-link' | 'download-image';

export interface ShareTicketChoiceInput {
  homeTeam: string;
  awayTeam: string;
  choice: string;
}

export interface ShareWinningTicketInput {
  ticketUuid: string;
  gain: number;
  mise?: number;
  leagueName?: string | null;
  origin?: string;
  network?: TicketShareNetwork;
  variant?: TicketShareVariant;
  action?: TicketShareAction;
  choices?: ShareTicketChoiceInput[];
}

export interface ShareWinningTicketResult {
  method: 'native' | 'clipboard' | 'download' | 'native+clipboard';
  url: string;
  message: string;
  fileName?: string;
  network: TicketShareNetwork;
  variant: TicketShareVariant;
}

function resolveOrigin(origin?: string): string {
  if (origin && origin.trim()) return origin.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/$/, '');
  return '';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document !== 'undefined') {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return;
  }

  throw new Error('Copie indisponible sur cet appareil');
}

function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Téléchargement indisponible sur cet appareil');
  }

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

function getNetworkLabel(network: TicketShareNetwork): string {
  switch (network) {
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    default:
      return 'vos réseaux';
  }
}

export function buildSharedWinningTicketUrl(ticketUuid: string, origin?: string): string {
  const base = resolveOrigin(origin);
  const path = `/tickets/shared/${encodeURIComponent(ticketUuid)}`;
  return base ? `${base}${path}` : path;
}

export function buildWinningTicketShareMessage(input: ShareWinningTicketInput): string {
  const url = buildSharedWinningTicketUrl(input.ticketUuid, input.origin);
  const gain = Number.isFinite(input.gain) ? input.gain.toFixed(2) : '0.00';
  const mise = Number.isFinite(input.mise) ? Number(input.mise).toFixed(2) : '0.00';
  const networkLabel = getNetworkLabel(input.network ?? 'system');
  const intro = input.leagueName
    ? `J'ai misé ${mise}€ et gagné ${gain}€ sur BetLeague dans ${input.leagueName}`
    : `J'ai misé ${mise}€ et gagné ${gain}€ sur BetLeague`;
  const storyHint = input.variant === 'story'
    ? ` Je partage aussi le ticket en story sur ${networkLabel}.`
    : ` Regardez mon ticket.`;
  return `${intro}.${storyHint}\n${url}`;
}

function buildTicketShareSvg(input: ShareWinningTicketInput): string {
  const gain = Number.isFinite(input.gain) ? input.gain.toFixed(2) : '0.00';
  const mise = Number.isFinite(input.mise) ? Number(input.mise).toFixed(2) : '0.00';
  const isStory = (input.variant ?? 'feed') === 'story';
  const width = isStory ? 1080 : 1200;
  const height = isStory ? 1920 : 1200;
  const league = escapeXml(input.leagueName || 'Ticket gagnant BetLeague');
  const uuidLabel = escapeXml(`#${input.ticketUuid.slice(0, 8).toUpperCase()}`);
  const gainLabel = escapeXml(`${gain}€`);
  const miseLabel = escapeXml(`${mise}€ misés`);
  const choices = (input.choices ?? []).slice(0, isStory ? 4 : 3).map((choice) => (
    `${escapeXml(choice.homeTeam)} vs ${escapeXml(choice.awayTeam)} · ${escapeXml(choice.choice)}`
  ));
  const choiceLines = choices.length > 0 ? choices : ['Ticket gagnant prêt à partager'];

  const lineStartY = isStory ? 1015 : 790;
  const lineGap = isStory ? 105 : 88;

  const svgLines = choiceLines
    .map((line, index) => `<text x="96" y="${lineStartY + index * lineGap}" fill="#E5F7FF" font-size="42" font-family="Inter, Arial, sans-serif">${line}</text>`)
    .join('');

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ticket gagnant BetLeague">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#061826" />
        <stop offset="55%" stop-color="#0B2E44" />
        <stop offset="100%" stop-color="#032E3F" />
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0EA5E9" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#10B981" stop-opacity="0.2" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" rx="48" fill="url(#bg)" />
    <circle cx="${width - 110}" cy="120" r="160" fill="#10B981" opacity="0.14" />
    <circle cx="160" cy="${height - 180}" r="220" fill="#06B6D4" opacity="0.1" />
    <rect x="56" y="56" width="${width - 112}" height="${height - 112}" rx="42" fill="url(#card)" stroke="#2DD4BF" stroke-opacity="0.25" />
    <text x="96" y="145" fill="#6EE7B7" font-size="36" font-family="Inter, Arial, sans-serif" font-weight="700">🏆 TICKET GAGNANT</text>
    <text x="96" y="255" fill="#FFFFFF" font-size="84" font-family="Inter, Arial, sans-serif" font-weight="800">BetLeague</text>
    <text x="96" y="330" fill="#9ADCF4" font-size="44" font-family="Inter, Arial, sans-serif">${league}</text>
    <text x="96" y="470" fill="#9ADCF4" font-size="34" font-family="Inter, Arial, sans-serif">Gain remporté</text>
    <text x="96" y="610" fill="#FFFFFF" font-size="136" font-family="Inter, Arial, sans-serif" font-weight="900">${gainLabel}</text>
    <rect x="96" y="660" width="${isStory ? 330 : 280}" height="56" rx="18" fill="rgba(110,231,183,0.14)" stroke="rgba(110,231,183,0.28)" />
    <text x="124" y="697" fill="#6EE7B7" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="700">${miseLabel}</text>
    <text x="96" y="775" fill="#6EE7B7" font-size="30" font-family="Inter, Arial, sans-serif">Ticket ${uuidLabel}</text>
    ${svgLines}
    <text x="96" y="${height - 180}" fill="#E5F7FF" font-size="28" font-family="Inter, Arial, sans-serif">Parié sur BetLeague • betleague.app</text>
    <text x="96" y="${height - 130}" fill="#84CC16" font-size="28" font-family="Inter, Arial, sans-serif">Partagez votre victoire sur vos réseaux</text>
  </svg>`;
}

async function rasterizeSvgToPng(svg: string, width: number, height: number): Promise<Blob | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx || typeof Image === 'undefined' || typeof canvas.toBlob !== 'function') {
    return null;
  }

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Impossible de rasteriser le ticket partagé.'));
      img.src = objectUrl;
    });

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function buildWinningTicketShareImageFile(input: ShareWinningTicketInput): Promise<File> {
  const svg = buildTicketShareSvg(input);
  const isStory = (input.variant ?? 'feed') === 'story';
  const width = isStory ? 1080 : 1200;
  const height = isStory ? 1920 : 1200;

  const pngBlob = await rasterizeSvgToPng(svg, width, height);
  if (pngBlob) {
    const fileName = `betleague-ticket-${input.ticketUuid}-${(input.variant ?? 'feed')}.png`;
    return new File([pngBlob], fileName, { type: 'image/png' });
  }

  const fallbackBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const fallbackName = `betleague-ticket-${input.ticketUuid}-${(input.variant ?? 'feed')}.svg`;
  return new File([fallbackBlob], fallbackName, { type: 'image/svg+xml' });
}

export async function shareWinningTicket(input: ShareWinningTicketInput): Promise<ShareWinningTicketResult> {
  const network = input.network ?? 'system';
  const variant = input.variant ?? 'feed';
  const action = input.action ?? 'share';
  const url = buildSharedWinningTicketUrl(input.ticketUuid, input.origin);
  const message = buildWinningTicketShareMessage({ ...input, network, variant });

  if (action === 'copy-link') {
    await copyText(url);
    return { method: 'clipboard', url, message, network, variant };
  }

  const file = await buildWinningTicketShareImageFile({ ...input, network, variant });

  if (action === 'download-image') {
    downloadBlob(file, file.name);
    return { method: 'download', url, message, fileName: file.name, network, variant };
  }

  const wantsClipboardAssist = network === 'instagram' || network === 'tiktok';
  let copiedAssist = false;
  if (wantsClipboardAssist) {
    try {
      await copyText(message);
      copiedAssist = true;
    } catch {
      copiedAssist = false;
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    const isStrictStoryShare = variant === 'story' && (network === 'instagram' || network === 'tiktok');
    const shareData: ShareData = isStrictStoryShare
      ? {}
      : {
          title: 'Ticket gagnant BetLeague',
          text: message,
          url,
        };

    if ((variant === 'story' || network !== 'system') && canShareFiles) {
      shareData.files = [file];
    }

    if (isStrictStoryShare && !shareData.files?.length) {
      downloadBlob(file, file.name);
      return { method: 'download', url, message, fileName: file.name, network, variant };
    }

    await navigator.share(shareData);
    return {
      method: copiedAssist ? 'native+clipboard' : 'native',
      url,
      message,
      fileName: shareData.files?.[0]?.name,
      network,
      variant,
    };
  }

  if (wantsClipboardAssist) {
    downloadBlob(file, file.name);
    return { method: 'download', url, message, fileName: file.name, network, variant };
  }

  await copyText(`${message}\n${url}`);
  return { method: 'clipboard', url, message, network, variant };
}
