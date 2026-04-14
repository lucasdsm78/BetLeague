import React, { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getLeagueDetails, joinLeague } from '../../services/api/leagues';
import type { ApiLeagueDetail } from '../../types/api';
import { formatTicketAmount } from '../../utils/ticketAmount';
import LeagueRankingModal from './LeagueRankingModal';
import './LeagueDetail.css';

interface LeagueDetailProps {
    leagueId?: number;
}

const LeagueDetail = memo<LeagueDetailProps>(({ leagueId: propLeagueId }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [leagueData, setLeagueData] = useState<ApiLeagueDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [isJoining, setIsJoining] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRankingOpen, setIsRankingOpen] = useState(false);

    const leagueId = propLeagueId || (id ? parseInt(id, 10) : null);

    const loadLeagueDetails = useCallback(async (isRefresh = false) => {
        if (!leagueId || isNaN(leagueId)) {
            setError('ID de ligue invalide');
            setIsLoading(false);
            return;
        }

        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError('');

        try {
            const data = await getLeagueDetails(leagueId);
            setLeagueData(data);
        } catch (err: any) {
            setError('Erreur réseau lors du chargement des détails');
            console.error('❌ Exception while loading league details:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [leagueId]);

    const handleJoinLeague = useCallback(async () => {
        if (!leagueData || isJoining) return;

        setIsJoining(true);
        try {
            const _ = await joinLeague(leagueData.id);
            await loadLeagueDetails(true);
        } catch (err: any) {
            setError('Erreur lors de la tentative de rejoindre la ligue');
            console.error('Join league error:', err);
        } finally {
            setIsJoining(false);
        }
    }, [leagueData, isJoining, loadLeagueDetails]);

    const handleOpenRanking = useCallback(() => {
        if (!leagueData) return;
        setIsRankingOpen(true);

        // Keep URL shareable + recoverable (open modal on paste)
        const params = new URLSearchParams(location.search);
        params.set('rankingLeagueId', String(leagueData.id));
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }, [leagueData, location.pathname, location.search, navigate]);

    const handleCloseRanking = useCallback(() => {
        setIsRankingOpen(false);

        // Clean URL after closing modal for better UX
        const params = new URLSearchParams(location.search);
        if (params.has('rankingLeagueId')) {
            params.delete('rankingLeagueId');
            const nextSearch = params.toString();
            navigate({ pathname: location.pathname, search: nextSearch ? nextSearch : '' }, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    const handleBack = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    useEffect(() => {
        loadLeagueDetails();
    }, [loadLeagueDetails]);

    // Open ranking modal if a shareable link contains ?rankingLeagueId=
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const rankingLeagueIdFromUrl = params.get('rankingLeagueId');
        if (!rankingLeagueIdFromUrl) return;

        const parsed = Number(rankingLeagueIdFromUrl);
        if (!Number.isFinite(parsed) || parsed <= 0) return;

        // Only open if the ranking is for this league
        if (leagueData && leagueData.id === parsed) {
            setIsRankingOpen(true);
        }
    }, [location.search, leagueData]);

    if (isLoading) {
        return (
            <div className="league-detail-container">
                <div className="league-detail-loading">
                    <div className="loading-spinner-large"></div>
                    <p>Chargement des détails de la ligue...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="league-detail-container">
                <div className="league-detail-error">
                    <span className="error-icon">⚠️</span>
                    <h3>Erreur</h3>
                    <p>{error}</p>
                    <div className="error-actions">
                        <button className="btn btn-secondary" onClick={() => loadLeagueDetails()}>
                            Réessayer
                        </button>
                        <button className="btn btn-outline" onClick={handleBack}>
                            Retour
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!leagueData) {
        return (
            <div className="league-detail-container">
                <div className="league-detail-error">
                    <span className="error-icon">🔍</span>
                    <h3>Ligue introuvable</h3>
                    <p>Cette ligue n'existe pas ou vous n'y avez pas accès.</p>
                    <button className="btn btn-primary" onClick={handleBack}>
                        Retour
                    </button>
                </div>
            </div>
        );
    }

    const toEpochMs = (timestamp: string | number | null | undefined): number | null => {
        if (timestamp === null || timestamp === undefined) return null;
        const parsed = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
        return Number.isFinite(parsed) ? parsed : null;
    };

    const formatDate = (timestamp: string | number | null | undefined) => {
        const epochMs = toEpochMs(timestamp);
        if (epochMs === null) {
            return 'Date non définie';
        }

        try {
            return new Date(epochMs).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch {
            return 'Date non définie';
        }
    };

    const getStatusInfo = () => {
        const startDateMs = toEpochMs(leagueData.start_date);

        if (leagueData.status === 'CLOSED') {
            return { label: 'Fermée', color: 'var(--text-secondary)', icon: '⚫' };
        }
        if (leagueData.is_started) {
            return { label: 'En cours', color: 'var(--success-color)', icon: '🟢' };
        }
        if (startDateMs !== null && startDateMs > Date.now()) {
            return { label: 'À venir', color: 'var(--warning-color)', icon: '🟡' };
        }
        return { label: 'En attente', color: 'var(--text-secondary)', icon: '⚪' };
    };

    const statusInfo = getStatusInfo();
    const canJoin = leagueData.status !== 'CLOSED' && !leagueData.is_started && (leagueData.nb_players_remaining || 0) > 0;
    const currentPlayersLabel =
        typeof leagueData.max_players === 'number' && typeof leagueData.nb_players_remaining === 'number'
            ? `${Math.max(leagueData.max_players - leagueData.nb_players_remaining, 0)}/${leagueData.max_players}`
            : 'N/A';
    const estimatedTotalPotLabel = typeof leagueData.estimated_total_pot === 'number'
        ? formatTicketAmount(leagueData.estimated_total_pot, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        : null;

    return (
        <div className="league-detail-container">
            <LeagueRankingModal
                isOpen={isRankingOpen}
                leagueId={leagueData?.id ?? null}
                leagueName={leagueData?.name}
                onClose={handleCloseRanking}
            />

            <div className="league-detail-header">
                <button className="back-button" onClick={handleBack} aria-label="Retour">
                    <span className="back-icon">←</span>
                    Retour
                </button>
                <div className="header-actions">
                    {isRefreshing && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--text-secondary)',
                            fontSize: '0.875rem'
                        }}>
                            <span className="loading-spinner"></span>
                            Actualisation...
                        </div>
                    )}
                    {canJoin && (
                        <button
                            className="btn btn-primary"
                            onClick={handleJoinLeague}
                            disabled={isJoining || isRefreshing}
                        >
                            {isJoining ? (
                                <>
                                    <span className="loading-spinner"></span>
                                    Rejoindre...
                                </>
                            ) : (
                                'Rejoindre la ligue'
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className={`league-detail-content ${isRefreshing ? 'loading' : ''}`}>
                <div className="league-hero">
                    <div className="league-title-section">
                        <h1 className="league-title">{leagueData.name}</h1>
                        <div className="league-status" style={{ color: statusInfo.color }}>
                            <span className="status-icon">{statusInfo.icon}</span>
                            {statusInfo.label}
                        </div>
                    </div>
                    {leagueData.user_creator && (
                        <div className="league-creator">
                            <span className="creator-label">Créée par</span>
                            <span className="creator-name">{leagueData.user_creator.pseudo}</span>
                        </div>
                    )}
                </div>

                <div className="league-stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-content">
                            <div className="stat-value">{currentPlayersLabel}</div>
                            <div className="stat-label">Participants</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon">📅</div>
                        <div className="stat-content">
                            <div className="stat-value">{formatDate(leagueData.start_date)}</div>
                            <div className="stat-label">Date de début</div>
                        </div>
                    </div>

                    {leagueData.end_date && (
                        <div className="stat-card">
                            <div className="stat-icon">🏁</div>
                            <div className="stat-content">
                                <div className="stat-value">{formatDate(leagueData.end_date)}</div>
                                <div className="stat-label">Date de fin</div>
                            </div>
                        </div>
                    )}

                    <div className="stat-card">
                        <div className="stat-icon">💰</div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {leagueData.is_free ? 'Gratuite' : 'Payante'}
                            </div>
                            <div className="stat-label">Type de ligue</div>
                        </div>
                    </div>

                    {estimatedTotalPotLabel && (
                        <div className="stat-card stat-card-pot">
                            <div className="stat-icon">🏦</div>
                            <div className="stat-content">
                                <div className="stat-value stat-value-pot">{estimatedTotalPotLabel}</div>
                                <div className="stat-label">Pot actuel</div>
                            </div>
                        </div>
                    )}

                    {leagueData.nb_players_remaining !== undefined && (
                        <div className="stat-card">
                            <div className="stat-icon">🆓</div>
                            <div className="stat-content">
                                <div className="stat-value">{leagueData.nb_players_remaining}</div>
                                <div className="stat-label">Places restantes</div>
                            </div>
                        </div>
                    )}

                    {leagueData.uuid && (
                        <div className="stat-card">
                            <div className="stat-icon">🔗</div>
                            <div className="stat-content">
                                <div className="stat-value code-value">{leagueData.uuid}</div>
                                <div className="stat-label">Code de la ligue</div>
                            </div>
                        </div>
                    )}
                </div>

                {leagueData.status !== 'CLOSED' && leagueData.is_started && (
                    <div className="league-actions-section">
                        <h3>Actions disponibles</h3>
                        <div className="action-buttons">
                            <button className="btn btn-secondary" onClick={handleOpenRanking} type="button">
                                📊 Voir le classement
                            </button>
                            <button className="btn btn-outline" type="button">
                                📈 Mes statistiques
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

LeagueDetail.displayName = 'LeagueDetail';

export default LeagueDetail;

