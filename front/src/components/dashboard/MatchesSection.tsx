import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './MatchesSection.css';
import type { ApiMatchReadModel } from '../../types/api/matches';
import CreateTicketModal from './CreateTicketModal';
import { createTicket, createTournamentBet } from '../../services/api/tickets';
import type { TournamentMatchOption } from '../../types/api/tournament';
import { useTicketsRefreshStore } from 'store/ticketsStore';
import { useMyLeaguesQuery, useLeagueBalanceQuery } from '../../hooks/queries/useLeaguesLiteQueries';
import { useTournamentPlayerBalanceQuery } from '../../hooks/queries/useTournamentBettingQueries';
import { useMatchesInfiniteQuery } from '../../hooks/queries/useMatchesInfiniteQuery';
import { useGlobalToast } from '../../toast/ToastProvider';

import FilterBar from './matches/FilterBar';
import MatchCard, { type UiMatch } from './matches/MatchCard';
import BetSidebarDesktop from './matches/BetSidebarDesktop';
import BetDrawerMobile from './matches/BetDrawerMobile';
import type { BetSelection } from '../../types/entities/betting';

// NOTE: les types UI (Match/Bet/etc.) et les composants UI ont été extraits dans /matches/**

interface MatchesSectionProps {
    user?: { id: string; email: string; pseudo?: string; username?: string };
}

const mapApiMatchToUi = (m: ApiMatchReadModel): UiMatch => {
    const kickoffIso = m.time;
    const now = Date.now();
    const startTs = new Date(kickoffIso).getTime();

    const statusFromApi = (m.status || '').toUpperCase();
    const isFinishedByApi = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(statusFromApi);
    const isLiveByApi = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT'].includes(statusFromApi);

    // UI requirement: affichage kickoff + 1h pour tout le monde.
    // Donc, tant que kickoff+1h est dans le futur, on considère le match comme 'upcoming'
    // (sauf si l'API dit explicitement live/finished).
    const startTsDisplay = startTs + 60 * 60 * 1000;

    const status: UiMatch['status'] = isFinishedByApi
        ? 'finished'
        : isLiveByApi
            ? 'live'
            : startTsDisplay > now
                ? 'upcoming'
                : 'finished';

    const odds = Array.isArray(m.odds) ? m.odds : [];
    const winnerOdds = odds.filter((o) => (o.bet_type || '').toUpperCase().includes('MATCH_WINNER'));

    const oddHome = winnerOdds.find((o) => (o.value || '').toLowerCase() === 'home')?.odd;
    const oddDraw = winnerOdds.find((o) => (o.value || '').toLowerCase() === 'draw')?.odd;
    const oddAway = winnerOdds.find((o) => (o.value || '').toLowerCase() === 'away')?.odd;

    return {
        id: m.id,
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        competition: m.league_name || 'Tous',
        kickoff: kickoffIso,
        status,
        odds: {
            home: Number.isFinite(Number(oddHome)) ? Number(oddHome) : Number.NaN,
            draw: Number.isFinite(Number(oddDraw)) ? Number(oddDraw) : Number.NaN,
            away: Number.isFinite(Number(oddAway)) ? Number(oddAway) : Number.NaN,
        },
        oddsAll: odds.map((o) => ({
            id: o.id,
            matchOddId: o.id,
            betType: o.bet_type,
            betName: o.bet_name,
            value: o.value,
            odd: o.odd,
            result: o.result ?? null,
        })),
        score: (m.score_home != null && m.score_away != null)
            ? { home: Number(m.score_home), away: Number(m.score_away) }
            : undefined,
        trending: false,
    };
};

const MatchesSection = memo<MatchesSectionProps>(() => {
    const bumpTicketsRefresh = useTicketsRefreshStore((s) => s.bumpRefresh);
    const { showSuccess, showError } = useGlobalToast();

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCompetition, setSelectedCompetition] = useState<string>('Tous');
    const [sortBy, setSortBy] = useState<string>('kickoff');
    const [selectedBets, setSelectedBets] = useState<BetSelection[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
    const [isTicketDrawerOpen, setIsTicketDrawerOpen] = useState<boolean>(false);

    // États drawer (mobile)
    const [drawerStake, setDrawerStake] = useState<string>('');
    const [drawerSelectedLeagueId, setDrawerSelectedLeagueId] = useState<number | null>(null);
    const [drawerSelectedTournamentMatchId, setDrawerSelectedTournamentMatchId] = useState<string>('');
    const [drawerError, setDrawerError] = useState<string | null>(null);
    const [isSubmittingDrawer, setIsSubmittingDrawer] = useState<boolean>(false);

    // Desktop
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
    const myLeaguesQuery = useMyLeaguesQuery();
    const myLeagues = myLeaguesQuery.data ?? [];

    const desktopBalanceQuery = useLeagueBalanceQuery(desktopSelectedLeagueId, { enabled: !!desktopSelectedLeagueId });
    const desktopBalance = desktopSelectedLeagueId ? (desktopBalanceQuery.data ?? null) : null;

    const drawerBalanceQuery = useLeagueBalanceQuery(drawerSelectedLeagueId, { enabled: isTicketDrawerOpen && !!drawerSelectedLeagueId });
    const drawerBalance = drawerSelectedLeagueId ? (drawerBalanceQuery.data ?? null) : null;

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

    // Matches query (infinite)
    const pageSize = 20;
    const { data, isLoading, error: matchesError, fetchNextPage, hasNextPage, isFetchingNextPage } = useMatchesInfiniteQuery(pageSize);

    const allApiMatches: ApiMatchReadModel[] = useMemo(() => {
        const pages = data?.pages ?? [];
        return pages.flatMap((p) => p.matches ?? []);
    }, [data]);

    const allUiMatches: UiMatch[] = useMemo(() => allApiMatches.map(mapApiMatchToUi), [allApiMatches]);

    // Filtering/sorting (reprise de l'existant)
    const filteredMatches = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        let list = allUiMatches;

        if (term) {
            list = list.filter((m) => (m.homeTeam + ' ' + m.awayTeam).toLowerCase().includes(term));
        }

        if (selectedCompetition !== 'Tous') {
            list = list.filter((m) => m.competition === selectedCompetition);
        }

        const copy = [...list];
        if (sortBy === 'kickoff') {
            copy.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
        } else if (sortBy === 'odds') {
            copy.sort((a, b) => Math.max(b.odds.home, b.odds.draw, b.odds.away) - Math.max(a.odds.home, a.odds.draw, a.odds.away));
        } else if (sortBy === 'trending') {
            copy.sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0));
        }

        return copy;
    }, [allUiMatches, searchTerm, selectedCompetition, sortBy]);

    // Add to bet
    const handleAddToBet = useCallback((bet: BetSelection) => {
        setSelectedBets((prev) => [...prev, bet]);
        // UX mobile: ouvrir drawer automatiquement
        if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
            setIsTicketDrawerOpen(true);
        }
    }, []);

    const handleRemoveBet = useCallback((index: number) => {
        setSelectedBets((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleClearAll = useCallback(() => setSelectedBets([]), []);

    const desktopTotalOdds = useMemo(() => {
        if (!selectedBets.length) return 0;
        return Number(selectedBets.reduce((acc, b) => acc * b.odd, 1).toFixed(2));
    }, [selectedBets]);

    const desktopStakeNumber = useMemo(() => Number(desktopStake || '0'), [desktopStake]);

    const desktopPotentialWin = useMemo(() => {
        if (!desktopStakeNumber || !isFinite(desktopStakeNumber)) return 0;
        return Number((desktopStakeNumber * desktopTotalOdds).toFixed(2));
    }, [desktopStakeNumber, desktopTotalOdds]);

    const drawerTotalOdds = useMemo(() => {
        if (!selectedBets.length) return 0;
        return Number(selectedBets.reduce((acc, b) => acc * b.odd, 1).toFixed(2));
    }, [selectedBets]);

    const drawerStakeNumber = useMemo(() => Number(drawerStake || '0'), [drawerStake]);

    const drawerPotentialWin = useMemo(() => {
        if (!drawerStakeNumber || !isFinite(drawerStakeNumber)) return 0;
        return Number((drawerStakeNumber * drawerTotalOdds).toFixed(2));
    }, [drawerStakeNumber, drawerTotalOdds]);

    const isValidDesktopStake = useMemo(() => {
        if (!Number.isFinite(desktopStakeNumber)) return false;
        if (!Number.isInteger(desktopStakeNumber)) return false;
        if (desktopStakeNumber <= 0) return false;
        if (desktopBalance != null && desktopStakeNumber > desktopBalance) return false;
        return true;
    }, [desktopStakeNumber, desktopBalance]);

    const isValidDrawerStake = useMemo(() => {
        if (!Number.isFinite(drawerStakeNumber)) return false;
        if (!Number.isInteger(drawerStakeNumber)) return false;
        if (drawerStakeNumber <= 0) return false;
        if (drawerBalance != null && drawerStakeNumber > drawerBalance) return false;
        return true;
    }, [drawerStakeNumber, drawerBalance]);

    const canSubmitDesktop = useMemo(() => {
        const hasLeagueOrTournament = !!desktopSelectedLeagueId || desktopSelectedTournamentMatchId !== '';
        return !isSubmittingDesktop && desktopError == null && isValidDesktopStake && hasLeagueOrTournament && selectedBets.length > 0;
    }, [isSubmittingDesktop, desktopError, isValidDesktopStake, desktopSelectedLeagueId, desktopSelectedTournamentMatchId, selectedBets]);

    const canSubmitDrawer = useMemo(() => {
        const hasLeagueOrTournament = !!drawerSelectedLeagueId || drawerSelectedTournamentMatchId !== '';
        return isTicketDrawerOpen && !isSubmittingDrawer && drawerError == null && isValidDrawerStake && hasLeagueOrTournament && selectedBets.length > 0;
    }, [isTicketDrawerOpen, isSubmittingDrawer, drawerError, isValidDrawerStake, drawerSelectedLeagueId, drawerSelectedTournamentMatchId, selectedBets]);

    const handleDesktopCreateTicket = useCallback(async () => {
        const isTournamentMode = desktopSelectedTournamentMatchId !== '';

        if (selectedBets.length === 0 || desktopStakeNumber <= 0) return;
        if (!isTournamentMode && !desktopSelectedLeagueId) return;
        if (isTournamentMode && !desktopSelectedTournamentMatchId) return;

        try {
            setIsSubmittingDesktop(true);
            setDesktopError(null);

            const formatBetType = (b: BetSelection['betType']): '1' | 'N' | '2' => (b === 'home' ? '1' : b === 'draw' ? 'N' : '2');

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
                if (!bet.matchOddId) {
                    setDesktopError("Cote invalide (matchOddId manquant). Rafraîchis la page et re-sélectionne la cote.");
                    return;
                }
                const payload = {
                    match_choices: [{
                        match_id: bet.matchId,
                        match_odd_id: bet.matchOddId,
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

                const missing = selectedBets.find((b) => !b.matchOddId);
                if (missing) {
                    setDesktopError("Certaines cotes sélectionnées sont invalides (matchOddId manquant). Rafraîchis la page et re-sélectionne.");
                    return;
                }

                const match_choices = selectedBets.map(b => ({ match_id: b.matchId, match_odd_id: b.matchOddId! }));
                const payload = {
                    match_choices,
                    mise: desktopStakeNumber,
                    gain: null,
                };

                const res = await createTicket(desktopSelectedLeagueId, payload);

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
    }, [desktopSelectedLeagueId, selectedBets, desktopStakeNumber, desktopSelectedTournamentMatchId, bumpTicketsRefresh, showSuccess]);

    const handleDrawerCreateTicket = useCallback(async () => {
        const isTournamentMode = drawerSelectedTournamentMatchId !== '';

        if (selectedBets.length === 0 || drawerStakeNumber <= 0) return;
        if (!isTournamentMode && !drawerSelectedLeagueId) return;
        if (isTournamentMode && !drawerSelectedTournamentMatchId) return;

        try {
            setIsSubmittingDrawer(true);
            setDrawerError(null);

            const formatBetType = (b: BetSelection['betType']): '1' | 'N' | '2' => (b === 'home' ? '1' : b === 'draw' ? 'N' : '2');

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
                if (!bet.matchOddId) {
                    setDrawerError("Cote invalide (matchOddId manquant). Rafraîchis la page et re-sélectionne la cote.");
                    return;
                }
                const payload = {
                    match_choices: [{
                        match_id: bet.matchId,
                        match_odd_id: bet.matchOddId,
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

                const missing = selectedBets.find((b) => !b.matchOddId);
                if (missing) {
                    setDrawerError("Certaines cotes sélectionnées sont invalides (matchOddId manquant). Rafraîchis la page et re-sélectionne.");
                    return;
                }

                const match_choices = selectedBets.map(b => ({ match_id: b.matchId, match_odd_id: b.matchOddId! }));
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
    }, [drawerSelectedLeagueId, selectedBets, drawerStakeNumber, drawerSelectedTournamentMatchId, bumpTicketsRefresh, showSuccess]);

    // Infinite scroll observer (reprend l'existant)
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el) return;

        if (!hasNextPage) return;

        const obs = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        }, { rootMargin: '400px' });

        obs.observe(el);
        return () => obs.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    if (isLoading) {
        return (
            <div className="matches-loading">
                <div className="spinner-large"></div>
                <p>Chargement des matchs...</p>
            </div>
        );
    }

    const error = matchesError ? (matchesError as any)?.message ?? 'Erreur lors du chargement des matchs' : null;

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

            <div ref={loadMoreRef} />

            <div className="matches-layout">
                <BetSidebarDesktop
                    selectedBets={selectedBets}
                    onRemoveBet={handleRemoveBet}
                    onClearAll={handleClearAll}
                    leagues={myLeagues}
                    selectedLeagueId={desktopSelectedLeagueId}
                    onLeagueChange={setDesktopSelectedLeagueId}
                    balance={desktopBalance}
                    tournamentMatches={desktopTournamentMatches}
                    selectedTournamentMatchId={desktopSelectedTournamentMatchId}
                    onTournamentChange={setDesktopSelectedTournamentMatchId}
                    tournamentBalance={desktopTournamentBalance}
                    stake={desktopStake}
                    onStakeChange={setDesktopStake}
                    onCreateTicket={handleDesktopCreateTicket}
                    isSubmitting={isSubmittingDesktop}
                    error={desktopError}
                    isValid={canSubmitDesktop}
                    totalOdds={desktopTotalOdds}
                    potentialWin={desktopPotentialWin}
                />

                <BetDrawerMobile
                    isOpen={isTicketDrawerOpen}
                    onClose={() => setIsTicketDrawerOpen(false)}
                    selectedBets={selectedBets}
                    onRemoveBet={handleRemoveBet}
                    leagues={myLeagues}
                    selectedLeagueId={drawerSelectedLeagueId}
                    onLeagueChange={setDrawerSelectedLeagueId}
                    balance={drawerBalance}
                    tournamentMatches={drawerTournamentMatches}
                    selectedTournamentMatchId={drawerSelectedTournamentMatchId}
                    onTournamentChange={setDrawerSelectedTournamentMatchId}
                    tournamentBalance={drawerTournamentBalance}
                    stake={drawerStake}
                    onStakeChange={setDrawerStake}
                    onCreateTicket={handleDrawerCreateTicket}
                    isSubmitting={isSubmittingDrawer}
                    error={drawerError}
                    isValid={canSubmitDrawer}
                    totalOdds={drawerTotalOdds}
                    potentialWin={drawerPotentialWin}
                />
            </div>

            {/* Fab mobile */}
            <button
                className="ticket-fab"
                onClick={() => setIsTicketDrawerOpen(true)}
                aria-label="Ouvrir mon ticket"
                type="button"
            >
                🎫
                {selectedBets.length > 0 && <span className="ticket-fab-badge">{selectedBets.length}</span>}
            </button>

            <CreateTicketModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                bets={selectedBets as any}
                onCreated={() => {
                    bumpTicketsRefresh();
                    setIsCreateOpen(false);
                }}
            />
        </div>
    );
});

MatchesSection.displayName = 'MatchesSection';

export default MatchesSection;
