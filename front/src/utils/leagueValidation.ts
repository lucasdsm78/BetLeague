import type { ValidationResult } from '../types/validation';

// ValidationResult local (léger) pour éviter de dépendre d'un service réseau
export interface LeagueNameValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validation du nom de ligue (UI side).
 * - Anti-XSS: rejette des caractères dangereux
 * - Anti-pattern: bloque des substrings courants d'injection
 */
export function validateLeagueName(name: string): LeagueNameValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Le nom est requis' };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 3) {
    return { isValid: false, error: 'Minimum 3 caractères requis' };
  }

  if (trimmedName.length > 50) {
    return { isValid: false, error: 'Maximum 50 caractères autorisés' };
  }

  const forbiddenChars = /[<>/\\&"'`]/;
  if (forbiddenChars.test(trimmedName)) {
    return { isValid: false, error: 'Caractères non autorisés détectés' };
  }

  const suspiciousPatterns = /(script|javascript|eval|onclick|onerror)/i;
  if (suspiciousPatterns.test(trimmedName)) {
    return { isValid: false, error: 'Nom de ligue non autorisé' };
  }

  if (trimmedName !== trimmedName.replace(/\s+/g, ' ')) {
    return { isValid: false, error: 'Espaces multiples non autorisés' };
  }

  return { isValid: true };
}

