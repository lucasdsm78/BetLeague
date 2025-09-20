/**
 * Authentication Service - TypeScript version
 * Secure authentication with comprehensive error handling
 */

import { apiClient, ApiClientError } from './apiClient';
import type {
  User,
  LoginForm,
  RegisterForm,
  ApiResponse,
  SecurityContext,
  LoginResponse as ApiLoginResponse,
  RegisterResponse as ApiRegisterResponse
} from '../types';

// Types de retour locaux pour ce service (structures actuelles)
type LoginResponse = ApiLoginResponse;
type RegisterResponse = ApiRegisterResponse;

export interface ValidateTokenResponse {
  user: User;
  valid: boolean;
  expires_at: string;
  permissions?: string[];
  roles?: string[];
}

// Custom Authentication Error
export class AuthError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly data?: unknown;

  constructor(message: string, status: number = 0, code?: string, data?: unknown) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
    this.data = data;
  }

  // Error type checkers
  isNetworkError(): boolean {
    return this.status === 0;
  }

  isTimeout(): boolean {
    return this.status === 408;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isConflict(): boolean {
    return this.status === 409;
  }

  isTooManyRequests(): boolean {
    return this.status === 429;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isValidationError(): boolean {
    return this.status === 422;
  }

  // Get user-friendly error message
  getDisplayMessage(): string {
    if (this.isNetworkError()) {
      return 'Erreur de connexion. Vérifiez votre réseau.';
    }

    if (this.isTimeout()) {
      return 'Timeout. Vérifiez votre connexion.';
    }

    if (this.isUnauthorized()) {
      return 'Session expirée. Veuillez vous reconnecter.';
    }

    if (this.isTooManyRequests()) {
      return 'Trop de tentatives. Réessayez plus tard.';
    }

    if (this.isServerError()) {
      return 'Erreur serveur. Réessayez plus tard.';
    }

    if (this.isValidationError()) {
      return 'Données invalides. Vérifiez vos informations.';
    }

    return this.message;
  }
}

// Login attempt tracking for security
class LoginAttemptTracker {
  private attempts: Map<string, { count: number; lastAttempt: number; lockedUntil?: number }> = new Map();

  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly ATTEMPT_WINDOW = 60 * 60 * 1000; // 1 hour

  isBlocked(identifier: string): boolean {
    const record = this.attempts.get(identifier);
    if (!record) return false;

    // Check if still locked
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      return true;
    }

    // Reset if window expired
    if (Date.now() - record.lastAttempt > this.ATTEMPT_WINDOW) {
      this.attempts.delete(identifier);
      return false;
    }

    return record.count >= this.MAX_ATTEMPTS;
  }

  recordAttempt(identifier: string, success: boolean): void {
    const now = Date.now();
    const record = this.attempts.get(identifier) || { count: 0, lastAttempt: 0 };

    if (success) {
      // Clear on success
      this.attempts.delete(identifier);
      return;
    }

    // Increment failed attempts
    record.count += 1;
    record.lastAttempt = now;

    if (record.count >= this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_DURATION;
    }

    this.attempts.set(identifier, record);
  }

  getBlockTimeRemaining(identifier: string): number {
    const record = this.attempts.get(identifier);
    if (!record?.lockedUntil) return 0;

    return Math.max(0, record.lockedUntil - Date.now());
  }
}

// Authentication Service Class
export class AuthService {
  private readonly loginTracker = new LoginAttemptTracker();
  private readonly TOKEN_KEY = 'authToken';
  private readonly REFRESH_TOKEN_KEY = 'refreshToken';

  // Input validation and sanitization
  private validateEmail(email: string): string {
    const trimmed = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
      throw new AuthError('Format d\'email invalide', 400, 'INVALID_EMAIL');
    }

    // Basic email sanitization
    if (trimmed.length > 320) { // RFC 5321 limit
      throw new AuthError('Email trop long', 400, 'EMAIL_TOO_LONG');
    }

    return trimmed;
  }

  private validatePassword(password: string): string {
    if (!password || typeof password !== 'string') {
      throw new AuthError('Mot de passe requis', 400, 'PASSWORD_REQUIRED');
    }

    if (password.length < 6) {
      throw new AuthError('Mot de passe trop court (minimum 6 caractères)', 400, 'PASSWORD_TOO_SHORT');
    }

    if (password.length > 128) {
      throw new AuthError('Mot de passe trop long (maximum 128 caractères)', 400, 'PASSWORD_TOO_LONG');
    }

    return password;
  }

  private validatePseudo(pseudo: string): string {
    const trimmed = pseudo.trim();

    if (!trimmed) {
      throw new AuthError('Pseudo requis', 400, 'PSEUDO_REQUIRED');
    }

    if (trimmed.length < 2) {
      throw new AuthError('Pseudo trop court (minimum 2 caractères)', 400, 'PSEUDO_TOO_SHORT');
    }

    if (trimmed.length > 50) {
      throw new AuthError('Pseudo trop long (maximum 50 caractères)', 400, 'PSEUDO_TOO_LONG');
    }

    // Only allow alphanumeric characters, spaces, and basic punctuation
    if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(trimmed)) {
      throw new AuthError('Pseudo contient des caractères non autorisés', 400, 'PSEUDO_INVALID_CHARS');
    }

    return trimmed;
  }

  // Secure token storage - Use Zustand store as source of truth
  private storeToken(token: string, refreshToken?: string): void {
    try {
      // Primary storage in Zustand store is handled by login method
      // Also store in legacy location for backward compatibility
      localStorage.setItem(this.TOKEN_KEY, token);
      if (refreshToken) {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (error) {
      console.warn('Failed to store authentication token:', error);
    }
  }

  private getToken(): string | null {
    try {
      // First, try to get from Zustand store (most reliable)
      const authStore = localStorage.getItem('auth-store');
      if (authStore) {
        const parsed = JSON.parse(authStore);
        if (parsed?.state?.token) {
          return parsed.state.token;
        }
      }

      // Fallback to legacy storage
      return localStorage.getItem(this.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private getRefreshToken(): string | null {
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private clearTokens(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      // Note: Zustand store clearing is handled by the store itself
    } catch (error) {
      console.warn('Failed to clear tokens:', error);
    }
  }

  // Convert API errors to AuthError
  private handleApiError(error: any): never {
    if (error instanceof ApiClientError) {
      throw new AuthError(
        error.message,
        error.status,
        error.code,
        error.details
      );
    }

    if (error instanceof Error) {
      throw new AuthError(error.message, 0, 'UNKNOWN_ERROR', error);
    }

    throw new AuthError('Une erreur inconnue s\'est produite', 0);
  }

  // Public API Methods
  async login(credentials: LoginForm): Promise<LoginResponse> {

    try {
      // Validate and sanitize input
      const email = this.validateEmail(credentials.email);
      const password = this.validatePassword(credentials.password);

      // Check for rate limiting
      if (this.loginTracker.isBlocked(email)) {
        const blockTime = this.loginTracker.getBlockTimeRemaining(email);
        const minutes = Math.ceil(blockTime / 60000);
        throw new AuthError(
          `Compte temporairement bloqué. Réessayez dans ${minutes} minute(s).`,
          429,
          'ACCOUNT_LOCKED'
        );
      }

      const payload = {
        email,
        password,
        code: credentials.code || "string",
      };

      const response: any = await apiClient.post('/auth/login', payload);

      if (!response.success || !response.data) {
        throw new AuthError('Réponse invalide du serveur', 500);
      }

      // Validate response structure (API returns: {token_auth, uuid, token_expiration})
      if (!response.data?.token_auth || !response.data?.uuid) {
        throw new AuthError('Données de connexion incomplètes', 500);
      }

      // Store authentication tokens
      this.storeToken(response.data.token_auth);

      // Record successful login
      this.loginTracker.recordAttempt(email, true);

      return response;

    } catch (error) {
      // Record failed login attempt
      if (credentials.email) {
        this.loginTracker.recordAttempt(credentials.email.toLowerCase().trim(), false);
      }

      this.handleApiError(error);
    }
  }

  async register(credentials: RegisterForm): Promise<RegisterResponse> {
    try {

      // Validate and sanitize input
      const email = this.validateEmail(credentials.email);
      const password = this.validatePassword(credentials.password);
      const pseudo = this.validatePseudo(credentials.pseudo);

      // Validate password confirmation
      if (password !== credentials.confirmPassword) {
        throw new AuthError('Les mots de passe ne correspondent pas', 400, 'PASSWORDS_MISMATCH');
      }

      // Validate terms acceptance
      if (!credentials.acceptTerms) {
        throw new AuthError('Vous devez accepter les conditions d\'utilisation', 400, 'TERMS_NOT_ACCEPTED');
      }

      const payload = {
        pseudo,
        email,
        password,
      };

      const response: any = await apiClient.post('/auth/register', payload);

      if (!response.success || !response.data) {
        throw new AuthError('Réponse invalide du serveur', 500);
      }

      // Validate response structure (API returns: {token_auth, uuid, token_expiration})
      if (!response.data?.token_auth || !response.data?.uuid) {
        throw new AuthError('Données d\'inscription incomplètes', 500);
      }

      // Store authentication token
      this.storeToken(response.data.token_auth);

      return response;

    } catch (error) {
      this.handleApiError(error);
    }
  }

  async validateToken(): Promise<ValidateTokenResponse> {
    try {
      const token = this.getToken();

      if (!token) {
        throw new AuthError('Aucun token trouvé', 401, 'NO_TOKEN');
      }

      const response = await apiClient.get<ValidateTokenResponse>('/auth/validate');

      if (!response.success || !response.data) {
        throw new AuthError('Validation du token échouée', 401, 'INVALID_TOKEN');
      }

      return response.data;

    } catch (error) {
      // Clear invalid tokens
      if (error instanceof AuthError && error.isUnauthorized()) {
        this.clearTokens();
      }

      this.handleApiError(error);
    }
  }

  async refreshToken(): Promise<LoginResponse> {
    try {
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        throw new AuthError('Aucun refresh token trouvé', 401, 'NO_REFRESH_TOKEN');
      }

      const response: any = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken,
      });

      if (!response.success || !response.data) {
        throw new AuthError('Actualisation du token échouée', 401, 'REFRESH_FAILED');
      }

      // Store new tokens
      this.storeToken(response.data.token_auth);

      return response.data;

    } catch (error) {
      // Clear invalid tokens
      this.clearTokens();
      this.handleApiError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      const token = this.getToken();

      if (token) {
        // Attempt to logout on server (don't fail if it doesn't work)
        try {
          await apiClient.post('/auth/logout');
        } catch {
          // Ignore logout errors - clear local tokens anyway
        }
      }

      // Always clear local tokens
      this.clearTokens();

    } catch (error) {
      // Always clear tokens, even if logout fails
      this.clearTokens();
      console.warn('Logout error (tokens cleared anyway):', error);
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getCurrentToken(): string | null {
    return this.getToken();
  }

  // Password strength checker
  checkPasswordStrength(password: string): {
    score: number;
    feedback: string[];
    isStrong: boolean;
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push('Au moins 8 caractères');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Au moins une minuscule');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Au moins une majuscule');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Au moins un chiffre');

    if (/[^a-zA-Z\d]/.test(password)) score += 1;
    else feedback.push('Au moins un caractère spécial');

    return {
      score,
      feedback,
      isStrong: score >= 4,
    };
  }
}

// Create and export singleton instance
export const authService = new AuthService();

export default authService;
