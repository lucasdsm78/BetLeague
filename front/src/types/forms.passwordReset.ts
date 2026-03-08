/**
 * Types UI - Password reset
 */

export type ForgotPasswordStep = 'request' | 'verify' | 'confirm' | 'done';

export type ForgotPasswordJourneyV1 = {
  readonly v: 1;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly email: string;
  readonly challengeId?: string;
  readonly resetToken?: string;
  readonly resetTokenExpiresAt?: number;
};

