import { AuthError } from './authService.enhanced';
import {
  apiForgotPasswordConfirm,
  apiForgotPasswordRequest,
  apiForgotPasswordVerify,
} from './api/passwordReset.public';
import type {
  ApiForgotPasswordConfirmResponse,
  ApiForgotPasswordRequestResponse,
  ApiForgotPasswordVerifyResponse,
} from 'types/api/passwordReset';

// Maintient la compatibilité avec les pages existantes
export type ForgotPasswordRequestResponse = ApiForgotPasswordRequestResponse;
export type ForgotPasswordVerifyResponse = ApiForgotPasswordVerifyResponse;
export type ForgotPasswordConfirmResponse = ApiForgotPasswordConfirmResponse;

export async function forgotPasswordRequest(email: string): Promise<ForgotPasswordRequestResponse> {
  try {
    return await apiForgotPasswordRequest({ email });
  } catch (e: any) {
    // Normalise en AuthError si besoin
    if (e instanceof AuthError) throw e;
    throw new AuthError(e?.message || 'Une erreur est survenue', e?.status || 500, e);
  }
}

export async function forgotPasswordVerify(params: {
  email: string;
  challenge_id: string;
  code: string;
}): Promise<ForgotPasswordVerifyResponse> {
  try {
    return await apiForgotPasswordVerify({
      email: params.email,
      challenge_id: params.challenge_id,
      code: params.code,
    });
  } catch (e: any) {
    if (e instanceof AuthError) throw e;
    throw new AuthError(e?.message || 'Une erreur est survenue', e?.status || 500, e);
  }
}

export async function forgotPasswordConfirm(params: {
  email: string;
  challenge_id: string;
  reset_token: string;
  new_password: string;
}): Promise<ForgotPasswordConfirmResponse> {
  try {
    return await apiForgotPasswordConfirm({
      email: params.email,
      challenge_id: params.challenge_id,
      reset_token: params.reset_token,
      new_password: params.new_password,
    });
  } catch (e: any) {
    if (e instanceof AuthError) throw e;
    throw new AuthError(e?.message || 'Une erreur est survenue', e?.status || 500, e);
  }
}
