import http from 'services/http';
import { AuthError } from 'services/authService.enhanced';
import type {
  ApiForgotPasswordConfirmBody,
  ApiForgotPasswordConfirmResponse,
  ApiForgotPasswordRequestBody,
  ApiForgotPasswordRequestResponse,
  ApiForgotPasswordVerifyBody,
  ApiForgotPasswordVerifyResponse,
} from 'types/api/passwordReset';

const REQUEST_TIMEOUT_MS = 12_000;

function codeFromStatus(status: number): string {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408) return 'TIMEOUT';
  if (status === 422) return 'UNPROCESSABLE_ENTITY';
  if (status === 429) return 'TOO_MANY_REQUESTS';
  if (status >= 500) return 'SERVER_ERROR';
  return 'REQUEST_FAILED';
}

function unwrapOrThrow<T>(res: { success: boolean; data?: T; error?: string; status: number; message?: string }) {
  if (res.success && res.data) return res.data;
  const msg = res.message || res.error || 'Une erreur est survenue';
  throw new AuthError(msg, res.status, codeFromStatus(res.status), res.status >= 500 || res.status === 429);
}

/**
 * Endpoints publics forgot-password (pas d’auth requise).
 * On force skipAuth pour éviter d’ajouter des headers inutiles.
 */
export async function apiForgotPasswordRequest(body: ApiForgotPasswordRequestBody) {
  const res = await http.post<ApiForgotPasswordRequestResponse>('/auth/forgot-password', body, {
    skipAuth: true,
    timeout: REQUEST_TIMEOUT_MS,
    skipRetry: true,
  });
  return unwrapOrThrow(res);
}

export async function apiForgotPasswordVerify(body: ApiForgotPasswordVerifyBody) {
  const res = await http.post<ApiForgotPasswordVerifyResponse>('/auth/forgot-password/verify', body, {
    skipAuth: true,
    timeout: REQUEST_TIMEOUT_MS,
    skipRetry: true,
  });
  return unwrapOrThrow(res);
}

export async function apiForgotPasswordConfirm(body: ApiForgotPasswordConfirmBody) {
  const res = await http.post<ApiForgotPasswordConfirmResponse>('/auth/forgot-password/confirm', body, {
    skipAuth: true,
    timeout: REQUEST_TIMEOUT_MS,
    skipRetry: true,
  });
  return unwrapOrThrow(res);
}
