/**
 * Types API - Change password (authentifié)
 */

export type ApiChangePasswordRequest = {
  readonly current_password: string;
  readonly new_password: string;
  readonly two_fa_code?: string;
};

export type ApiChangePasswordResponse = {
  readonly message: string;
  readonly reauth_required: boolean;
};

