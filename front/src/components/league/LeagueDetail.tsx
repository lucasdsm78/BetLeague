import React, { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import leagueApiService from '../../services/leagueApiService';
import './LeagueDetail.css';

// Types for league details based on backend LeagueReadModel
interface LeagueDetailData {
    id: number;
    name: string;
    uuid?: string;
    is_free?: boolean;
    start_date: number;
    end_date?: number;
    max_players?: number;
    is_started?: boolean;
    nb_players_remaining?: number;
    user_creator?: {
        id: number;
        pseudo: string;
    };
}

interface LeagueDetailProps {
    leagueId?: number;
}

const LeagueDetail = memo<LeagueDetailProps>(({ leagueId: propLeagueId }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [leagueData, setLeagueData] = useState<LeagueDetailData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [isJoining, setIsJoining] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

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
            console.log(`🔄 Loading league details for ID: ${leagueId}`);
            const result = await leagueApiService.getLeagueDetails(leagueId);

            if (result.success && result.data) {
                setLeagueData(result.data);
                console.log('✅ League details loaded:', result.data);
            } else {
                setError(result.error || 'Erreur lors du chargement des détails de la ligue');
                console.error('❌ Failed to load league details:', result.error);
            }
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
            const result = await leagueApiService.joinLeague(leagueData.id);
            if (result.success) {
                // Refresh league details to update player count
                await loadLeagueDetails(true);
                // You could show a success toast here
            } else {
                setError(result.error || 'Erreur lors de la tentative de rejoindre la ligue');
            }
        } catch (err: any) {
            setError('Erreur lors de la tentative de rejoindre la ligue');
            console.error('Join league error:', err);
        } finally {
            setIsJoining(false);
        }
    }, [leagueData, isJoining, loadLeagueDetails]);

    const handleBack = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    useEffect(() => {
        loadLeagueDetails();
    }, [loadLeagueDetails]);

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

    const formatDate = (timestamp: number) => {
        try {
            return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
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
        if (leagueData.is_started) {
            return { label: 'En cours', color: 'var(--success-color)', icon: '🟢' };
        }
        if (leagueData.start_date && leagueData.start_date * 1000 > Date.now()) {
            return { label: 'À venir', color: 'var(--warning-color)', icon: '🟡' };
        }
        return { label: 'En attente', color: 'var(--text-secondary)', icon: '⚪' };
    };

    const statusInfo = getStatusInfo();
    const canJoin = !leagueData.is_started && (leagueData.nb_players_remaining || 0) > 0;

    return (
        <div className="league-detail-container">
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
                            <div className="stat-value">
                                {leagueData.max_players ?
                                    `${leagueData.max_players - (leagueData.nb_players_remaining || 0)}/${leagueData.max_players}`
                                    : 'N/A'
                                }
                            </div>
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

                {leagueData.is_started && (
                    <div className="league-actions-section">
                        <h3>Actions disponibles</h3>
                        <div className="action-buttons">
                            <button className="btn btn-secondary">
                                📊 Voir le classement
                            </button>
                            <button className="btn btn-outline">
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