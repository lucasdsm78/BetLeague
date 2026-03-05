import type { ApiMatchOddReadModel } from 'types/api/matches';

// Mapping lisible pour le type de pari.
// On préfère bet_name (fourni par le back) et on fallback sur bet_type.
export function formatBetTypeLabel(odd: Pick<ApiMatchOddReadModel, 'bet_name' | 'bet_type'> | null | undefined): string {
  const betName = (odd?.bet_name ?? '').toString().trim();
  if (betName) {
    const normalized = betName.toLowerCase();
    // Normalisation/FR: le back peut renvoyer "Double Chance" (EN). On veut afficher "Double chance".
    if (normalized === 'double chance') return 'Double chance';
    if (normalized === 'double_chance') return 'Double chance';
    if (normalized === 'doublechance') return 'Double chance';
    return betName;
  }

  const betType = (odd?.bet_type ?? '').toString().trim();
  if (!betType) return 'Pari';

  const normalizedType = betType.toLowerCase();
  if (normalizedType === 'double_chance' || normalizedType === 'double chance') return 'Double chance';

  // Fallback: rendre un truc lisible
  return betType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
