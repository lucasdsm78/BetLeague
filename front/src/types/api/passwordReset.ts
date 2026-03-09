/**
 * Types API - Password reset (forgot-password)
 */

export type ApiForgotPasswordRequestBody = {
  readonly email: string;
};

export type ApiForgotPasswordRequestResponse = {
  readonly challenge_id: string;
  readonly expires_in_seconds: number;
  readonly message: string;
};

export type ApiForgotPasswordVerifyBody = {
  readonly email: string;
  readonly challenge_id: string;
  readonly code: string;
};

export type ApiForgotPasswordVerifyResponse = {
  readonly reset_token: string;
  readonly expires_in_seconds: number;
};

export type ApiForgotPasswordConfirmBody = {
  readonly email: string;
  readonly challenge_id: string;
  readonly reset_token: string;
  readonly new_password: string;
};

export type ApiForgotPasswordConfirmResponse = {
  readonly message: string;
};
