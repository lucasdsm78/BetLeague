import React, { useState, useCallback, memo, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import leagueApiService, { UserSearchResult } from '../../services/leagueApiService';
import CreateLeagueForm from '../league/CreateLeagueForm';
import LeagueDetailsModal from '../league/LeagueDetailsModal';
import InviteUserModal from '../league/InviteUserModal';
import LeagueRankingModal from '../league/LeagueRankingModal';
import './LeaguesSection.css';
import { LeagueSummary } from '../../types';

// Types locaux minimum pour l'UI Invitations (la liste des ligues utilise LeagueSummary)
interface InvitationUI {
    id: number;
    leagueName: string;
    inviterName: string;
    inviteDate: string;
    members: number;
    maxMembers: number;
}

interface LeagueCardProps {
    league: LeagueSummary;
    onView: (league: LeagueSummary) => void;
    onJoin?: (league: LeagueSummary) => void;
    onInvite?: (league: LeagueSummary) => void;
    onViewRanking?: (league: LeagueSummary) => void;
    isJoining?: boolean;
    showJoinButton?: boolean;
    showInviteButton?: boolean;
    showRankingButton?: boolean;
}

const LeagueCard = memo<LeagueCardProps>(({ league, onView, onJoin, onInvite, onViewRanking, isJoining = false, showJoinButton = false, showInviteButton = false, showRankingButton = false }) => {
    const statusLabel = league.isStarted ? 'Active' : 'En attente';
    const statusColor = league.isStarted ? 'var(--success-color)' : 'var(--warning-color)';

    const startDateLabel = (() => {
        try {
            return new Date(league.startDate).toLocaleDateString('fr-FR');
        } catch {
            return '';
        }
    })();

    return (
        <div className="league-card">
            <div className="league-header">
                <div className="league-info">
                    <h3 className="league-name">{league.name}</h3>
                    <div className="league-meta">
                        <span className="league-type" aria-label="Type de ligue">🌍 Publique</span>
                        <span className="league-type" aria-label="Date de début">Débute le {startDateLabel}</span>
                        <span
                            className="league-status"
                            style={{ color: statusColor }}
                            aria-live="polite"
                        >
                            {statusLabel}
                        </span>
                    </div>
                </div>
                <div className="league-rank" aria-label="Votre position dans la ligue">
                    <div className="rank-badge" title="Votre rang">#1</div>
                    <span className="rank-label">Ma position</span>
                </div>
            </div>

            <div className="league-stats">
                {typeof league.playersRemaining === 'number' && (
                    <div className="stat">
                        <span className="stat-value">{league.playersRemaining}</span>
                        <span className="stat-label">Places restantes</span>
                    </div>
                )}
                <div className="stat">
                    <span className="stat-value">{statusLabel}</span>
                    <span className="stat-label">Statut</span>
                </div>
                <div className="stat">
                    <span className="stat-value">#{league.id}</span>
                    <span className="stat-label">ID</span>
                </div>
            </div>

            <div className="league-actions">
                <button
                    className="btn btn-secondary"
                    onClick={() => onView(league)}
                >
                    Voir détails
                </button>
                {showJoinButton && onJoin && (
                    <button
                        className="btn btn-primary"
                        onClick={() => onJoin(league)}
                        disabled={isJoining || league.isStarted}
                        title={league.isStarted ? 'Cette ligue a déjà commencé' : 'Rejoindre cette ligue'}
                        aria-label={`Rejoindre la ligue ${league.name}`}
                    >
                        {isJoining ? (
                            <>
                                <span className="loading-spinner"></span>
                                Rejoindre...
                            </>
                        ) : league.isStarted ? (
                            'Déjà commencée'
                        ) : (
                            'Rejoindre'
                        )}
                    </button>
                )}
                {showInviteButton && onInvite && (
                    <button
                        className="btn btn-outline"
                        onClick={() => onInvite(league)}
                        disabled={league.isStarted}
                        title={league.isStarted ? 'Cette ligue a déjà commencé' : 'Inviter des utilisateurs'}
                        aria-label={`Inviter des utilisateurs dans la ligue ${league.name}`}
                    >
                        <span className="invite-icon">✉️</span>
                        Inviter
                    </button>
                )}
                {showRankingButton && onViewRanking && (
                    <button
                        className="btn btn-secondary btn-ranking"
                        onClick={() => onViewRanking(league)}
                        title={`Voir le classement de ${league.name}`}
                        aria-label={`Voir le classement de la ligue ${league.name}`}
                    >
                        <span className="ranking-icon">🏆</span>
                        Classement
                    </button>
                )}
            </div>
        </div>
    );
});

LeagueCard.displayName = 'LeagueCard';

interface InvitationCardProps {
    invitation: InvitationUI;
    onAccept: (invitation: InvitationUI) => void;
    onDecline: (invitation: InvitationUI) => void;
}

const InvitationCard = memo<InvitationCardProps>(({ invitation, onAccept, onDecline }) => (
    <div className="invitation-card">
        <div className="invitation-info">
            <h4 className="league-name">{invitation.leagueName}</h4>
            <p className="invitation-text">
                <strong>{invitation.inviterName}</strong> vous invite à rejoindre cette ligue
            </p>
            <div className="invitation-meta">
                <span>{invitation.members}/{invitation.maxMembers} participants</span>
                <span>•</span>
                <span>{new Date(invitation.inviteDate).toLocaleDateString('fr-FR')}</span>
            </div>
        </div>
        <div className="invitation-actions">
            <button
                className="btn btn-primary btn-sm"
                onClick={() => onAccept(invitation)}
            >
                Accepter
            </button>
            <button
                className="btn btn-outline btn-sm"
                onClick={() => onDecline(invitation)}
            >
                Refuser
            </button>
        </div>
    </div>
));

InvitationCard.displayName = 'InvitationCard';


type TabType = 'participatedLeagues' | 'myLeagues' | 'availableLeagues' | 'invitations' | 'join';

interface LeaguesSectionProps {
    user?: { id: string; email: string; pseudo?: string; username?: string };
}

const LeaguesSection = memo<LeaguesSectionProps>(({ user }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('myLeagues');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
    const [isRankingModalOpen, setIsRankingModalOpen] = useState<boolean>(false);
    const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
    const [selectedLeagueForInvite, setSelectedLeagueForInvite] = useState<LeagueSummary | null>(null);
    const [selectedLeagueForRanking, setSelectedLeagueForRanking] = useState<LeagueSummary | null>(null);
    const [participatedLeagues, setParticipatedLeagues] = useState<LeagueSummary[]>([]);
    const [createdLeagues, setCreatedLeagues] = useState<LeagueSummary[]>([]);
    const [availableLeagues, setAvailableLeagues] = useState<LeagueSummary[]>([]);
    const [invitations, setInvitations] = useState<InvitationUI[]>([]);
    const [isLoadingParticipated, setIsLoadingParticipated] = useState<boolean>(false);
    const [isLoadingCreated, setIsLoadingCreated] = useState<boolean>(false);
    const [isLoadingAvailable, setIsLoadingAvailable] = useState<boolean>(false);
    const [joiningLeagueId, setJoiningLeagueId] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [error, setError] = useState<string>('');

    // Load participated leagues (leagues where user is participant but not creator)
    const loadParticipatedLeagues = useCallback(async () => {
        setIsLoadingParticipated(true);
        try {
            const result = await leagueApiService.getParticipatedLeagues();
            if (result.success && result.data) {
                setParticipatedLeagues(result.data.leagues || []);
            } else {
                setParticipatedLeagues([]);
            }
        } catch (err) {
            console.error('Failed to load participated leagues:', err);
            setParticipatedLeagues([]);
        } finally {
            setIsLoadingParticipated(false);
        }
    }, []);

    // Load created leagues
    const loadCreatedLeagues = useCallback(async () => {
        setIsLoadingCreated(true);
        try {
            const result = await leagueApiService.getCreatedLeagues();
            if (result.success && result.data) {
                setCreatedLeagues(result.data.leagues || []);
            } else {
                setCreatedLeagues([]);
            }
        } catch (err) {
            console.error('Failed to load created leagues:', err);
            setCreatedLeagues([]);
        } finally {
            setIsLoadingCreated(false);
        }
    }, []);

    // Load available leagues
    const loadAvailableLeagues = useCallback(async () => {
        setIsLoadingAvailable(true);
        try {
            const result = await leagueApiService.getAvailableLeagues();
            if (result.success && result.data) {
                setAvailableLeagues(result.data.leagues || []);
            } else {
                setAvailableLeagues([]);
            }
        } catch (err) {
            console.error('Failed to load available leagues:', err);
            setAvailableLeagues([]);
        } finally {
            setIsLoadingAvailable(false);
        }
    }, []);

    const loadInvitations = useCallback(async () => {
        try {
            const result = await leagueApiService.getReceivedInvitations();
            if (result.success && result.data) {
                // Adapter les nouvelles interfaces vers InvitationUI
                const mapped: InvitationUI[] = (result.data as any[] || []).map((inv: any) => ({
                    id: Number(inv.id),
                    leagueName: String(inv.league?.name || ''),
                    inviterName: String(inv.league?.user_creator?.pseudo || 'Inconnu'),
                    inviteDate: String(new Date(inv.league?.start_date * 1000 || Date.now()).toISOString()),
                    members: Number((inv.league?.max_players || 0) - (inv.league?.nb_players_remaining || 0)),
                    maxMembers: Number(inv.league?.max_players || 0),
                }));
                setInvitations(mapped);
            }
        } catch (err) {
            console.error('Failed to load invitations:', err);
        }
    }, []);

    // Load data on component mount
    useEffect(() => {
        loadParticipatedLeagues();
        loadCreatedLeagues();
        loadAvailableLeagues();
        loadInvitations();
    }, [loadParticipatedLeagues, loadCreatedLeagues, loadAvailableLeagues, loadInvitations]);

    // Handle league creation success
    const handleCreateLeague = useCallback((leagueData: any, message: string) => {
        setIsCreateModalOpen(false);
        setSuccessMessage(message || 'Ligue créée avec succès !');
        setTimeout(() => setSuccessMessage(''), 5000);
        loadCreatedLeagues();
        loadAvailableLeagues();
    }, [loadCreatedLeagues, loadAvailableLeagues]);

    const handleJoinLeagueByCode = useCallback(async (leagueCode: string) => {
        if (!leagueCode || leagueCode.trim() === '') {
            setError('Code de ligue requis');
            return;
        }

        try {
            const leagueId = parseInt(leagueCode, 10);
            if (isNaN(leagueId)) {
                setError('Code de ligue invalide');
                return;
            }

            const result = await leagueApiService.joinLeague(leagueId);
            if (result.success) {
                setSuccessMessage(result.message || 'Vous avez rejoint la ligue !');
                setTimeout(() => setSuccessMessage(''), 5000);
                loadCreatedLeagues();
                loadAvailableLeagues();
            } else {
                setError(result.error || 'Erreur lors de la tentative de rejoindre la ligue');
            }
        } catch (err) {
            setError('Erreur lors de la tentative de rejoindre la ligue');
            console.error('Join league error:', err);
        }
    }, [loadCreatedLeagues, loadAvailableLeagues]);

    const handleAcceptInvitation = useCallback(async (invitation: InvitationUI) => {
        try {
            const result = await leagueApiService.updateInvitation(invitation.id, true);
            if (result.success) {
                setSuccessMessage(result.message || 'Invitation acceptée');
                setTimeout(() => setSuccessMessage(''), 5000);
                loadCreatedLeagues();
                loadAvailableLeagues();
                loadInvitations();
            } else {
                setError(result.error || 'Erreur lors de l\'acceptation de l\'invitation');
            }
        } catch (err) {
            setError('Erreur lors de l\'acceptation de l\'invitation');
            console.error('Accept invitation error:', err);
        }
    }, [loadCreatedLeagues, loadAvailableLeagues, loadInvitations]);

    const handleJoinLeague = useCallback(async (league: LeagueSummary) => {
        if (joiningLeagueId !== null) {
            return; // Prevent multiple simultaneous join requests
        }

        // Validation before joining
        if (league.isStarted) {
            setError('Cette ligue a déjà commencé, impossible de la rejoindre.');
            return;
        }

        setJoiningLeagueId(league.id);
        setError('');

        try {
            console.log(`🔄 Joining league ${league.id}: ${league.name}`);

            const result = await leagueApiService.joinLeague(league.id);

            if (result.success) {
                // Enhanced success message with league info
                const successMsg = result.message || `🎉 Vous avez rejoint la ligue "${league.name}" avec succès !`;
                setSuccessMessage(successMsg);
                setTimeout(() => setSuccessMessage(''), 6000);

                // Refresh both lists to reflect the changes
                await Promise.all([
                    loadCreatedLeagues(),
                    loadAvailableLeagues()
                ]);

                console.log(`✅ Successfully joined league: ${league.name}`);
            } else {
                // Enhanced error handling with specific messages
                let errorMsg = result.error || 'Erreur lors de la tentative de rejoindre la ligue';

                // Map common backend errors to user-friendly messages
                if (errorMsg.includes('already')) {
                    errorMsg = 'Vous participez déjà à cette ligue.';
                } else if (errorMsg.includes('full') || errorMsg.includes('max')) {
                    errorMsg = 'Cette ligue est complète.';
                } else if (errorMsg.includes('started')) {
                    errorMsg = 'Cette ligue a déjà commencé.';
                } else if (errorMsg.includes('private')) {
                    errorMsg = 'Cette ligue est privée et nécessite une invitation.';
                } else if (errorMsg.includes('btl') || errorMsg.includes('insufficient')) {
                    errorMsg = 'Vous n\'avez pas assez de BTL pour rejoindre cette ligue.';
                }

                setError(errorMsg);
                console.error('❌ Failed to join league:', result.error);
            }
        } catch (err: any) {
            const errorMessage = `Erreur réseau lors de la tentative de rejoindre la ligue "${league.name}". Veuillez réessayer.`;
            setError(errorMessage);
            console.error('❌ Exception while joining league:', err);
        } finally {
            setJoiningLeagueId(null);
        }
    }, [joiningLeagueId, loadCreatedLeagues, loadAvailableLeagues]);

    const handleDeclineInvitation = useCallback(async (invitation: InvitationUI) => {
        try {
            const result = await leagueApiService.updateInvitation(invitation.id, false);
            if (result.success) {
                setSuccessMessage(result.message || 'Invitation refusée');
                setTimeout(() => setSuccessMessage(''), 3000);
                loadInvitations();
            } else {
                setError(result.error || 'Erreur lors du refus de l\'invitation');
            }
        } catch (err) {
            setError('Erreur lors du refus de l\'invitation');
            console.error('Decline invitation error:', err);
        }
    }, [loadInvitations]);

    // Handle view league details
    const handleViewLeague = useCallback((league: LeagueSummary) => {
        setSelectedLeagueId(league.id);
        setIsDetailsModalOpen(true);
    }, []);

    // Handle close details modal
    const handleCloseDetailsModal = useCallback(() => {
        setIsDetailsModalOpen(false);
        setSelectedLeagueId(null);
    }, []);

    // Handle league joined from modal
    const handleLeagueJoined = useCallback(() => {
        // Refresh both lists when a league is joined from the modal
        loadParticipatedLeagues();
        loadCreatedLeagues();
        loadAvailableLeagues();
        // Show success message
        setSuccessMessage('🎉 Vous avez rejoint la ligue avec succès !');
        setTimeout(() => setSuccessMessage(''), 5000);
    }, [loadParticipatedLeagues, loadCreatedLeagues, loadAvailableLeagues]);

    // Handle invite user to league
    const handleInviteUser = useCallback((league: LeagueSummary) => {
        setSelectedLeagueForInvite(league);
        setIsInviteModalOpen(true);
    }, []);

    // Handle close invite modal
    const handleCloseInviteModal = useCallback(() => {
        setIsInviteModalOpen(false);
        setSelectedLeagueForInvite(null);
    }, []);

    // Handle view ranking
    const handleViewRanking = useCallback((league: LeagueSummary) => {
        setSelectedLeagueForRanking(league);
        setIsRankingModalOpen(true);
    }, []);

    const handleCloseRankingModal = useCallback(() => {
        setIsRankingModalOpen(false);
        setSelectedLeagueForRanking(null);
    }, []);

    // Handle invitation sent
    const handleInvitationSent = useCallback((user: UserSearchResult) => {
        // Show success message
        setSuccessMessage(`🎉 Invitation envoyée à ${user.pseudo} avec succès !`);
        setTimeout(() => setSuccessMessage(''), 5000);
        // Could refresh league data here if needed
    }, []);

    return (
        <div className="leagues-section">
            {/* Success Message */}
            {successMessage && (
                <div style={{
                    background: 'var(--success-color)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>✅ {successMessage}</span>
                    <button
                        onClick={() => setSuccessMessage('')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div style={{
                    background: 'var(--danger-color)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>⚠️ {error}</span>
                    <button
                        onClick={() => setError('')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="section-header">
                <h2>Mes Ligues</h2>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => setIsCreateModalOpen(true)}
                        disabled={isLoadingCreated || isLoadingAvailable}
                    >
                        {(isLoadingCreated || isLoadingAvailable) ? '⏳ Chargement...' : 'Créer une ligue'}
                    </button>
                </div>
            </div>

            <div className="leagues-tabs">
                <button
                    className={`tab-button ${activeTab === 'participatedLeagues' ? 'active' : ''}`}
                    onClick={() => setActiveTab('participatedLeagues')}
                >
                    Ligues participées ({participatedLeagues.length})
                </button>
                <button
                    className={`tab-button ${activeTab === 'myLeagues' ? 'active' : ''}`}
                    onClick={() => setActiveTab('myLeagues')}
                >
                    Mes ligues créées ({createdLeagues.length})
                </button>
                <button
                    className={`tab-button ${activeTab === 'availableLeagues' ? 'active' : ''}`}
                    onClick={() => setActiveTab('availableLeagues')}
                >
                    Ligues disponibles ({availableLeagues.length})
                </button>
                <button
                    className={`tab-button ${activeTab === 'invitations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invitations')}
                >
                    Invitations ({invitations.length})
                </button>
                <button
                    className={`tab-button ${activeTab === 'join' ? 'active' : ''}`}
                    onClick={() => setActiveTab('join')}
                >
                    Rejoindre
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'participatedLeagues' && (
                    <div className="leagues-grid" data-tab="participatedLeagues">
                        {isLoadingParticipated ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '2rem',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    width: '2rem',
                                    height: '2rem',
                                    border: '3px solid var(--border-color)',
                                    borderTop: '3px solid var(--primary-color)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: '1rem'
                                }}></div>
                                <p style={{ color: 'var(--text-secondary)' }}>Chargement des ligues participées...</p>
                            </div>
                        ) : participatedLeagues.length > 0 ? (
                            participatedLeagues.map(league => (
                                <LeagueCard
                                    key={league.id}
                                    league={league}
                                    onView={handleViewLeague}
                                    onViewRanking={handleViewRanking}
                                    showJoinButton={false}
                                    showInviteButton={false}
                                    showRankingButton={true}
                                />
                            ))
                        ) : (
                            <div className="empty-state">
                                <span className="empty-icon">🏟️</span>
                                <h3>Vous ne participez à aucune ligue</h3>
                                <p>Rejoignez une ligue publique ou acceptez une invitation pour commencer</p>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setActiveTab('availableLeagues')}
                                    >
                                        Voir les ligues disponibles
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => setActiveTab('invitations')}
                                    >
                                        Voir mes invitations
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'myLeagues' && (
                    <div className="leagues-grid" data-tab="myLeagues">
                        {isLoadingCreated ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '2rem',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    width: '2rem',
                                    height: '2rem',
                                    border: '3px solid var(--border-color)',
                                    borderTop: '3px solid var(--primary-color)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: '1rem'
                                }}></div>
                                <p style={{ color: 'var(--text-secondary)' }}>Chargement de vos ligues créées...</p>
                            </div>
                        ) : createdLeagues.length > 0 ? (
                            createdLeagues.map(league => (
                                <LeagueCard
                                    key={league.id}
                                    league={league}
                                    onView={handleViewLeague}
                                    onInvite={handleInviteUser}
                                    onViewRanking={handleViewRanking}
                                    showJoinButton={false}
                                    showInviteButton={true}
                                    showRankingButton={true}
                                />
                            ))
                        ) : (
                            <div className="empty-state">
                                <span className="empty-icon">🎯</span>
                                <h3>Aucune ligue créée</h3>
                                <p>Créez votre première ligue et invitez vos amis à participer</p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setIsCreateModalOpen(true)}
                                    disabled={isLoadingCreated}
                                >
                                    Créer une ligue
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'availableLeagues' && (
                    <div className="leagues-grid" data-tab="availableLeagues">
                        {isLoadingAvailable ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '2rem',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    width: '2rem',
                                    height: '2rem',
                                    border: '3px solid var(--border-color)',
                                    borderTop: '3px solid var(--primary-color)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: '1rem'
                                }}></div>
                                <p style={{ color: 'var(--text-secondary)' }}>Chargement des ligues disponibles...</p>
                            </div>
                        ) : availableLeagues.length > 0 ? (
                            availableLeagues.map(league => (
                                <LeagueCard
                                    key={league.id}
                                    league={league}
                                    onView={handleViewLeague}
                                    onJoin={handleJoinLeague}
                                    isJoining={joiningLeagueId === league.id}
                                    showJoinButton={true}
                                />
                            ))
                        ) : (
                            <div className="empty-state">
                                <span className="empty-icon">🌍</span>
                                <h3>Aucune ligue disponible</h3>
                                <p>Aucune ligue publique n'est disponible pour le moment</p>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => loadAvailableLeagues()}
                                    disabled={isLoadingAvailable}
                                >
                                    {isLoadingAvailable ? '⏳ Actualisation...' : 'Actualiser'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'invitations' && (
                    <div className="invitations-list">
                        {invitations.length > 0 ? (
                            invitations.map(invitation => (
                                <InvitationCard
                                    key={invitation.id}
                                    invitation={invitation}
                                    onAccept={handleAcceptInvitation}
                                    onDecline={handleDeclineInvitation}
                                />
                            ))
                        ) : (
                            <div className="empty-state">
                                <span className="empty-icon">📨</span>
                                <h3>Aucune invitation</h3>
                                <p>Vous n'avez pas d'invitations en attente</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'join' && (
                    <div className="join-league-section">
                        <div className="join-form">
                            <h3>Rejoindre une ligue</h3>
                            <p>Entrez le code de la ligue pour la rejoindre</p>

                            <form onSubmit={(e: FormEvent<HTMLFormElement>) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const code = formData.get('code') as string;
                                handleJoinLeagueByCode(code);
                            }}>
                                <div className="form-group">
                                    <input
                                        type="text"
                                        name="code"
                                        placeholder="Code de la ligue (ex: ABCD1234)"
                                        className="join-input"
                                        required
                                    />
                                    <button type="submit" className="btn btn-primary">
                                        Rejoindre
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="public-leagues">
                            <h4>Ligues publiques disponibles</h4>
                            <p>Explorez les ligues publiques que vous pouvez rejoindre</p>
                            <button className="btn btn-secondary">
                                Parcourir les ligues publiques
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <CreateLeagueForm
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={handleCreateLeague}
            />

            <LeagueDetailsModal
                isOpen={isDetailsModalOpen}
                leagueId={selectedLeagueId}
                onClose={handleCloseDetailsModal}
                onJoined={handleLeagueJoined}
            />

            <LeagueRankingModal
                isOpen={isRankingModalOpen}
                leagueId={selectedLeagueForRanking?.id || null}
                leagueName={selectedLeagueForRanking?.name}
                onClose={handleCloseRankingModal}
            />

            <InviteUserModal
                isOpen={isInviteModalOpen}
                leagueId={selectedLeagueForInvite?.id || null}
                leagueName={selectedLeagueForInvite?.name}
                onClose={handleCloseInviteModal}
                onInviteSent={handleInvitationSent}
                excludeUserIds={[]} // Could exclude current user and already invited users
            />
        </div>
    );
});

LeaguesSection.displayName = 'LeaguesSection';

export default LeaguesSection;
