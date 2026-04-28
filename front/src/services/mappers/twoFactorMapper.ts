import type {
  ApiTwoFactorSetupRawResponse,
  ApiTwoFactorSetupResponse,
} from '../../types/api/profile';
import type { TwoFactorSetup } from '../../types/entities/twoFactor';

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function maskSecret(secret: string): string {
  // Masquage simple pour éviter d'exposer le secret en clair
  // Ex: ABCDEFGHIJ -> ABCD••••••••GHIJ
  const clean = (secret || '').trim();
  if (clean.length <= 8) return '••••••••';
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
}

function mapApiTwoFactorJsonToUi(data: ApiTwoFactorSetupResponse): TwoFactorSetup {
  const qr = typeof data.qr_code === 'string' && data.qr_code.trim().length > 0 ? data.qr_code : undefined;
  const secret = typeof data.secret === 'string' && data.secret.trim().length > 0 ? data.secret : undefined;
  const otpauthUrl = typeof data.otpauth_url === 'string' && data.otpauth_url.trim().length > 0 ? data.otpauth_url : undefined;

  const source: TwoFactorSetup['source'] =
    qr ? 'qr_data_url' : otpauthUrl ? 'otpauth_url' : 'unknown';

  return {
    qrCodeDataUrl: qr,
    secret,
    secretMasked: secret ? maskSecret(secret) : undefined,
    otpauthUrl,
    source,
  };
}

/**
 * Mapper 2FA : convertit la réponse API (Blob ou JSON) vers un modèle UI stable.
 */
export async function mapApiTwoFactorSetupToUi(raw: ApiTwoFactorSetupRawResponse): Promise<TwoFactorSetup> {
  if (typeof Blob !== 'undefined' && raw instanceof Blob) {
    const qrCodeDataUrl = await blobToDataUrl(raw);
    return {
      qrCodeDataUrl,
      source: 'qr_blob',
    };
  }

  return mapApiTwoFactorJsonToUi(raw as ApiTwoFactorSetupResponse);
}
