import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './MatchesSection.css';
import type { ApiMatchReadModel } from '../../services/api/matches';
import CreateTicketModal from './CreateTicketModal';
import { createTicket, createTournamentBet } from '../../services/api/tickets';
import type { TournamentMatchOption } from '../../services/api/tournament';
import { useTicketsRefreshStore } from 'store/ticketsStore';
import { useParticipatedLeaguesQuery, useLeagueBalanceQuery } from '../../hooks/queries/useLeaguesLiteQueries';
import { useTournamentPlayerBalanceQuery } from '../../hooks/queries/useTournamentBettingQueries';
import { useMatchesInfiniteQuery } from '../../hooks/queries/useMatchesInfiniteQuery';
import { useGlobalToast } from '../../toast/ToastProvider';

// Types
interface MatchOdds {
    home: number;
    draw: number;
    away: number;
}

interface MatchScore {
    home: number;
    away: number;
}

interface Match {
    id: number;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    kickoff: string;
    status: 'upcoming' | 'live' | 'finished';
    odds: MatchOdds;
    trending?: boolean;
    score?: MatchScore;
    minute?: number;
}

interface Bet {
    matchId: number;
    homeTeam: string;
    awayTeam: string;
    betType: 'home' | 'draw' | 'away';
    odd: number;
    competition: string;
}

interface SortOption {
    value: string;
    label: string;
}

interface User {
    id: string;
    email: string;
    pseudo?: string;
    username?: string;
}

const COMPETITIONS = ['Tous', 'Ligue 1', 'Premier League', 'La Liga', 'Bundesliga', 'Champions League'];
const SORT_OPTIONS: SortOption[] = [
    { value: 'kickoff', label: 'Heure de début' },
    { value: 'trending', label: 'Populaires' },
    { value: 'odds', label: 'Meilleures cotes' }
];

interface MatchCardProps {
    match: Match;
    onAddToBet: (bet: Bet) => void;
}

const MatchCard = memo<MatchCardProps>(({ match, onAddToBet }) => {
    const formatTime = useCallback((dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }, []);

    const formatDate = useCallback((dateString: string): string => {
        const date = new Date(dateString);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return "Aujourd'hui";
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return "Demain";
        } else {
            return date.toLocaleDateString('fr-FR', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
    }, []);

    const handleOddClick = useCallback((type: 'home' | 'draw' | 'away', odd: number) => {
        onAddToBet({
            matchId: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            betType: type,
            odd: odd,
            competition: match.competition
        });
    }, [match, onAddToBet]);

    return (
        <div className={`match-card ${match.status}`}>
            {match.trending && (
                <div className="trending-badge">
                    🔥 Tendance
                </div>
            )}

            <div className="match-header">
                <div className="match-info">
                    <span className="competition">{match.competition}</span>
                    <div className="match-time">
                        {match.status === 'live' ? (
                            <span className="live-indicator">
                                <span className="live-dot"></span>
                                {match.minute}'
                            </span>
                        ) : (
                            <>
                                <span className="date">{formatDate(match.kickoff)}</span>
                                <span className="time">{formatTime(match.kickoff)}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="teams-section">
                <div className="team home-team">
                    <span className="team-name">{match.homeTeam}</span>
                    {match.score && (
                        <span className="score">{match.score.home}</span>
                    )}
                </div>

                <div className="vs-separator">
                    {match.status === 'live' ? 'LIVE' : 'vs'}
                </div>

                <div className="team away-team">
                    {match.score && (
                        <span className="score">{match.score.away}</span>
                    )}
                    <span className="team-name">{match.awayTeam}</span>
                </div>
            </div>

            <div className="odds-section">
                <button
                    className="odd-button home"
                    onClick={() => handleOddClick('home', match.odds.home)}
                    disabled={match.status === 'live'}
                >
                    <span className="odd-label">1</span>
                    <span className="odd-value">{match.odds.home}</span>
                </button>

                <button
                    className="odd-button draw"
                    onClick={() => handleOddClick('draw', match.odds.draw)}
                    disabled={match.status === 'live'}
                >
                    <span className="odd-label">N</span>
                    <span className="odd-value">{match.odds.draw}</span>
                </button>

                <button
                    className="odd-button away"
                    onClick={() => handleOddClick('away', match.odds.away)}
                    disabled={match.status === 'live'}
                >
                    <span className="odd-label">2</span>
                    <span className="odd-value">{match.odds.away}</span>
                </button>
            </div>
        </div>
    );
});

MatchCard.displayName = 'MatchCard';

interface FilterBarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    selectedCompetition: string;
    onCompetitionChange: (value: string) => void;
    sortBy: string;
    onSortChange: (value: string) => void;
}

const FilterBar = memo<FilterBarProps>(({
    searchTerm,
    onSearchChange,
    selectedCompetition,
    onCompetitionChange,
    sortBy,
    onSortChange
}) => (
    <div className="filter-bar">
        <div className="search-input">
            <input
                type="text"
                placeholder="Rechercher équipes..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="search-field"
            />
            <span className="search-icon">🔍</span>
        </div>

        <div className="filter-controls">
            <select
                value={selectedCompetition}
                onChange={(e) => onCompetitionChange(e.target.value)}
                className="competition-select"
            >
                {COMPETITIONS.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                ))}
            </select>

            <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="sort-select"
            >
                {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    </div>
));

FilterBar.displayName = 'FilterBar';

interface DesktopBetSidebarProps {
    selectedBets: Bet[];
    onRemoveBet: (index: number) => void;
    onClearAll: () => void;
    leagues: any[];
    selectedLeagueId: number | null;
    onLeagueChange: (leagueId: number | null) => void;
    balance: number | null;
    stake: string;
    onStakeChange: (stake: string) => void;
    onCreateTicket: () => void;
    isSubmitting: boolean;
    error: string | null;
    isValid: boolean;
    tournamentMatches: TournamentMatchOption[];
    selectedTournamentMatchId: string;
    onTournamentMatchChange: (matchId: string) => void;
    tournamentBalance: number | null;
}

const DesktopBetSidebar = memo<DesktopBetSidebarProps>(({
    selectedBets,
    onRemoveBet,
    onClearAll,
    leagues,
    selectedLeagueId,
    onLeagueChange,
    balance,
    stake,
    onStakeChange,
    onCreateTicket,
    isSubmitting,
    error,
    isValid,
    tournamentMatches,
    selectedTournamentMatchId,
    onTournamentMatchChange,
    tournamentBalance
}) => {
    const totalOdds = useMemo(() => {
        if (selectedBets.length === 0) return 0;
        return Number(selectedBets.reduce((total, bet) => total * bet.odd, 1).toFixed(2));
    }, [selectedBets]);

    const stakeNumber = useMemo(() => Number(stake || '0'), [stake]);

    const potentialWin = useMemo(() => {
        if (!stakeNumber || !isFinite(stakeNumber)) return 0;
        return Number((stakeNumber * totalOdds).toFixed(2));
    }, [stakeNumber, totalOdds]);

    const formatBetLabel = useCallback((betType: 'home' | 'draw' | 'away'): string => {
        return betType === 'home' ? '1' : betType === 'draw' ? 'N' : '2';
    }, []);

    return (
        <aside className="desktop-bet-sidebar">
            <div className="sidebar-header">
                <div className="sidebar-title">
                    <h3>Mon ticket</h3>
                    {selectedBets.length > 0 && (
                        <span className="bet-count">{selectedBets.length}</span>
                    )}
                </div>
                {selectedBets.length > 0 && (
                    <button onClick={onClearAll} className="clear-all-btn" aria-label="Tout effacer">
                        Vider
                    </button>
                )}
            </div>

            <div className="sidebar-content">
                {selectedBets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎫</div>
                        <h4>Aucun pari sélectionné</h4>
                        <p>Cliquez sur une cote pour commencer</p>
                    </div>
                ) : (
                    <>
                        {/* Liste des paris */}
                        <div className="bets-list">
                            {selectedBets.map((bet, index) => (
                                <div key={`${bet.matchId}-${bet.betType}`} className="bet-item">
                                    <div className="bet-match">
                                        <span className="match-name">{bet.homeTeam} vs {bet.awayTeam}</span>
                                        <div className="bet-pick">
                                            <span className="pick-label">{formatBetLabel(bet.betType)}</span>
                                            <span className="pick-odd">{bet.odd.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onRemoveBet(index)}
                                        className="remove-btn"
                                        aria-label="Retirer ce pari"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="sidebar-divider" />

                        {/* Sélection de ligue */}
                        <div className="form-group">
                            <label htmlFor="desktop-league-select" className="form-label">
                                Ligue
                            </label>
                            <select
                                id="desktop-league-select"
                                className="form-select"
                                value={selectedLeagueId ?? ''}
                                onChange={(e) => onLeagueChange(e.target.value ? Number(e.target.value) : null)}
                                disabled={leagues.length === 0 || selectedTournamentMatchId !== ''}
                            >
                                <option value="">-- Sélectionnez une ligue --</option>
                                {leagues.map((league: any) => (
                                    <option key={league.id} value={league.id}>
                                        {league.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Sélection de tournoi */}
                        <div className="form-group">
                            <label htmlFor="desktop-tournament-select" className="form-label">
                                Tournoi
                            </label>
                            <select
                                id="desktop-tournament-select"
                                className="form-select"
                                value={selectedTournamentMatchId}
                                onChange={(e) => onTournamentMatchChange(e.target.value)}
                                disabled={tournamentMatches.length === 0 || selectedLeagueId !== null}
                            >
                                <option value="">-- Sélectionnez un tournoi --</option>
                                {tournamentMatches.map((tm) => (
                                    <option key={`${tm.tournament_id}-${tm.id}`} value={`${tm.tournament_id}-${tm.id}`}>
                                        {tm.display_label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Solde */}
                        <div className="balance-display">
                            <span className="balance-label">
                                {selectedTournamentMatchId !== '' ? 'Solde tournoi' : 'Solde disponible'}
                            </span>
                            <span className="balance-value">
                                {selectedTournamentMatchId !== ''
                                    ? (tournamentBalance !== null ? `${tournamentBalance} BTL` : '-')
                                    : (balance !== null ? `${balance} BTL` : '-')
                                }
                            </span>
                        </div>

                        {/* Mise */}
                        <div className="form-group">
                            <label htmlFor="desktop-stake-input" className="form-label">
                                Mise
                            </label>
                            <div className="stake-input-wrapper">
                                <input
                                    id="desktop-stake-input"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="stake-input"
                                    placeholder="0"
                                    value={stake}
                                    onChange={(e) => {
                                        const sanitized = e.target.value.replace(/[^0-9]/g, '');
                                        onStakeChange(sanitized);
                                    }}
                                    disabled={isSubmitting}
                                />
                                <span className="input-suffix">BTL</span>
                            </div>
                            {balance !== null && stakeNumber > balance && (
                                <p className="input-error">Mise supérieure au solde disponible</p>
                            )}
                        </div>

                        {/* Récapitulatif */}
                        <div className="summary-card">
                            <div className="summary-row">
                                <span className="summary-label">Cote totale</span>
                                <span className="summary-value">{totalOdds.toFixed(2)}</span>
                            </div>
                            <div className="summary-row highlight">
                                <span className="summary-label">Gain potentiel</span>
                                <span className="summary-value">{potentialWin.toFixed(2)} BTL</span>
                            </div>
                        </div>

                        {/* Erreur */}
                        {error && (
                            <div className="error-message" role="alert">
                                {error}
                            </div>
                        )}

                        {/* Bouton de création */}
                        <button
                            className="create-ticket-btn"
                            onClick={onCreateTicket}
                            disabled={!isValid || isSubmitting || selectedBets.length === 0}
                        >
                            {isSubmitting ? 'Création en cours...' : 'Créer le ticket'}
                        </button>
                    </>
                )}
            </div>
        </aside>
    );
});

DesktopBetSidebar.displayName = 'DesktopBetSidebar';

interface MatchesSectionProps {
    user?: User;
}

const mapApiMatchToUi = (m: ApiMatchReadModel): Match => {
    // m.time est déjà une string dans ton type ApiMatchReadModel
    const kickoffIso = m.time;
    const now = Date.now();
    const startTs = new Date(kickoffIso).getTime();
    const status: 'upcoming' | 'live' | 'finished' = startTs > now ? 'upcoming' : 'finished';

    return {
        id: m.id,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        competition: 'Tous', // Valeur neutre pour rester compatible avec le filtre
        kickoff: kickoffIso,
        status,
        odds: {
            home: m.cote_home,
            draw: m.cote_draw,
            away: m.cote_away,
        },
        trending: false,
    };
};

const MatchesSection = memo<MatchesSectionProps>(() => {
    const bumpTicketsRefresh = useTicketsRefreshStore((s) => s.bumpRefresh);
    const { showSuccess, showError } = useGlobalToast();

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCompetition, setSelectedCompetition] = useState<string>('Tous');
    const [sortBy, setSortBy] = useState<string>('kickoff');
    const [selectedBets, setSelectedBets] = useState<Bet[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
    const [isTicketDrawerOpen, setIsTicketDrawerOpen] = useState<boolean>(false);

    // États drawer (mobile)
    const [drawerStake, setDrawerStake] = useState<string>('');
    const [drawerSelectedLeagueId, setDrawerSelectedLeagueId] = useState<number | null>(null);
    const [drawerSelectedTournamentMatchId, setDrawerSelectedTournamentMatchId] = useState<string>('');
    const [drawerError, setDrawerError] = useState<string | null>(null);
    const [isSubmittingDrawer, setIsSubmittingDrawer] = useState<boolean>(false);

    // Desktop (états manquants)
    const [desktopStake, setDesktopStake] = useState<string>('');
    const [desktopSelectedLeagueId, setDesktopSelectedLeagueId] = useState<number | null>(null);
    const [desktopError, setDesktopError] = useState<string | null>(null);
    const [isSubmittingDesktop, setIsSubmittingDesktop] = useState<boolean>(false);

    // Desktop (tournoi)
    const [desktopSelectedTournamentMatchId, setDesktopSelectedTournamentMatchId] = useState<string>('');

    // Tournois: options (placeholder)
    const [drawerTournamentMatches] = useState<TournamentMatchOption[]>([]);
    const [desktopTournamentMatches] = useState<TournamentMatchOption[]>([]);

    // React Query: ligues + balance ligue
    const participatedLeaguesQuery = useParticipatedLeaguesQuery();
    const participatedLeagues = participatedLeaguesQuery.data ?? [];

    const desktopBalanceQuery = useLeagueBalanceQuery(desktopSelectedLeagueId, { enabled: !!desktopSelectedLeagueId });
    const desktopBalance = desktopSelectedLeagueId ? (desktopBalanceQuery.data ?? null) : null;

    const drawerBalanceQuery = useLeagueBalanceQuery(drawerSelectedLeagueId, { enabled: isTicketDrawerOpen && !!drawerSelectedLeagueId });
    const drawerBalance = drawerSelectedLeagueId ? (drawerBalanceQuery.data ?? null) : null;

    // Tournament balances (API retourne un number dans ton hook)
    const drawerTournamentId = useMemo(() => {
        if (!drawerSelectedTournamentMatchId) return null;
        const [tId] = drawerSelectedTournamentMatchId.split('-');
        const tid = Number(tId);
        return Number.isFinite(tid) && tid > 0 ? tid : null;
    }, [drawerSelectedTournamentMatchId]);

    const desktopTournamentId = useMemo(() => {
        if (!desktopSelectedTournamentMatchId) return null;
        const [tId] = desktopSelectedTournamentMatchId.split('-');
        const tid = Number(tId);
        return Number.isFinite(tid) && tid > 0 ? tid : null;
    }, [desktopSelectedTournamentMatchId]);

    const drawerTournamentBalanceQuery = useTournamentPlayerBalanceQuery(drawerTournamentId, { enabled: isTicketDrawerOpen && !!drawerTournamentId });
    const drawerTournamentBalance = drawerTournamentId ? (drawerTournamentBalanceQuery.data ?? null) : null;

    const desktopTournamentBalanceQuery = useTournamentPlayerBalanceQuery(desktopTournamentId, { enabled: !!desktopTournamentId });
    const desktopTournamentBalance = desktopTournamentId ? (desktopTournamentBalanceQuery.data ?? null) : null;

    // Handlers desktop
    const handleLeagueChange = useCallback((leagueId: number | null) => {
        setDesktopSelectedLeagueId(leagueId);
        if (leagueId !== null) setDesktopSelectedTournamentMatchId('');
    }, []);

    const handleTournamentMatchChange = useCallback((tournamentMatchId: string) => {
        setDesktopSelectedTournamentMatchId(tournamentMatchId);
        if (tournamentMatchId !== '') setDesktopSelectedLeagueId(null);
    }, []);

    // Handlers drawer
    const handleDrawerLeagueChange = useCallback((leagueId: number | null) => {
        setDrawerSelectedLeagueId(leagueId);
        setDrawerError(null);
        if (leagueId !== null) setDrawerSelectedTournamentMatchId('');
    }, []);

    const handleDrawerTournamentMatchChange = useCallback((tournamentMatchId: string) => {
        setDrawerSelectedTournamentMatchId(tournamentMatchId);
        setDrawerError(null);
        if (tournamentMatchId !== '') setDrawerSelectedLeagueId(null);
    }, []);

    // Reset errors à l'ouverture
    useEffect(() => {
        if (!isTicketDrawerOpen) return;
        setDrawerError(null);
    }, [isTicketDrawerOpen]);

    // Pagination & Infinite Scroll (React Query)
    const pageSize = 20;
    const matchesQuery = useMatchesInfiniteQuery(pageSize);

    const matches = useMemo(() => {
        const pages = matchesQuery.data?.pages ?? [];
        return pages.flatMap((p) => (p.matches ?? []).map(mapApiMatchToUi));
    }, [matchesQuery.data]);

    const isLoading = matchesQuery.isLoading;
    const error = (matchesQuery.error as any)?.message ?? null;
    const isFetchingMore = matchesQuery.isFetchingNextPage;

    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // IntersectionObserver pour scroll vertical
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        if (!matchesQuery.hasNextPage) return;

        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && matchesQuery.hasNextPage && !matchesQuery.isFetchingNextPage) {
                matchesQuery.fetchNextPage();
            }
        }, { root: null, rootMargin: '200px', threshold: 0 });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [matchesQuery]);

    // Filtrage et tri des matchs
    const filteredMatches = useMemo(() => {
        let filtered = matches;

        // Filtre par recherche
        if (searchTerm) {
            filtered = filtered.filter(match =>
                match.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
                match.awayTeam.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filtre par compétition
        if (selectedCompetition !== 'Tous') {
            filtered = filtered.filter(match => match.competition === selectedCompetition);
        }

        // Tri
        filtered = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'trending':
                    return (b.trending ? 1 : 0) - (a.trending ? 1 : 0);
                case 'odds':
                    return Math.min(a.odds.home, a.odds.draw, a.odds.away) -
                           Math.min(b.odds.home, b.odds.draw, b.odds.away);
                case 'kickoff':
                default:
                    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
            }
        });

        return filtered;
    }, [matches, searchTerm, selectedCompetition, sortBy]);

    const handleAddToBet = useCallback((bet: Bet) => {
        setSelectedBets(prev => {
            // Un match ne doit apparaître qu'une seule fois dans le ticket.
            // Si l'utilisateur change d'avis (1/N/2), on remplace la sélection existante pour ce match.
            const existingIndex = prev.findIndex(b => b.matchId === bet.matchId);

            if (existingIndex >= 0) {
                const newBets = [...prev];
                newBets[existingIndex] = bet;
                return newBets;
            }

            return [...prev, bet];
        });
    }, []);

    const handleRemoveBet = useCallback((index: number) => {
        setSelectedBets(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleClearAllBets = useCallback(() => {
        setSelectedBets([]);
    }, []);

    const handleTicketCreated = useCallback(() => {
        setSelectedBets([]);
        bumpTicketsRefresh();
    }, [bumpTicketsRefresh]);

    const toggleTicketDrawer = useCallback(() => {
        setIsTicketDrawerOpen((v) => !v);
    }, []);

    const closeTicketDrawer = useCallback(() => {
        setIsTicketDrawerOpen(false);
        setDrawerError(null);
        setDrawerStake('');
    }, []);

    // Calculs pour le sidebar desktop
    const desktopStakeNumber = useMemo(() => Number(desktopStake || '0'), [desktopStake]);

    const isValidDesktopStake = useMemo(() => {
        if (!Number.isFinite(desktopStakeNumber)) return false;
        if (!Number.isInteger(desktopStakeNumber)) return false;
        if (desktopStakeNumber <= 0) return false;
        if (desktopBalance != null && desktopStakeNumber > desktopBalance) return false;
        return true;
    }, [desktopStakeNumber, desktopBalance]);

    const canSubmitDesktop = useMemo(() => {
        const hasLeagueOrTournament = !!desktopSelectedLeagueId || desktopSelectedTournamentMatchId !== '';
        return !isSubmittingDesktop && desktopError == null && isValidDesktopStake && hasLeagueOrTournament && selectedBets.length > 0;
    }, [isSubmittingDesktop, desktopError, isValidDesktopStake, desktopSelectedLeagueId, desktopSelectedTournamentMatchId, selectedBets]);

    const handleDesktopCreateTicket = useCallback(async () => {
        const isTournamentMode = desktopSelectedTournamentMatchId !== '';

        if (selectedBets.length === 0 || desktopStakeNumber <= 0) return;
        if (!isTournamentMode && !desktopSelectedLeagueId) return;
        if (isTournamentMode && !desktopSelectedTournamentMatchId) return;

        try {
            setIsSubmittingDesktop(true);
            setDesktopError(null);

            const formatBetType = (b: 'home' | 'draw' | 'away'): '1' | 'N' | '2' => (b === 'home' ? '1' : b === 'draw' ? 'N' : '2');

            if (isTournamentMode) {
                if (selectedBets.length !== 1) {
                    setDesktopError('Vous ne pouvez parier que sur un seul match de tournoi à la fois');
                    return;
                }

                const [tournamentIdStr, matchIdStr] = desktopSelectedTournamentMatchId.split('-');
                const tournamentId = Number(tournamentIdStr);
                const matchId = Number(matchIdStr);

                if (!tournamentId || !matchId) {
                    setDesktopError('Tournoi invalide sélectionné');
                    return;
                }

                const bet = selectedBets[0];
                const payload = {
                    match_choices: [{
                        match_id: bet.matchId,
                        choice: formatBetType(bet.betType)
                    }],
                    mise: desktopStakeNumber,
                    gain: null,
                };

                const res = await createTournamentBet(tournamentId, matchId, payload);

                setSelectedBets([]);
                setDesktopStake('');
                setDesktopSelectedTournamentMatchId('');

                bumpTicketsRefresh();

                showSuccess('Pari de tournoi créé', `Pari créé avec succès (ticket #${res.ticket_id}).`);
            } else {
                if (!desktopSelectedLeagueId) return;

                const match_choices = selectedBets.map(b => ({ match_id: b.matchId, choice: formatBetType(b.betType) }));
                const payload = {
                    match_choices,
                    mise: desktopStakeNumber,
                    gain: null,
                };

                const res = await createTicket(desktopSelectedLeagueId, payload);

                // Succès : nettoyer
                setSelectedBets([]);
                setDesktopStake('');

                bumpTicketsRefresh();

                showSuccess('Ticket créé', `Ticket #${res.ticket_id} créé avec succès.`);
            }
        } catch (e: any) {
            const errorMsg = e?.message?.toLowerCase() || '';

            if (errorMsg.includes('not found') || errorMsg.includes('introuvable')) {
                if (errorMsg.includes('user') || errorMsg.includes('utilisateur')) {
                    setDesktopError('Utilisateur non trouvé. Veuillez vous reconnecter.');
                } else if (errorMsg.includes('tournament') || errorMsg.includes('tournoi')) {
                    setDesktopError("Tournoi non trouvé ou vous n'y participez plus.");
                } else if (errorMsg.includes('match')) {
                    setDesktopError('Match non trouvé ou invalide.');
                } else {
                    setDesktopError('Ressource non trouvée.');
                }
            } else if (errorMsg.includes('mise') || errorMsg.includes('solde') || errorMsg.includes('balance')) {
                setDesktopError('Mise supérieure au solde disponible.');
            } else if (errorMsg.includes('started') || errorMsg.includes('commencé') || errorMsg.includes('démarré')) {
                setDesktopError("Le tournoi n'est pas encore commencé ou est déjà terminé.");
            } else if (errorMsg.includes('not in tournament') || errorMsg.includes('pas inscrit')) {
                setDesktopError('Vous devez être inscrit au tournoi pour parier.');
            } else if (errorMsg.includes('eliminated') || errorMsg.includes('éliminé')) {
                setDesktopError('Vous avez été éliminé de ce tournoi.');
            } else if (errorMsg.includes('btl') && errorMsg.includes('0')) {
                setDesktopError('Votre solde est à 0. Impossible de parier.');
            } else {
                setDesktopError(e?.message || 'Erreur lors de la création du pari');
            }
        } finally {
            setIsSubmittingDesktop(false);
        }
    }, [desktopSelectedLeagueId, selectedBets, desktopStakeNumber, desktopSelectedTournamentMatchId, bumpTicketsRefresh, showSuccess, showError]);

    // Calculs pour le drawer
    const drawerTotalOdds = useMemo(() => {
        if (!selectedBets || selectedBets.length === 0) return 0;
        return Number(selectedBets.reduce((acc, b) => acc * b.odd, 1).toFixed(2));
    }, [selectedBets]);

    const drawerStakeNumber = useMemo(() => Number(drawerStake || '0'), [drawerStake]);

    const drawerPotentialWin = useMemo(() => {
        if (!drawerStakeNumber || !isFinite(drawerStakeNumber)) return 0;
        return Number((drawerStakeNumber * drawerTotalOdds).toFixed(2));
    }, [drawerStakeNumber, drawerTotalOdds]);

    const isValidDrawerStake = useMemo(() => {
        if (!Number.isFinite(drawerStakeNumber)) return false;
        if (!Number.isInteger(drawerStakeNumber)) return false;
        if (drawerStakeNumber <= 0) return false;
        if (drawerBalance != null && drawerStakeNumber > drawerBalance) return false;
        return true;
    }, [drawerStakeNumber, drawerBalance]);

    const canSubmitDrawer = useMemo(() => {
        const hasLeagueOrTournament = !!drawerSelectedLeagueId || drawerSelectedTournamentMatchId !== '';
        return isTicketDrawerOpen && !isSubmittingDrawer && drawerError == null && isValidDrawerStake && hasLeagueOrTournament && selectedBets.length > 0;
    }, [isTicketDrawerOpen, isSubmittingDrawer, drawerError, isValidDrawerStake, drawerSelectedLeagueId, drawerSelectedTournamentMatchId, selectedBets]);

    const handleDrawerCreateTicket = useCallback(async () => {
        const isTournamentMode = drawerSelectedTournamentMatchId !== '';

        if (selectedBets.length === 0 || drawerStakeNumber <= 0) return;
        if (!isTournamentMode && !drawerSelectedLeagueId) return;
        if (isTournamentMode && !drawerSelectedTournamentMatchId) return;

        try {
            setIsSubmittingDrawer(true);
            setDrawerError(null);

            const formatBetType = (b: 'home' | 'draw' | 'away'): '1' | 'N' | '2' => (b === 'home' ? '1' : b === 'draw' ? 'N' : '2');

            if (isTournamentMode) {
                if (selectedBets.length !== 1) {
                    setDrawerError('Vous ne pouvez parier que sur un seul match de tournoi à la fois');
                    return;
                }

                const [tournamentIdStr, matchIdStr] = drawerSelectedTournamentMatchId.split('-');
                const tournamentId = Number(tournamentIdStr);
                const matchId = Number(matchIdStr);

                if (!tournamentId || !matchId) {
                    setDrawerError('Tournoi invalide sélectionné');
                    return;
                }

                const bet = selectedBets[0];
                const payload = {
                    match_choices: [{
                        match_id: bet.matchId,
                        choice: formatBetType(bet.betType)
                    }],
                    mise: drawerStakeNumber,
                    gain: null,
                };

                const res = await createTournamentBet(tournamentId, matchId, payload);

                setSelectedBets([]);
                setDrawerStake('');
                setDrawerSelectedTournamentMatchId('');
                setIsTicketDrawerOpen(false);

                bumpTicketsRefresh();

                showSuccess('Pari de tournoi créé', `Pari créé avec succès (ticket #${res.ticket_id}).`);
            } else {
                if (!drawerSelectedLeagueId) return;

                const match_choices = selectedBets.map(b => ({ match_id: b.matchId, choice: formatBetType(b.betType) }));
                const payload = {
                    match_choices,
                    mise: drawerStakeNumber,
                    gain: null,
                };

                const res = await createTicket(drawerSelectedLeagueId, payload);

                setSelectedBets([]);
                setDrawerStake('');
                setIsTicketDrawerOpen(false);

                bumpTicketsRefresh();

                showSuccess('Ticket créé', `Ticket #${res.ticket_id} créé avec succès.`);
            }
        } catch (e: any) {
            const errorMsg = e?.message?.toLowerCase() || '';

            if (errorMsg.includes('not found') || errorMsg.includes('introuvable')) {
                if (errorMsg.includes('user') || errorMsg.includes('utilisateur')) {
                    setDrawerError('Utilisateur non trouvé. Veuillez vous reconnecter.');
                } else if (errorMsg.includes('tournament') || errorMsg.includes('tournoi')) {
                    setDrawerError("Tournoi non trouvé ou vous n'y participez plus.");
                } else if (errorMsg.includes('match')) {
                    setDrawerError('Match non trouvé ou invalide.');
                } else {
                    setDrawerError('Ressource non trouvée.');
                }
            } else if (errorMsg.includes('mise') || errorMsg.includes('solde') || errorMsg.includes('balance')) {
                setDrawerError('Mise supérieure au solde disponible.');
            } else if (errorMsg.includes('started') || errorMsg.includes('commencé') || errorMsg.includes('démarré')) {
                setDrawerError("Le tournoi n'est pas encore commencé ou est déjà terminé.");
            } else if (errorMsg.includes('not in tournament') || errorMsg.includes('pas inscrit')) {
                setDrawerError('Vous devez être inscrit au tournoi pour parier.');
            } else if (errorMsg.includes('eliminated') || errorMsg.includes('éliminé')) {
                setDrawerError('Vous avez été éliminé de ce tournoi.');
            } else if (errorMsg.includes('btl') && errorMsg.includes('0')) {
                setDrawerError('Votre solde est à 0. Impossible de parier.');
            } else {
                setDrawerError(e?.message || 'Erreur lors de la création du pari');
            }
        } finally {
            setIsSubmittingDrawer(false);
        }
    }, [drawerSelectedLeagueId, selectedBets, drawerStakeNumber, drawerSelectedTournamentMatchId, bumpTicketsRefresh, showSuccess, showError]);

    if (isLoading) {
        return (
            <div className="matches-loading">
                <div className="spinner-large"></div>
                <p>Chargement des matchs...</p>
            </div>
        );
    }

    return (
        <div className="matches-section">
            <div className="section-header">
                <h2>Matchs du jour</h2>
                <p>Découvrez les meilleures cotes et créez vos tickets</p>
            </div>

            <FilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedCompetition={selectedCompetition}
                onCompetitionChange={setSelectedCompetition}
                sortBy={sortBy}
                onSortChange={setSortBy}
            />

            {error && (
                <div role="alert" className="error-banner">
                    {error}
                </div>
            )}

            <div className="matches-grid">
                {filteredMatches.length > 0 ? (
                    filteredMatches.map(match => (
                        <MatchCard
                            key={match.id}
                            match={match}
                            onAddToBet={handleAddToBet}
                        />
                    ))
                ) : (
                    <div className="no-matches">
                        <span className="no-matches-icon">⚽</span>
                        <h3>Aucun match trouvé</h3>
                        <p>Essayez de modifier vos filtres de recherche</p>
                    </div>
                )}
            </div>

            {/* Sentinel pour infinite scroll vertical */}
            {matchesQuery.hasNextPage && (
                <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" />
            )}

            {isFetchingMore && (
                <div className="matches-loading" aria-live="polite">
                    <div className="spinner-large"></div>
                    <p>Chargement de plus de matchs...</p>
                </div>
            )}

            <DesktopBetSidebar
                selectedBets={selectedBets}
                onRemoveBet={handleRemoveBet}
                onClearAll={handleClearAllBets}
                leagues={participatedLeagues}
                selectedLeagueId={desktopSelectedLeagueId}
                onLeagueChange={handleLeagueChange}
                balance={desktopBalance}
                stake={desktopStake}
                onStakeChange={setDesktopStake}
                onCreateTicket={handleDesktopCreateTicket}
                isSubmitting={isSubmittingDesktop}
                error={desktopError}
                isValid={canSubmitDesktop}
                tournamentMatches={desktopTournamentMatches}
                selectedTournamentMatchId={desktopSelectedTournamentMatchId}
                onTournamentMatchChange={handleTournamentMatchChange}
                tournamentBalance={desktopTournamentBalance}
            />

            {/* Bouton flottant mobile pour ouvrir le tiroir du ticket */}
            <button
                className="fab-ticket"
                aria-label="Ouvrir le ticket"
                onClick={toggleTicketDrawer}
            >
                <span className="fab-icon" aria-hidden>🎫</span>
                {selectedBets.length > 0 && (
                    <span className="fab-badge" aria-label={`${selectedBets.length} paris`}>
                        {selectedBets.length}
                    </span>
                )}
            </button>

            {/* Overlay et tiroir du ticket (mobile) */}
            <div
                className={`drawer-overlay ${isTicketDrawerOpen ? 'open' : ''}`}
                onClick={closeTicketDrawer}
                aria-hidden={!isTicketDrawerOpen}
            />
            <div className={`ticket-drawer ${isTicketDrawerOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
                <div className="drawer-header">
                    <h3>Mon ticket</h3>
                    <button className="icon-btn" onClick={closeTicketDrawer} aria-label="Fermer">×</button>
                </div>
                <div className="drawer-content">
                    {selectedBets.length === 0 ? (
                        <div className="empty-drawer">
                            <span className="empty-icon">🎫</span>
                            <p>Votre ticket est vide. Ajoutez des matchs en appuyant sur une cote.</p>
                        </div>
                    ) : (
                        <>
                            {/* Liste des paris */}
                            <ul className="drawer-bets">
                                {selectedBets.map((bet, index) => (
                                    <li key={`${bet.matchId}-${bet.betType}`} className="drawer-bet">
                                        <div className="bet-main">
                                            <span className="teams">{bet.homeTeam} vs {bet.awayTeam}</span>
                                            <span className="pick">{bet.betType === 'home' ? '1' : bet.betType === 'draw' ? 'N' : '2'} @ {bet.odd}</span>
                                        </div>
                                        <button className="remove" onClick={() => handleRemoveBet(index)} aria-label="Retirer">✕</button>
                                    </li>
                                ))}
                            </ul>

                            {/* Sélection de la ligue */}
                            <div className="drawer-league-select">
                                <label htmlFor="drawer-league">Ligue</label>
                                <select
                                    id="drawer-league"
                                    className="drawer-select"
                                    value={drawerSelectedLeagueId ?? ''}
                                    onChange={(e) => handleDrawerLeagueChange(e.target.value ? Number(e.target.value) : null)}
                                    disabled={participatedLeagues.length === 0 || drawerSelectedTournamentMatchId !== ''}
                                >
                                    <option value="">-- Sélectionnez une ligue --</option>
                                    {participatedLeagues.map((l: any) => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                                {(!participatedLeagues || participatedLeagues.length === 0) && (
                                    <div className="drawer-warning" role="alert">
                                        Vous ne participez à aucune ligue.
                                    </div>
                                )}
                            </div>

                            {/* Sélection de tournoi */}
                            <div className="drawer-league-select">
                                <label htmlFor="drawer-tournament">Tournoi</label>
                                <select
                                    id="drawer-tournament"
                                    className="drawer-select"
                                    value={drawerSelectedTournamentMatchId}
                                    onChange={(e) => handleDrawerTournamentMatchChange(e.target.value)}
                                    disabled={drawerTournamentMatches.length === 0 || drawerSelectedLeagueId !== null}
                                >
                                    <option value="">-- Sélectionnez un tournoi --</option>
                                    {drawerTournamentMatches.map((tm) => (
                                        <option key={`${tm.tournament_id}-${tm.id}`} value={`${tm.tournament_id}-${tm.id}`}>
                                            {tm.display_label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Solde */}
                            <div className="drawer-balance">
                                <span>{drawerSelectedTournamentMatchId !== '' ? 'Solde tournoi' : 'Solde disponible'}</span>
                                <strong>
                                    {drawerSelectedTournamentMatchId !== ''
                                        ? (drawerTournamentBalance !== null ? `${drawerTournamentBalance} BTL` : '-')
                                        : (drawerBalance !== null ? `${drawerBalance} BTL` : '-')
                                    }
                                </strong>
                            </div>

                            {/* Mise */}
                            <div className="drawer-stake-form">
                                <label htmlFor="drawer-stake">Mise</label>
                                <div className="drawer-stake-input-wrap">
                                    <input
                                        id="drawer-stake"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        className="drawer-stake-input"
                                        placeholder="Ex: 10"
                                        value={drawerStake}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/[^0-9]/g, '');
                                            setDrawerStake(v);
                                        }}
                                    />
                                    <span className="drawer-currency">BTL</span>
                                </div>
                                {drawerBalance != null && drawerStakeNumber > drawerBalance && (
                                    <div className="drawer-warning" role="alert">
                                        Mise supérieure au solde disponible.
                                    </div>
                                )}
                            </div>

                            {/* Récapitulatif */}
                            <div className="drawer-summary">
                                <div className="drawer-summary-row">
                                    <span>Cote totale</span>
                                    <strong>{drawerTotalOdds || '-'}</strong>
                                </div>
                                <div className="drawer-summary-row primary">
                                    <span>Gain potentiel</span>
                                    <strong>{drawerPotentialWin || '-'} BTL</strong>
                                </div>
                            </div>

                            {drawerError && (
                                <div className="drawer-error" role="alert">{drawerError}</div>
                            )}
                        </>
                    )}
                </div>
                <div className="drawer-actions">
                    <button className="btn btn-outline" onClick={handleClearAllBets} disabled={selectedBets.length === 0}>Vider</button>
                    <button className="btn btn-primary" onClick={handleDrawerCreateTicket} disabled={!canSubmitDrawer}>
                        {isSubmittingDrawer ? 'Création…' : 'Créer le ticket'}
                    </button>
                </div>
            </div>

            <CreateTicketModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                bets={selectedBets}
                onCreated={handleTicketCreated}
            />
        </div>
    );
});

MatchesSection.displayName = 'MatchesSection';

export default MatchesSection;
