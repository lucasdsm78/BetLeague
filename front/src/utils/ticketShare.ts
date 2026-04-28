import { formatTicketAmount } from './ticketAmount';

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
  const gain = formatTicketAmount(input.gain);
  const mise = formatTicketAmount(input.mise);
  const networkLabel = getNetworkLabel(input.network ?? 'system');
  const intro = input.leagueName
    ? `J'ai misé ${mise} et gagné ${gain} sur BetLeague dans ${input.leagueName}`
    : `J'ai misé ${mise} et gagné ${gain} sur BetLeague`;
  const storyHint = input.variant === 'story'
    ? ` Je partage aussi le ticket en story sur ${networkLabel}.`
    : ` Regardez mon ticket.`;
  return `${intro}.${storyHint}\n${url}`;
}

function buildTicketShareSvg(input: ShareWinningTicketInput): string {
  const gain = formatTicketAmount(input.gain, { withUnit: false });
  const mise = formatTicketAmount(input.mise, { withUnit: false });
  const multiplier = (input.mise && input.mise > 0) ? (input.gain / input.mise).toFixed(1) : null;
  const isStory = (input.variant ?? 'feed') === 'story';
  const width = isStory ? 1080 : 1200;
  const height = isStory ? 1920 : 1200;
  const leagueName = escapeXml(input.leagueName || 'BetLeague');
  const uuidLabel = escapeXml(`#${input.ticketUuid.slice(0, 8).toUpperCase()}`);
  const gainLabel = escapeXml(`+${gain}`);
  const miseLabel = escapeXml(`Mise : ${mise}`);
  const choices = (input.choices ?? []).slice(0, isStory ? 5 : 3);
  const cx = width / 2;

  const choiceStartY = isStory ? 1080 : 720;
  const choiceH = 88;
  const choiceGap = 12;
  const choiceW = width - 160;

  const svgChoiceCards = choices.map((choice, i) => {
    const y = choiceStartY + i * (choiceH + choiceGap);
    const home = escapeXml(choice.homeTeam);
    const away = escapeXml(choice.awayTeam);
    const pick = escapeXml(choice.choice);
    return `
      <rect x="80" y="${y}" width="${choiceW}" height="${choiceH}" rx="18" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" />
      <text x="110" y="${y + 38}" fill="#FFFFFF" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="700">${home} vs ${away}</text>
      <text x="110" y="${y + 70}" fill="#67E8F9" font-size="26" font-family="Inter, Arial, sans-serif" font-weight="600">${pick}</text>
      <circle cx="${choiceW + 40}" cy="${y + 44}" r="16" fill="#10B981" />
      <path d="M${choiceW + 32} ${y + 44} l5 6 l10 -12" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join('');

  const noChoicesPlaceholder = choices.length === 0
    ? `<text x="${cx}" y="${choiceStartY + 44}" fill="rgba(255,255,255,0.5)" font-size="30" font-family="Inter, Arial, sans-serif" text-anchor="middle">Tous les pronostics validés</text>`
    : '';

  const multiplierSvg = multiplier ? `
      <rect x="${isStory ? 700 : 780}" y="455" width="200" height="72" rx="36" fill="url(#multiplierGrad)" />
      <text x="${isStory ? 800 : 880}" y="502" fill="#FFFFFF" font-size="38" font-family="Inter, Arial, sans-serif" font-weight="900" text-anchor="middle">x${escapeXml(multiplier)}</text>` : '';

  const confettiColors = ['#FFD700', '#FF6B6B', '#10B981', '#06B6D4', '#A78BFA', '#F472B6', '#FBBF24'];
  const confettiElements: string[] = [];
  for (let i = 0; i < 40; i++) {
    const confettiX = 60 + ((i * 137 + 89) % (width - 120));
    const confettiY = 30 + ((i * 211 + 43) % (isStory ? 300 : 200));
    const color = confettiColors[i % confettiColors.length];
    const size = 6 + (i % 5) * 3;
    const rotation = (i * 47) % 360;
    const opacity = 0.5 + (i % 4) * 0.15;
    if (i % 3 === 0) {
      confettiElements.push(`<rect x="${confettiX}" y="${confettiY}" width="${size}" height="${size * 2.5}" rx="3" fill="${color}" opacity="${opacity}" transform="rotate(${rotation} ${confettiX + size / 2} ${confettiY + size * 1.25})" />`);
    } else if (i % 3 === 1) {
      confettiElements.push(`<circle cx="${confettiX}" cy="${confettiY}" r="${size / 2}" fill="${color}" opacity="${opacity}" />`);
    } else {
      confettiElements.push(`<polygon points="${confettiX},${confettiY - size} ${confettiX + size},${confettiY + size} ${confettiX - size},${confettiY + size}" fill="${color}" opacity="${opacity}" transform="rotate(${rotation} ${confettiX} ${confettiY})" />`);
    }
  }

  const sparkles = [
    { x: width - 180, y: 200, s: 1.0 },
    { x: 180, y: isStory ? 950 : 660, s: 0.7 },
    { x: width - 140, y: isStory ? 850 : 580, s: 0.5 },
    { x: width / 2 + 200, y: 350, s: 0.8 },
  ].map(({ x, y, s }) => `
    <g transform="translate(${x}, ${y}) scale(${s})" opacity="0.9">
      <line x1="0" y1="-18" x2="0" y2="18" stroke="#FFD700" stroke-width="3" stroke-linecap="round" />
      <line x1="-18" y1="0" x2="18" y2="0" stroke="#FFD700" stroke-width="3" stroke-linecap="round" />
      <line x1="-12" y1="-12" x2="12" y2="12" stroke="#FFD700" stroke-width="2" stroke-linecap="round" />
      <line x1="12" y1="-12" x2="-12" y2="12" stroke="#FFD700" stroke-width="2" stroke-linecap="round" />
    </g>`).join('');

  const footerY = height - 160;
  const ctaY = isStory ? height - 260 : height - 180;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ticket gagnant BetLeague">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stop-color="#0A0015" />
        <stop offset="40%" stop-color="#1A0A3E" />
        <stop offset="70%" stop-color="#0D2847" />
        <stop offset="100%" stop-color="#031A2B" />
      </linearGradient>
      <linearGradient id="glowGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#10B981" stop-opacity="0.35" />
        <stop offset="50%" stop-color="#06B6D4" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0.15" />
      </linearGradient>
      <linearGradient id="gainCard" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#064E3B" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#065F46" stop-opacity="0.7" />
      </linearGradient>
      <linearGradient id="gainGlow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#34D399" />
        <stop offset="100%" stop-color="#10B981" />
      </linearGradient>
      <linearGradient id="multiplierGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#EF4444" />
      </linearGradient>
      <linearGradient id="ctaGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#8B5CF6" />
        <stop offset="100%" stop-color="#06B6D4" />
      </linearGradient>
      <linearGradient id="topBanner" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#06B6D4" />
      </linearGradient>
      <filter id="gainShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="20" flood-color="#10B981" flood-opacity="0.6" />
      </filter>
      <filter id="cardGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="16" flood-color="#10B981" flood-opacity="0.3" />
      </filter>
      <radialGradient id="spotGreen" cx="0.3" cy="0.2" r="0.8">
        <stop offset="0%" stop-color="#10B981" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#10B981" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="spotPurple" cx="0.7" cy="0.8" r="0.6">
        <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" rx="0" fill="url(#bg)" />
    <rect width="${width}" height="${height}" fill="url(#spotGreen)" />
    <rect width="${width}" height="${height}" fill="url(#spotPurple)" />

    <!-- Confetti -->
    ${confettiElements.join('')}

    <!-- Sparkles -->
    ${sparkles}

    <!-- Top banner -->
    <rect x="0" y="0" width="${width}" height="8" fill="url(#topBanner)" />

    <!-- Trophy + TICKET GAGNANT header -->
    <g transform="translate(${cx}, ${isStory ? 140 : 100})">
      <!-- Trophy icon -->
      <g transform="translate(-28, -42) scale(1.4)" fill="#FFD700">
        <path d="M12 2C11 2 10 3 10 4H6C5.4 4 5 4.4 5 5V8C5 10.2 6.8 12 9 12.2V14H8C7.4 14 7 14.4 7 15V17H17V15C17 14.4 16.6 14 16 14H15V12.2C17.2 12 19 10.2 19 8V5C19 4.4 18.6 4 18 4H14C14 3 13 2 12 2ZM7 6H9V10C7.9 10 7 9.1 7 8V6ZM15 6H17V8C17 9.1 16.1 10 15 10V6Z" />
      </g>
      <text x="22" y="0" fill="#FFD700" font-size="46" font-family="Inter, Arial, sans-serif" font-weight="900" text-anchor="start" letter-spacing="4">TICKET GAGNANT</text>
    </g>

    <!-- BetLeague branding -->
    <text x="${cx}" y="${isStory ? 230 : 185}" fill="#FFFFFF" font-size="68" font-family="Inter, Arial, sans-serif" font-weight="800" text-anchor="middle" letter-spacing="2">BetLeague</text>
    <text x="${cx}" y="${isStory ? 285 : 230}" fill="rgba(255,255,255,0.6)" font-size="34" font-family="Inter, Arial, sans-serif" font-weight="600" text-anchor="middle">${escapeXml(leagueName)}</text>

    <!-- Gain card -->
    <rect x="80" y="${isStory ? 340 : 280}" width="${width - 160}" height="${isStory ? 380 : 340}" rx="32" fill="url(#gainCard)" stroke="#34D399" stroke-width="2" filter="url(#cardGlow)" />
    <rect x="80" y="${isStory ? 340 : 280}" width="${width - 160}" height="${isStory ? 380 : 340}" rx="32" fill="url(#glowGrad)" />

    <!-- Gain label -->
    <text x="${cx}" y="${isStory ? 415 : 345}" fill="#6EE7B7" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="800" text-anchor="middle" letter-spacing="6">GAIN TOTAL</text>

    <!-- Gain amount with glow -->
    <text x="${cx}" y="${isStory ? 560 : 485}" fill="#FFFFFF" font-size="${isStory ? 130 : 120}" font-family="Inter, Arial, sans-serif" font-weight="900" text-anchor="middle" filter="url(#gainShadow)">${gainLabel}</text>
    <text x="${cx + (isStory ? 10 : 5)}" y="${isStory ? 560 : 485}" fill="url(#gainGlow)" font-size="${isStory ? 130 : 120}" font-family="Inter, Arial, sans-serif" font-weight="900" text-anchor="middle">${gainLabel}</text>
    <!-- BTL symbol -->
    <text x="${cx}" y="${isStory ? 610 : 535}" fill="#34D399" font-size="48" font-family="Inter, Arial, sans-serif" font-weight="700" text-anchor="middle">BTL</text>

    <!-- Mise + Multiplier row -->
    <text x="${isStory ? 200 : 240}" y="${isStory ? 680 : 595}" fill="rgba(255,255,255,0.7)" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="600" text-anchor="middle">${miseLabel} BTL</text>
    ${multiplierSvg}

    <!-- Ticket ID -->
    <text x="${cx}" y="${isStory ? 760 : 655}" fill="rgba(255,255,255,0.4)" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="600" text-anchor="middle" letter-spacing="2">TICKET ${uuidLabel}</text>

    <!-- Section title for choices -->
    ${choices.length > 0 ? `<text x="80" y="${choiceStartY - 30}" fill="rgba(255,255,255,0.5)" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="700" letter-spacing="4">PRONOSTICS</text>` : ''}

    <!-- Match choice cards -->
    ${svgChoiceCards}
    ${noChoicesPlaceholder}

    <!-- CTA button -->
    <rect x="${cx - 260}" y="${ctaY}" width="520" height="72" rx="36" fill="url(#ctaGrad)" />
    <text x="${cx}" y="${ctaY + 46}" fill="#FFFFFF" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="800" text-anchor="middle">Rejoins-moi sur BetLeague</text>

    <!-- Footer -->
    <text x="${cx}" y="${footerY}" fill="rgba(255,255,255,0.35)" font-size="24" font-family="Inter, Arial, sans-serif" text-anchor="middle">betleague.app</text>
    <text x="${cx}" y="${footerY + 38}" fill="rgba(255,255,255,0.25)" font-size="20" font-family="Inter, Arial, sans-serif" text-anchor="middle">Parie entre amis. Prouve que tu es le meilleur.</text>
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
