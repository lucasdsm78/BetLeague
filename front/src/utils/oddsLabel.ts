import type { ApiMatchOddReadModel } from 'types/api/matches';

type BetTypeKey =
  | 'match_winner'
  | 'goals_over_under'
  | 'both_teams_score'
  | 'exact_score'
  | 'double_chance'
  | 'odd_even'
  | 'exact_goals_number';

const BET_TYPE_FR: Record<BetTypeKey, string> = {
  match_winner: 'Résultat du match',
  goals_over_under: 'Plus/Moins de buts',
  both_teams_score: 'Les deux équipes marquent',
  exact_score: 'Score exact',
  double_chance: 'Double chance',
  odd_even: 'Pair/Impair',
  exact_goals_number: 'Nombre exact de buts',
};

function normalizeKey(value: unknown): string {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

// Mapping lisible pour le type de pari.
// Best practice: on utilise bet_type (clé stable) pour traduire.
// On accepte bet_name (souvent EN) et on le normalise en fallback.
export function formatBetTypeLabel(
  odd: Pick<ApiMatchOddReadModel, 'bet_name' | 'bet_type'> | null | undefined
): string {
  const typeKey = normalizeKey(odd?.bet_type);
  if (typeKey && (BET_TYPE_FR as Record<string, string>)[typeKey]) {
    return (BET_TYPE_FR as Record<string, string>)[typeKey];
  }

  // Certains flux peuvent fournir bet_name plus fiable que bet_type
  const betName = (odd?.bet_name ?? '').toString().trim();
  if (betName) {
    const nameKey = normalizeKey(betName);
    // Traductions connues (fuzzy) depuis des libellés EN
    if (nameKey === 'double_chance') return BET_TYPE_FR.double_chance;
    if (nameKey === 'double_chance_bet') return BET_TYPE_FR.double_chance;
    if (nameKey === 'doublechance') return BET_TYPE_FR.double_chance;

    if (nameKey === 'match_winner' || nameKey === 'match_winner_bet' || nameKey === 'winner') return BET_TYPE_FR.match_winner;
    if (nameKey === 'goals_over_under' || nameKey === 'over_under') return BET_TYPE_FR.goals_over_under;
    if (nameKey === 'both_teams_score' || nameKey === 'both_teams_to_score' || nameKey === 'btts') return BET_TYPE_FR.both_teams_score;
    if (nameKey === 'exact_score' || nameKey === 'score_exact') return BET_TYPE_FR.exact_score;
    if (nameKey === 'odd_even' || nameKey === 'odd_even_goals') return BET_TYPE_FR.odd_even;
    if (nameKey === 'exact_goals_number' || nameKey === 'exact_goals') return BET_TYPE_FR.exact_goals_number;

    // Si le back renvoie déjà une chaîne FR, on la garde.
    // Sinon, on la renvoie telle quelle (pas de transformation agressive qui pourrait casser un i18n futur).
    return betName;
  }

  if (!typeKey) return 'Pari';

  // Fallback: rendre un truc lisible
  return typeKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getBetTypeLabelFr(betType: string | null | undefined): string {
  const key = normalizeKey(betType);
  return (BET_TYPE_FR as Record<string, string>)[key] ?? '';
}

type TeamLabels = { home: string; away: string };

function normalizeChoiceValue(value: unknown): string {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '/');
}

/**
 * Traduction de la sélection (choice / odd.value) en français.
 * - Ultra rapide: mapping + concat.
 * - Sûr: pas d'HTML, pas d'exécution, juste des chaînes.
 * - Robuste: gère legacy ('1','N','2') et nouveaux formats ('Draw/Away', 'Home/Draw', 'Over 2.5').
 */
export function formatChoiceLabelFr(params: {
  choice: string | null | undefined;
  betType?: string | null | undefined;
  teams?: TeamLabels | null;
}): string {
  const { choice, betType, teams } = params;
  const raw = (choice ?? '').toString().trim();
  if (!raw) return '';

  // Legacy 1/N/2
  if (raw === '1' && teams?.home) return teams.home;
  if (raw === '2' && teams?.away) return teams.away;
  if (raw.toUpperCase() === 'N') return 'Match nul';

  const bt = normalizeKey(betType);
  const v = normalizeChoiceValue(raw);

  // 1X2 (match_winner)
  if (bt === 'match_winner') {
    if (v === 'home') return teams?.home ?? 'Domicile';
    if (v === 'away') return teams?.away ?? 'Extérieur';
    if (v === 'draw') return 'Match nul';
  }

  // Double chance
  if (bt === 'double_chance') {
    if (v === 'home/draw' || v === 'home/draw/'.replace(/\/$/, '')) return '1/N';
    if (v === 'draw/away' || v === 'draw/away/'.replace(/\/$/, '')) return 'N/2';
    if (v === 'home/away' || v === 'home/away/'.replace(/\/$/, '')) return '1/2';
  }

  // Fallback générique pour valeurs simples
  if (v === 'home') return teams?.home ?? 'Domicile';
  if (v === 'away') return teams?.away ?? 'Extérieur';
  if (v === 'draw') return 'Match nul';
  if (v === 'home/draw') return 'Domicile ou nul';
  if (v === 'draw/away') return 'Nul ou extérieur';
  if (v === 'home/away') return 'Domicile ou extérieur';

  // On conserve les marchés type Over 2.5 / Under 2.5: souvent déjà lisibles.
  // Petites normalisations EN -> FR (sans être agressif)
  const normalized = raw
    .replace(/^Over\s+/i, 'Plus de ')
    .replace(/^Under\s+/i, 'Moins de ')
    .replace(/^Yes$/i, 'Oui')
    .replace(/^No$/i, 'Non');

  return normalized;
}
