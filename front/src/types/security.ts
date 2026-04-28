/**
 * Types UI - Security
 *
 * Contexte de sécurité côté client (permissions, rôles, session).
 * Source: store Zustand + headers API.
 */

export interface SecurityContext {
  readonly permissions: readonly string[];
  readonly roles: readonly string[];
  readonly sessionId: string;
  readonly lastActivity: string;
  readonly deviceFingerprint?: string;
}

