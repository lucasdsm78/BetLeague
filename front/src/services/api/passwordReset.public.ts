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

function unwrapOrThrow<T>(res: { data?: T }) {
  if (res.data) return res.data;
  throw new AuthError('Une erreur est survenue', 0, 'REQUEST_FAILED');
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
