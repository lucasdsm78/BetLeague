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

export interface VerifyTwoFactorPayload {
  code: string;
}

