import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './MatchesSection.css';
import { getMatchesPage, ApiMatchReadModel, GetMatchesApiResponse } from '../../services/matchesApi';
import CreateTicketModal from './CreateTicketModal';

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

interface QuickBetPanelProps {
    selectedBets: Bet[];
    onRemoveBet: (index: number) => void;
    onClearAll: () => void;
    onCreateTicket: () => void;
}

const QuickBetPanel = memo<QuickBetPanelProps>(({ selectedBets, onRemoveBet, onClearAll, onCreateTicket }) => {
    const totalOdds = useMemo(() => {
        return selectedBets.reduce((total, bet) => total * bet.odd, 1).toFixed(2);
    }, [selectedBets]);

    if (selectedBets.length === 0) return null;

    return (
        <div className="quick-bet-panel">
            <div className="panel-header">
                <h3>Ticket rapide ({selectedBets.length})</h3>
                <button onClick={onClearAll} className="clear-all-btn">
                    Tout effacer
                </button>
            </div>

            <div className="selected-bets">
                {selectedBets.map((bet, index) => (
                    <div key={`${bet.matchId}-${bet.betType}`} className="selected-bet">
                        <div className="bet-info">
                            <span className="match-teams">
                                {bet.homeTeam} vs {bet.awayTeam}
                            </span>
                            <span className="bet-type-odd">
                                {bet.betType === 'home' ? '1' : bet.betType === 'draw' ? 'N' : '2'}
                                @ {bet.odd}
                            </span>
                        </div>
                        <button
                            onClick={() => onRemoveBet(index)}
                            className="remove-bet-btn"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <div className="panel-footer">
                <div className="total-odds">
                    Cote totale: <strong>{totalOdds}</strong>
                </div>
                <button onClick={onCreateTicket} className="create-ticket-btn">
                    Créer le ticket
                </button>
            </div>
        </div>
    );
});

QuickBetPanel.displayName = 'QuickBetPanel';

interface MatchesSectionProps {
    user?: User;
}

const mapApiMatchToUi = (m: ApiMatchReadModel): Match => {
    const kickoffIso = typeof m.time === 'string' ? m.time : new Date(m.time as unknown as string).toISOString();
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

const MatchesSection = memo<MatchesSectionProps>(({ user }) => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCompetition, setSelectedCompetition] = useState<string>('Tous');
    const [sortBy, setSortBy] = useState<string>('kickoff');
    const [selectedBets, setSelectedBets] = useState<Bet[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
    const [isTicketDrawerOpen, setIsTicketDrawerOpen] = useState<boolean>(false);

    // Pagination & Infinite Scroll
    const [page, setPage] = useState<number>(1);
    const [pageSize] = useState<number>(20);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const isFetchingRef = useRef<boolean>(false);

    const loadPage = useCallback(async (nextPage: number) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            if (nextPage === 1) setIsLoading(true); else setIsFetchingMore(true);
            setError(null);
            const res: GetMatchesApiResponse = await getMatchesPage(nextPage, pageSize);
            const uiMatches = (res.matches || []).map(mapApiMatchToUi);
            setMatches(prev => nextPage === 1 ? uiMatches : [...prev, ...uiMatches]);
            setPage(res.page || nextPage);
            setTotalPages(res.total_pages || 1);
        } catch (e: any) {
            setError(e?.message || 'Une erreur est survenue lors du chargement des matchs.');
            if (nextPage === 1) setMatches([]);
        } finally {
            isFetchingRef.current = false;
            setIsLoading(false);
            setIsFetchingMore(false);
        }
    }, [pageSize]);

    // Initial load
    useEffect(() => {
        loadPage(1);
    }, [loadPage]);

    // IntersectionObserver pour scroll vertical (tous formats)
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        if (page >= totalPages) return;

        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && !isFetchingRef.current && page < totalPages) {
                loadPage(page + 1);
            }
        }, { root: null, rootMargin: '200px', threshold: 0 });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [page, totalPages, loadPage]);

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
            // Éviter les doublons du même match
            const existingIndex = prev.findIndex(
                b => b.matchId === bet.matchId && b.betType === bet.betType
            );

            if (existingIndex >= 0) {
                // Remplacer le pari existant
                const newBets = [...prev];
                newBets[existingIndex] = bet;
                return newBets;
            } else {
                // Ajouter le nouveau pari
                return [...prev, bet];
            }
        });
    }, []);

    const handleRemoveBet = useCallback((index: number) => {
        setSelectedBets(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleClearAllBets = useCallback(() => {
        setSelectedBets([]);
    }, []);

    const handleCreateTicket = useCallback(() => {
        setIsCreateOpen(true);
        setIsTicketDrawerOpen(false);
    }, []);

    const toggleTicketDrawer = useCallback(() => {
        setIsTicketDrawerOpen((v) => !v);
    }, []);

    const closeTicketDrawer = useCallback(() => setIsTicketDrawerOpen(false), []);

    const handleTicketCreated = useCallback(() => {
        // Nettoyer les paris sélectionnés mais garder la modale ouverte pour afficher le succès
        setSelectedBets([]);
    }, []);

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
            {page < totalPages && (
                <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" />
            )}

            {isFetchingMore && (
                <div className="matches-loading" aria-live="polite">
                    <div className="spinner-large"></div>
                    <p>Chargement de plus de matchs...</p>
                </div>
            )}

            <QuickBetPanel
                selectedBets={selectedBets}
                onRemoveBet={handleRemoveBet}
                onClearAll={handleClearAllBets}
                onCreateTicket={handleCreateTicket}
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
                    )}
                </div>
                <div className="drawer-actions">
                    <button className="btn btn-outline" onClick={handleClearAllBets} disabled={selectedBets.length === 0}>Vider</button>
                    <button className="btn btn-primary" onClick={handleCreateTicket} disabled={selectedBets.length === 0}>Créer le ticket</button>
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
