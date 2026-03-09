export const FORGOT_PASSWORD_REQUEST_STORAGE_KEY = 'bl.forgotPassword.request';
export const FORGOT_PASSWORD_VERIFY_STORAGE_KEY = 'bl.forgotPassword.verify';
export const MIN_FORGOT_PASSWORD_CHALLENGE_ID_LENGTH = 10;

// Fallback aligné sur le défaut backend (password_reset_challenge_ttl_s = 600s)
export const BACKEND_DEFAULT_CHALLENGE_TTL_SECONDS = 600;

export function ttlSecondsToExpiresAt(ttlSeconds: number, fallbackSeconds = BACKEND_DEFAULT_CHALLENGE_TTL_SECONDS): number {
  const normalizedTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : fallbackSeconds;
  return Date.now() + normalizedTtl * 1000;
}

