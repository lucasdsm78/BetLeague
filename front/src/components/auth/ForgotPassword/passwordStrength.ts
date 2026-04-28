export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4 | 5;

const COMMON_PASSWORDS = new Set([
  'password',
  '12345678',
  'qwerty123',
  'azerty123',
  '11111111',
  '00000000',
  'letmein',
]);

function hasLower(s: string) { return /[a-z]/.test(s); }
function hasUpper(s: string) { return /[A-Z]/.test(s); }
function hasDigit(s: string) { return /[0-9]/.test(s); }
function hasSpecial(s: string) { return /[^a-zA-Z0-9]/.test(s); }

export function evaluatePassword(pw: string): {
  level: PasswordStrengthLevel;
  label: string;
  color: string;
  valid: boolean;
  reasons: string[];
} {
  const p = pw || '';
  const reasons: string[] = [];

  if (p.length < 8) reasons.push('Au moins 8 caractères');
  if (p.length > 256) reasons.push('Trop long');

  const lower = hasLower(p);
  const upper = hasUpper(p);
  const digit = hasDigit(p);
  const special = hasSpecial(p);

  const categories = [lower, upper, digit, special].filter(Boolean).length;

  if (categories < 3) reasons.push('Utilise au moins 3 catégories (maj/min/chiffres/spéciaux)');

  if (COMMON_PASSWORDS.has(p.toLowerCase())) reasons.push('Mot de passe trop commun');

  // scoring simple, rapide, sans lib externe
  let score = 0;
  if (p.length >= 8) score += 1;
  if (p.length >= 12) score += 1;
  if (categories >= 2) score += 1;
  if (categories >= 3) score += 1;
  if (categories === 4) score += 1;

  const level = Math.max(0, Math.min(5, score)) as PasswordStrengthLevel;

  const palette: Record<PasswordStrengthLevel, { label: string; color: string }> = {
    0: { label: 'Très faible', color: '#EF4444' },
    1: { label: 'Faible', color: '#F97316' },
    2: { label: 'Moyen', color: '#F59E0B' },
    3: { label: 'Bon', color: '#10B981' },
    4: { label: 'Fort', color: '#059669' },
    5: { label: 'Très fort', color: '#047857' },
  };

  const valid = reasons.length === 0;

  return { level, label: palette[level].label, color: palette[level].color, valid, reasons };
}

