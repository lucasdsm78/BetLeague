// Entités UI - Two Factor Authentication (2FA)

export type TwoFactorSetupSource = 'qr_blob' | 'qr_data_url' | 'otpauth_url' | 'unknown';

export interface TwoFactorSetup {
  /**
   * QR Code sous forme d'image data URL (affichable directement dans <img src="..." />)
   */
  qrCodeDataUrl?: string;

  /**
   * Secret TOTP.
   *
   * Par défaut, on recommande de ne pas l'afficher en clair dans l'UI.
   * Utiliser `secretMasked` + bouton "Afficher / Copier".
   */
  secret?: string;
  secretMasked?: string;

  /**
   * Lien otpauth:// (pour ajout direct dans certaines apps)
   */
  otpauthUrl?: string;

  /**
   * Indique l'origine/format reçu depuis l'API (utile debug/compat)
   */
  source: TwoFactorSetupSource;
}

export interface TwoFactorStatus {
  enabled: boolean;
  message?: string;
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
  sessionsRevoked?: boolean;
  reauthRequired?: boolean;
}

export interface DisableTwoFactorPayload {
  currentPassword: string;
  code: string;
}
