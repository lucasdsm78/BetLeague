import { AuthError } from './authService.enhanced';

// NOTE: on reste volontairement simple ici et on s'aligne sur le client fetch existant.
// Si tu as déjà un client http centralisé (axios/fetch wrapper), on pourra le brancher.

export type ForgotPasswordRequestResponse = {
  challenge_id?: string;
  message?: string;
};

export type ForgotPasswordVerifyResponse = {
  reset_token: string;
  expires_in_seconds: number;
};

export type ForgotPasswordConfirmResponse = {
  message: string;
};

const normalizeApiBase = (rawBase: string): string => {
  const base = rawBase.replace(/\/$/, '');
  if (!base) return '';
  return base.endsWith('/api') ? base : `${base}/api`;
};

const API_BASE = normalizeApiBase(
  (process.env.REACT_APP_API_URL as string | undefined) ?? 'http://localhost:8001'
);

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function normalizeError(res: Response, payload: any): Error {
  const msg = payload?.detail?.message || payload?.detail || payload?.message || 'Une erreur est survenue';
  // Réutilise AuthError si dispo (meilleure UX côté app)
  return new AuthError(msg, res.status, payload);
}

export async function forgotPasswordRequest(email: string): Promise<ForgotPasswordRequestResponse> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const payload = await safeJson(res);
  if (!res.ok) throw normalizeError(res, payload);
  return payload;
}

export async function forgotPasswordVerify(params: {
  email: string;
  challenge_id: string;
  code: string;
}): Promise<ForgotPasswordVerifyResponse> {
  const res = await fetch(`${API_BASE}/auth/forgot-password/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      challenge_id: params.challenge_id,
      code: params.code,
    }),
  });
  const payload = await safeJson(res);
  if (!res.ok) throw normalizeError(res, payload);
  return payload;
}

export async function forgotPasswordConfirm(params: {
  email: string;
  challenge_id: string;
  reset_token: string;
  new_password: string;
}): Promise<ForgotPasswordConfirmResponse> {
  const res = await fetch(`${API_BASE}/auth/forgot-password/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      challenge_id: params.challenge_id,
      reset_token: params.reset_token,
      new_password: params.new_password,
    }),
  });
  const payload = await safeJson(res);
  if (!res.ok) throw normalizeError(res, payload);
  return payload;
}
