import React, { useState, useCallback, memo, useMemo, useEffect, useRef } from 'react';
import './TicketsSection.css';
import {
  useInProgressTicketsQuery,
  useFinishedTicketsQuery,
  useInvalidateTickets,
  type TicketsServerFilter,
  useInProgressTicketsMetaQuery,
  useFinishedTicketsMetaQuery,
} from '../../hooks/queries/useTicketsQueries';
import { resolveTicketsFilterMode } from '../../hooks/queries/ticketsMode';
import type { TicketReadModel, MatchChoiceSummary } from '../../types/entities/ticket';
import TicketDetailModal from './TicketDetailModal';
import DeleteTicketModal from './DeleteTicketModal';
import { deleteTicket as apiDeleteTicket } from 'services/api/tickets';
import { useGlobalToast } from '../../toast/ToastProvider';
import { useProfileMeQuery } from '../../hooks/queries/useProfileQuery';
import { formatBetTypeLabel, formatChoiceLabelFr } from '../../utils/oddsLabel';
import { useMyLeaguesQuery } from '../../hooks/queries/useLeaguesLiteQueries';

type TabType = 'current' | 'finished';

type FilterType = 'all' | 'league' | 'tournament';

interface TicketFilter {
  type: FilterType;
  id?: number;
  label: string;
}

interface LeagueOption {
  id: number;
  name: string;
}

const FILTER_ALL: TicketFilter = { type: 'all', label: 'Tous' };
const FILTER_TOURNAMENT: TicketFilter = { type: 'tournament', label: 'Tournois' };

function extractLeagueOptions(tickets: TicketReadModel[]): LeagueOption[] {
  const map = new Map<number, string>();
  for (const t of tickets) {
    if (t.league_summary?.id && t.league_summary.name) {
      map.set(t.league_summary.id, t.league_summary.name);
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function hasTournamentTickets(tickets: TicketReadModel[]): boolean {
  return tickets.some(t => t.tournament_match_summary != null);
}

function applyFilter(tickets: TicketReadModel[], filter: TicketFilter): TicketReadModel[] {
  if (filter.type === 'all') return tickets;
  if (filter.type === 'league') {
    return tickets.filter(t => t.league_summary?.id === filter.id);
  }
  return tickets.filter(t => t.tournament_match_summary != null);
}

const IconAll = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IconLeague = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const IconTournament = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15l-2 5l6-3l6 3l-2-5" transform="translate(-6, -4) scale(0.75)" /><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
  </svg>
);

const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconClear = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const TicketFilterBar: React.FC<{
  leagues: LeagueOption[];
  hasTournaments: boolean;
  active: TicketFilter;
  onChange: (f: TicketFilter) => void;
}> = memo(({ leagues, hasTournaments, active, onChange }) => {
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasFilters = leagues.length > 0 || hasTournaments;

  useEffect(() => {
    if (!leagueDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLeagueDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [leagueDropdownOpen]);

  useEffect(() => {
    if (!leagueDropdownOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLeagueDropdownOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [leagueDropdownOpen]);

  if (!hasFilters) return null;

  const isAllActive = active.type === 'all';
  const isLeagueActive = active.type === 'league';
  const isTournamentActive = active.type === 'tournament';
  const leagueChipLabel = isLeagueActive ? active.label : 'Ligues';

  const handleLeagueChipClick = () => {
    if (leagues.length === 1) {
      if (isLeagueActive && active.id === leagues[0].id) {
        onChange(FILTER_ALL);
      } else {
        onChange({ type: 'league', id: leagues[0].id, label: leagues[0].name });
      }
    } else {
      setLeagueDropdownOpen(prev => !prev);
    }
  };

  const handleLeagueSelect = (league: LeagueOption) => {
    onChange({ type: 'league', id: league.id, label: league.name });
    setLeagueDropdownOpen(false);
  };

  const handleClearLeague = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(FILTER_ALL);
    setLeagueDropdownOpen(false);
  };

  return (
    <div className="ticket-filter-bar" role="group" aria-label="Filtrer par ligue ou tournoi">
      <button
        type="button"
        className={`filter-chip filter-chip--all${isAllActive ? ' active' : ''}`}
        onClick={() => onChange(FILTER_ALL)}
        aria-pressed={isAllActive}
      >
        <span className="filter-chip-icon" aria-hidden="true"><IconAll /></span>
        <span className="filter-chip-label">Tous</span>
      </button>

      {leagues.length > 0 && (
        <div className="filter-chip-dropdown-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className={`filter-chip filter-chip--league${isLeagueActive ? ' active' : ''}`}
            onClick={handleLeagueChipClick}
            aria-pressed={isLeagueActive}
            aria-expanded={leagueDropdownOpen}
            aria-haspopup={leagues.length > 1 ? 'listbox' : undefined}
          >
            <span className="filter-chip-icon" aria-hidden="true"><IconLeague /></span>
            <span className="filter-chip-label">{leagueChipLabel}</span>
            {isLeagueActive && (
              <span
                className="filter-chip-clear"
                onClick={handleClearLeague}
                role="button"
                aria-label="Retirer le filtre ligue"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClearLeague(e as any); }}
              >
                <IconClear />
              </span>
            )}
            {!isLeagueActive && leagues.length > 1 && (
              <span className="filter-chip-chevron" aria-hidden="true"><IconChevron /></span>
            )}
          </button>

          {leagueDropdownOpen && leagues.length > 1 && (
            <ul className="filter-dropdown" role="listbox" aria-label="Sélectionner une ligue">
              {leagues.map((l) => (
                <li
                  key={l.id}
                  role="option"
                  aria-selected={isLeagueActive && active.id === l.id}
                  className={`filter-dropdown-item${isLeagueActive && active.id === l.id ? ' selected' : ''}`}
                  onClick={() => handleLeagueSelect(l)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLeagueSelect(l); }}
                  tabIndex={0}
                >
                  {l.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasTournaments && (
        <button
          type="button"
          className={`filter-chip filter-chip--tournament${isTournamentActive ? ' active' : ''}`}
          onClick={() => onChange(isTournamentActive ? FILTER_ALL : FILTER_TOURNAMENT)}
          aria-pressed={isTournamentActive}
        >
          <span className="filter-chip-icon" aria-hidden="true"><IconTournament /></span>
          <span className="filter-chip-label">Tournois</span>
        </button>
      )}
    </div>
  );
});
TicketFilterBar.displayName = 'TicketFilterBar';

type StatusLabel = 'En cours' | 'Gagné' | 'Perdu' | 'Brouillon';

const normalizeStatus = (status?: string | null): string => (status || '').toLowerCase();

const statusToLabel = (status: string): StatusLabel => {
  switch (normalizeStatus(status)) {
    case 'pending':
      return 'En cours';
    case 'correct':
      return 'Gagné';
    case 'wrong':
      return 'Perdu';
    default:
      return 'En cours';
  }
};

const ChoiceLabel: React.FC<{ choice: MatchChoiceSummary; className?: string }> = ({ choice, className }) => {
  const { match_summary, choice: c } = choice;
  // Nouveau format (back): c est le libellé d'odd (ex: "Draw/Away", "Home/Draw", "Over 2.5").
  // Ancien format: c peut être '1'/'N'/'2'.

  const betTypeLabel = formatBetTypeLabel(choice.match_odd_summary ?? null);
  const translatedChoice = formatChoiceLabelFr({
    choice: c,
    betType: choice.match_odd_summary?.bet_type,
    teams: { home: match_summary.home_team, away: match_summary.away_team },
  });

  // Compat legacy (si jamais on ne peut pas traduire)
  const legacyLabel = c === '1' ? match_summary.home_team : c === '2' ? match_summary.away_team : c === 'N' ? 'Match nul' : '';
  const label = translatedChoice || legacyLabel || c || '';

  return (
    <span className={`chip choice ${className || ''}`.trim()}>
      {match_summary.home_team} vs {match_summary.away_team} · <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{betTypeLabel}:</span>{' '}
      <strong>{label}</strong>
    </span>
  );
};

interface InProgressTicketCardProps {
  ticket: TicketReadModel;
  onView: (id: number) => void;
  onDelete: (id: number) => void;
}

const InProgressTicketCard = memo<InProgressTicketCardProps>(({ ticket, onView, onDelete }) => {
  const leagueName = ticket.league_summary?.name || 'Ligues';
  const potentialGain = Number(ticket.gain ?? 0); // backend returns gain (potential when pending)

  return (
    <article className="ticket-card-modern" aria-label={`Ticket #${ticket.id}`}>
      <header className="ticket-card-header">
        <div className="left">
          <span className="badge badge-warning">{statusToLabel(ticket.status)}</span>
          <span className="ticket-league" title={leagueName}>{leagueName}</span>
        </div>
        <div className="right">
          <span className="ticket-id">#{ticket.id}</span>
        </div>
      </header>

      <div className="ticket-choices">
        {ticket.match_choice_summaries.slice(0, 3).map((mc: MatchChoiceSummary) => (
          <ChoiceLabel key={mc.id} choice={mc} />
        ))}
        {ticket.match_choice_summaries.length > 3 && (
          <div className="more-bets">+{ticket.match_choice_summaries.length - 3} sélection(s)</div>
        )}
      </div>

      <div className="ticket-stats">
        <div className="stat">
          <span className="label">Mise</span>
          <span className="value">{ticket.mise}€</span>
        </div>
        <div className="divider" />
        <div className="stat primary">
          <span className="label">Gain potentiel</span>
          <span className="value">{potentialGain.toFixed(2)}€</span>
        </div>
      </div>

      <footer className="ticket-actions">
        <button className="btn btn-outline btn-sm" onClick={() => onDelete(ticket.id)} aria-label={`Supprimer le ticket ${ticket.id}`}>
          Supprimer
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => onView(ticket.id)} aria-label={`Voir le ticket ${ticket.id}`}>
          Voir détail
        </button>
      </footer>
    </article>
  );
});
InProgressTicketCard.displayName = 'InProgressTicketCard';

interface FinishedTicketCardProps {
  ticket: TicketReadModel;
  onView: (id: number) => void;
}

const FinishedTicketCard = memo<FinishedTicketCardProps>(({ ticket, onView }) => {
  const leagueName = ticket.league_summary?.name || 'Ligues';
  const normalizedStatus = normalizeStatus(ticket.status);
  const isWin = normalizedStatus === 'correct';
  const badgeClass = isWin ? 'badge-success' : 'badge-danger';
  const resultLabel = isWin ? 'Gagné' : 'Perdu';

  return (
    <article className="ticket-card-modern" aria-label={`Ticket #${ticket.id}`}>
      <header className="ticket-card-header">
        <div className="left">
          <span className={`badge ${badgeClass}`}>{resultLabel}</span>
          <span className="ticket-league" title={leagueName}>{leagueName}</span>
        </div>
        <div className="right">
          <span className="ticket-id">#{ticket.id}</span>
        </div>
      </header>

      <div className="ticket-choices">
        {ticket.match_choice_summaries.slice(0, 3).map((mc: MatchChoiceSummary) => (
          <ChoiceLabel key={mc.id} choice={mc} />
        ))}
        {ticket.match_choice_summaries.length > 3 && (
          <div className="more-bets">+{ticket.match_choice_summaries.length - 3} sélection(s)</div>
        )}
      </div>

      <div className="ticket-stats">
        <div className="stat">
          <span className="label">Mise</span>
          <span className="value">{ticket.mise}€</span>
        </div>
        <div className="divider" />
        <div className="stat primary">
          <span className="label">Gain</span>
          <span className="value">{Number(ticket.gain || 0).toFixed(2)}€</span>
        </div>
      </div>

      <footer className="ticket-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onView(ticket.id)} aria-label={`Voir le ticket ${ticket.id}`}>
          Voir détail
        </button>
      </footer>
    </article>
  );
});
FinishedTicketCard.displayName = 'FinishedTicketCard';

const StatsPanelCurrent: React.FC<{ tickets: TicketReadModel[]; lastUpdated: number | null; onRefresh: () => void; loading: boolean }> = ({ tickets, lastUpdated, onRefresh, loading }) => {
  const stats = useMemo(() => {
    const total = tickets.length;
    const totalStake = tickets.reduce((sum, t) => sum + (t.mise || 0), 0);
    const totalPotential = tickets.reduce((sum, t) => sum + (t.gain || 0), 0);
    const avgStake = total > 0 ? totalStake / total : 0;
    return { total, totalStake, totalPotential, avgStake };
  }, [tickets]);

  return (
    <section className="stats-panel modern">
      <div className="stats-header">
        <h3>Tickets en cours</h3>
        <div className="tools">
          <button className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
            {loading ? 'Rafraîchissement…' : 'Rafraîchir'}
          </button>
          <span className="last-updated" aria-live="polite">
            {lastUpdated ? `Maj: ${new Date(lastUpdated).toLocaleTimeString('fr-FR')}` : ''}
          </span>
        </div>
      </div>
      <div className="stats-grid compact">
        <div className="stat-item">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Tickets</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.totalStake}€</span>
          <span className="stat-label">Mise totale</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.totalPotential.toFixed(2)}€</span>
          <span className="stat-label">Gain potentiel</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.avgStake.toFixed(1)}€</span>
          <span className="stat-label">Mise moyenne</span>
        </div>
      </div>
    </section>
  );
};

const StatsPanelFinished: React.FC<{ tickets: TicketReadModel[]; lastUpdated: number | null; onRefresh: () => void; loading: boolean }> = ({ tickets, lastUpdated, onRefresh, loading }) => {
  const stats = useMemo(() => {
    const total = tickets.length;
    const totalStake = tickets.reduce((sum, t) => sum + (t.mise || 0), 0);
    const totalGain = tickets.reduce((sum, t) => sum + (t.gain || 0), 0);
    const won = tickets.filter((t) => normalizeStatus(t.status) === 'correct').length;
    const lost = tickets.filter((t) => normalizeStatus(t.status) === 'wrong').length;
    const winRate = total > 0 ? (won / total) * 100 : 0;
    return { total, totalStake, totalGain, won, lost, winRate };
  }, [tickets]);

  return (
    <section className="stats-panel modern">
      <div className="stats-header">
        <h3>Tickets terminés</h3>
        <div className="tools">
          <button className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
            {loading ? 'Rafraîchissement…' : 'Rafraîchir'}
          </button>
          <span className="last-updated" aria-live="polite">
            {lastUpdated ? `Maj: ${new Date(lastUpdated).toLocaleTimeString('fr-FR')}` : ''}
          </span>
        </div>
      </div>
      <div className="stats-grid compact">
        <div className="stat-item">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item success">
          <span className="stat-value">{stats.won}</span>
          <span className="stat-label">Gagnés</span>
        </div>
        <div className="stat-item danger">
          <span className="stat-value">{stats.lost}</span>
          <span className="stat-label">Perdus</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.winRate.toFixed(0)}%</span>
          <span className="stat-label">Win rate</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.totalStake.toFixed(2)}€</span>
          <span className="stat-label">Mise totale</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.totalGain.toFixed(2)}€</span>
          <span className="stat-label">Gain total</span>
        </div>
      </div>
    </section>
  );
};

const SkeletonCard: React.FC = () => (
  <div className="ticket-card-modern skeleton" aria-hidden="true">
    <div className="skeleton-bar header" />
    <div className="skeleton-chip" />
    <div className="skeleton-chip" />
    <div className="skeleton-chip short" />
    <div className="skeleton-bar stats" />
    <div className="skeleton-button" />
  </div>
);

const SERVER_FILTER_THRESHOLD = 300;

function buildCompleteFilters(args: {
  leagues: Array<{ id: number; name: string }>;
  includeTournament: boolean;
}): TicketFilter[] {
  const filters: TicketFilter[] = [FILTER_ALL];
  const sorted = [...(args.leagues ?? [])]
    .filter((l) => l && typeof l.id === 'number' && !!String(l.name ?? '').trim())
    .map((l) => ({ id: Number(l.id), name: String(l.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const l of sorted) {
    filters.push({ type: 'league', id: l.id, label: l.name });
  }

  if (args.includeTournament) {
    filters.push({ type: 'tournament', label: 'Tournoi' });
  }

  return filters;
}

const TicketsSection: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [activeFilter, setActiveFilter] = useState<TicketFilter>(FILTER_ALL);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTicketId, setDeleteTicketId] = useState<number | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [deleteSource, setDeleteSource] = useState<'list' | 'detail' | null>(null);
  const [localUpdatedAt, setLocalUpdatedAt] = useState<number | null>(null);

  const { showSuccess, showError } = useGlobalToast();
  const profileQuery = useProfileMeQuery({ enabled: true });
  const refetchProfile = useCallback(() => profileQuery.refetch(), [profileQuery]);
  const invalidateTickets = useInvalidateTickets();

  const envForceServer = process.env.REACT_APP_TICKETS_SERVER_FILTER === 'true';

  // Meta queries: 1 seul ticket pour obtenir `total` sans tirer toute la liste.
  const inProgressMeta = useInProgressTicketsMetaQuery();
  const finishedMeta = useFinishedTicketsMetaQuery();

  const baseTotal = activeTab === 'current'
    ? (inProgressMeta.data?.total ?? 0)
    : (finishedMeta.data?.total ?? 0);

  const filterMode = useMemo(() => {
    return resolveTicketsFilterMode({
      total: baseTotal,
      threshold: SERVER_FILTER_THRESHOLD,
      envForceServer,
      locationSearch: typeof window !== 'undefined' ? window.location.search : '',
    });
  }, [baseTotal, envForceServer]);

  const serverFilter: TicketsServerFilter | undefined = useMemo(() => {
    if (filterMode.mode !== 'server') return undefined;
    if (activeFilter.type === 'league') return { leagueId: activeFilter.id ?? null, isTournament: null };
    if (activeFilter.type === 'tournament') return { leagueId: null, isTournament: true };
    return { leagueId: null, isTournament: null };
  }, [filterMode.mode, activeFilter]);

  // Liste non filtrée: toujours active pour alimenter le dropdown de ligues (même en mode server).
  const clientListPageSize = 100;

  const clientInProgressQuery = useInProgressTicketsQuery(
    { page: 1, pageSize: clientListPageSize },
    { refetchIntervalMs: 30_000 }
  );

  const clientFinishedQuery = useFinishedTicketsQuery(
    { page: 1, pageSize: clientListPageSize },
  );

  const serverInProgressQuery = useInProgressTicketsQuery(
    { page: 1, pageSize: 20, filter: serverFilter },
    { enabled: filterMode.mode === 'server', refetchIntervalMs: 30_000 }
  );

  const serverFinishedQuery = useFinishedTicketsQuery(
    { page: 1, pageSize: 20, filter: serverFilter },
    { enabled: filterMode.mode === 'server' }
  );

  const inProgressQuery = filterMode.mode === 'server' ? serverInProgressQuery : clientInProgressQuery;
  const finishedQuery = filterMode.mode === 'server' ? serverFinishedQuery : clientFinishedQuery;

  const tickets = inProgressQuery.data?.tickets ?? [];
  const loading = inProgressQuery.isLoading;
  const error = (inProgressQuery.error as any)?.message ?? null;
  const lastUpdated = inProgressQuery.dataUpdatedAt ?? null;

  const finishedTickets = finishedQuery.data?.tickets ?? [];
  const loadingFinished = finishedQuery.isLoading;
  const errorFinished = (finishedQuery.error as any)?.message ?? null;
  const lastUpdatedFinished = finishedQuery.dataUpdatedAt ?? null;

  const ticketsWithoutDeleted = useMemo(() => tickets.filter(t => !deletedIds.has(t.id)), [tickets, deletedIds]);

  // Extract filter options from UNFILTERED data (client queries) so dropdown always shows all leagues.
  const allInProgressTickets = clientInProgressQuery.data?.tickets ?? [];
  const allFinishedTickets = clientFinishedQuery.data?.tickets ?? [];
  const allCurrentTabTickets = activeTab === 'current' ? allInProgressTickets : allFinishedTickets;
  const leagueOptions = useMemo(() => extractLeagueOptions(allCurrentTabTickets), [allCurrentTabTickets]);
  const showTournaments = useMemo(() => hasTournamentTickets(allCurrentTabTickets), [allCurrentTabTickets]);

  // Reset filter on tab change
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setActiveFilter(FILTER_ALL);
  }, []);

  // Apply filter (client mode only). In server mode, tickets are already filtered by backend.
  const filteredTickets = useMemo(() => {
    if (filterMode.mode === 'server') {
      return activeTab === 'current' ? ticketsWithoutDeleted : finishedTickets;
    }
    return activeTab === 'current'
      ? applyFilter(ticketsWithoutDeleted, activeFilter)
      : applyFilter(finishedTickets, activeFilter);
  }, [filterMode.mode, activeTab, ticketsWithoutDeleted, finishedTickets, activeFilter]);

  const refetch = useCallback(async () => {
    await inProgressQuery.refetch();
  }, [inProgressQuery]);

  const refetchFinished = useCallback(async () => {
    await finishedQuery.refetch();
  }, [finishedQuery]);

  const handleViewTicket = useCallback((id: number) => {
    setSelectedTicketId(id);
    setIsDetailOpen(true);
  }, []);

  const handleDeleteAskFromList = useCallback((id: number) => {
    setDeleteSource('list');
    setDeleteTicketId(id);
    setIsDeleteOpen(true);
  }, []);

  const handleDeleteAskFromDetail = useCallback((id: number) => {
    setDeleteSource('detail');
    setDeleteTicketId(id);
    setIsDeleteOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async (id: number) => {
    try {
      // Masquage optimiste immédiat + horodatage local
      setDeletedIds(prev => new Set(prev).add(id));
      setLocalUpdatedAt(Date.now());

      await apiDeleteTicket(id);
      showSuccess('Ticket supprimé', `Ticket #${id} supprimé avec succès. Votre mise a été recréditée.`);

      // Rafraîchir via React Query
      invalidateTickets.invalidateAll();
      refetchProfile();

      // Fermeture des modales
      setIsDeleteOpen(false);
      setDeleteTicketId(null);
      if (deleteSource === 'detail') {
        setIsDetailOpen(false);
        setSelectedTicketId(null);
      }
    } catch (e: any) {
      // Revert en cas d’erreur
      setDeletedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showError('Erreur', e?.message || 'Suppression du ticket échouée');
      throw e; // pour affichage éventuel dans la modale
    }
  }, [refetch, refetchProfile, showSuccess, showError, deleteSource]);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setIsDeleteOpen(false);
  }, []);

  const myLeaguesQuery = useMyLeaguesQuery({ enabled: true });
  const myLeagues = myLeaguesQuery.data ?? [];

  const includeTournament = useMemo(() => {
    // Heuristique simple et stable:
    // - si on voit au moins un ticket tournoi dans la liste non filtrée de l’onglet
    // - ou si l’utilisateur force le filtre tournoi via le chip actif
    if (activeFilter.type === 'tournament') return true;
    return allCurrentTabTickets.some((t) => t.tournament_match_summary != null);
  }, [activeFilter.type, allCurrentTabTickets]);

  const availableFilters = useMemo(() => {
    // En mode server: chips basés sur toutes les ligues de l’utilisateur (complet).
    // En mode client: même chose (toujours complet) + inclut tournoi si détecté.
    return buildCompleteFilters({
      leagues: myLeagues.map((l) => ({ id: l.id, name: l.name })),
      includeTournament,
    });
  }, [myLeagues, includeTournament]);

  return (
    <div className="tickets-section">

      {/* Modales */}
      <TicketDetailModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        ticketId={selectedTicketId}
        onAskDelete={handleDeleteAskFromDetail}
      />
      <DeleteTicketModal isOpen={isDeleteOpen} onClose={handleCloseDelete} ticketId={deleteTicketId} onConfirm={handleDeleteConfirm} />

      <div className="section-header">
        <h2>Mes Tickets</h2>
      </div>

      <div className="tickets-tabs" role="tablist" aria-label="Filtres tickets">
        <button
          type="button"
          className={`tab-button ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => handleTabChange('current')}
          aria-label="Tickets en cours"
          aria-selected={activeTab === 'current'}
          role="tab"
        >
          <span className="tab-content-wrapper">
            <span className="tab-title">En cours</span>
            <span className="tab-badge">{ticketsWithoutDeleted.length}</span>
          </span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'finished' ? 'active' : ''}`}
          onClick={() => handleTabChange('finished')}
          aria-label="Tickets terminés"
          aria-selected={activeTab === 'finished'}
          role="tab"
        >
          <span className="tab-content-wrapper">
            <span className="tab-title">Terminés</span>
            <span className="tab-badge">{finishedTickets.length}</span>
          </span>
        </button>
      </div>

      <TicketFilterBar leagues={leagueOptions} hasTournaments={showTournaments} active={activeFilter} onChange={setActiveFilter} />

      {activeTab === 'current' && (
        <>
          <StatsPanelCurrent tickets={filteredTickets} lastUpdated={localUpdatedAt || lastUpdated} onRefresh={refetch} loading={loading} />

          {error && (
            <div className="alert alert-danger" role="alert">
              <span>Impossible de charger les tickets en cours: {error}</span>
              <button className="btn btn-outline btn-sm" onClick={refetch}>Réessayer</button>
            </div>
          )}

          <div className="tickets-grid modern">
            {loading && filteredTickets.length === 0 && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {!loading && filteredTickets.length === 0 && !error && (
              <div className="empty-state">
                <span className="empty-icon">🎫</span>
                <h3>{activeFilter.type === 'all' ? 'Aucun ticket en cours' : `Aucun ticket pour "${activeFilter.label}"`}</h3>
                <p>{activeFilter.type === 'all' ? 'Créez un ticket pour commencer à parier dans vos ligues.' : 'Essayez un autre filtre ou créez un nouveau ticket.'}</p>
              </div>
            )}

            {filteredTickets.map((t) => (
              <InProgressTicketCard key={t.id} ticket={t} onView={handleViewTicket} onDelete={handleDeleteAskFromList} />
            ))}
          </div>
        </>
      )}

      {activeTab === 'finished' && (
        <>
          <StatsPanelFinished tickets={filteredTickets} lastUpdated={lastUpdatedFinished} onRefresh={refetchFinished} loading={loadingFinished} />

          {errorFinished && (
            <div className="alert alert-danger" role="alert">
              <span>Impossible de charger les tickets terminés: {errorFinished}</span>
              <button className="btn btn-outline btn-sm" onClick={refetchFinished}>Réessayer</button>
            </div>
          )}

          <div className="tickets-grid modern">
            {loadingFinished && filteredTickets.length === 0 && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {!loadingFinished && filteredTickets.length === 0 && !errorFinished && (
              <div className="empty-state subtle">
                <span className="empty-icon">✅</span>
                <h3>{activeFilter.type === 'all' ? 'Aucun ticket terminé' : `Aucun ticket pour "${activeFilter.label}"`}</h3>
                <p>{activeFilter.type === 'all' ? 'Vous verrez ici vos tickets gagnés et perdus.' : 'Essayez un autre filtre.'}</p>
              </div>
            )}

            {filteredTickets.map((t) => (
              <FinishedTicketCard key={t.id} ticket={t} onView={handleViewTicket} />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

TicketsSection.displayName = 'TicketsSection';

export default TicketsSection;
