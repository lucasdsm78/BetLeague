export interface ApiTournamentCreationAccess {
  monthly_free_tournaments_limit: number;
  monthly_free_tournaments_used: number;
  monthly_free_tournaments_remaining: number;
  has_active_subscription: boolean;
  can_create_tournament: boolean;
  requires_tournament_subscription: boolean;
}

export interface ApiUserProfile {
  id: number;
  email: string;
  pseudo: string;
  nb_win: number;
  nb_lose: number;
  nb_btl: number;
  is_tournament_subscriber?: boolean;
  is_two_factor_enabled?: boolean;
  tournament_creation_access?: ApiTournamentCreationAccess;
}

// 2FA
export interface ApiTwoFactorSetupResponse {
  // Dans la majorité des cas on reçoit une image (data URL) du QR code
  qr_code?: string;
  // Optionnels: selon backend, secret/otpauth peuvent exister
  secret?: string;
  otpauth_url?: string;
}

// Certaines implémentations renvoient directement une image (Blob/PNG)
export type ApiTwoFactorSetupRawResponse = Blob | ApiTwoFactorSetupResponse;

// --------------------
// DTOs: profile updates
// --------------------

export interface ApiUpdateUserPayload {
  pseudo?: string;
  email?: string;
}

export interface ApiUpdateUserResponse {
  message?: string;
  user?: ApiUserProfile;
  // certains back renvoient directement le user
  id?: number;
  email?: string;
  pseudo?: string;
  nb_win?: number;
  nb_lose?: number;
  nb_btl?: number;
  is_tournament_subscriber?: boolean;
  is_two_factor_enabled?: boolean;
  tournament_creation_access?: ApiTournamentCreationAccess;
}

// Legacy compat (userProfile.ts)
export type ApiUpdateProfileData = ApiUpdateUserPayload;
export interface ApiUpdateProfileResponse {
  message: string;
  token_auth?: string;
  refresh_token?: string;
  user?: ApiUserProfile;
}

// --------------------
// DTOs: 2FA verification and disable
// --------------------

export interface ApiTwoFactorVerifyPayload {
  code: string;
}

export interface ApiTwoFactorStatusResponse {
  enabled: boolean;
  message?: string;
  attempts_remaining?: number;
}

export interface ApiDisableTwoFactorPayload {
  current_password: string;
  code: string;
}

export interface ApiDisableTwoFactorResponse {
  enabled: boolean;
  message?: string;
  sessions_revoked?: boolean;
  reauth_required?: boolean;
}
