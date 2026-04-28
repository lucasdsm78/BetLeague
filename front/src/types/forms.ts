/**
 * Types UI - Forms
 *
 * Ces types sont utilisés côté front pour typer les formulaires.
 * Ils ne représentent pas nécessairement les DTO API exacts.
 */

export interface LoginForm {
  readonly email: string;
  readonly password: string;
  readonly code?: string;
  readonly rememberMe?: boolean;
}

export interface RegisterForm {
  readonly pseudo: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly acceptTerms: boolean;
}

export interface LeagueCreateForm {
  readonly name: string;
  readonly maxMembers: number;
  readonly type: 'public' | 'private';
  readonly entryFee: number;
  readonly description?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}
