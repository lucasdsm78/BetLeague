export interface CompetitionOption {
  value: string;
  label: string;
}

export const WORLD_CUP_2026_COMPETITION = 'Coupe du monde 2026';
export const WORLD_CUP_2026_LEAGUE_ID = 1;

interface CompetitionMetadata {
  leagueId?: number | null;
  season?: number | null;
}

const COMPETITION_LABEL_BY_NORMALIZED_NAME: Record<string, string> = {
  'ligue 1': 'Ligue 1',
  'premier league': 'Premier League',
  'la liga': 'La Liga',
  bundesliga: 'Bundesliga',
  'serie a': 'Serie A',
  'uefa champions league': 'Ligue des champions',
  'champions league': 'Ligue des champions',
};

export const COMPETITIONS: CompetitionOption[] = [
  { value: 'Tous', label: 'Tous' },
  { value: 'Ligue 1', label: 'Ligue 1' },
  { value: 'Premier League', label: 'Premier League' },
  { value: 'La Liga', label: 'La Liga' },
  { value: 'Bundesliga', label: 'Bundesliga' },
  { value: 'Serie A', label: 'Serie A' },
  { value: 'Ligue des champions', label: 'Ligue des champions' },
  { value: WORLD_CUP_2026_COMPETITION, label: WORLD_CUP_2026_COMPETITION },
];

export function getCompetitionLeagueId(competition: string): number | undefined {
  return competition === WORLD_CUP_2026_COMPETITION ? WORLD_CUP_2026_LEAGUE_ID : undefined;
}

export function normalizeCompetitionLabel(competition?: string | null, metadata?: CompetitionMetadata): string {
  const normalized = (competition ?? '').trim();
  if (!normalized) {
    return 'Tous';
  }

  if (metadata?.leagueId === 1) {
    const season = typeof metadata.season === 'number' && Number.isFinite(metadata.season)
      ? Math.trunc(metadata.season)
      : null;
    return season ? `Coupe du monde ${season}` : 'Coupe du monde';
  }

  return COMPETITION_LABEL_BY_NORMALIZED_NAME[normalized.toLowerCase()] ?? normalized;
}



