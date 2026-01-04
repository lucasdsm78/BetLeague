import React, { useState, useCallback, memo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import leagueApiService, { UserSearchResult } from '../../services/leagueApiService';
import secureApiClient from '../../services/secureApiClient';
import { useUserProfile } from '../../hooks/useUserProfile';
import CreateLeagueForm from '../league/CreateLeagueForm';
import LeagueDetailsModal from '../league/LeagueDetailsModal';
import InviteUserModal from '../league/InviteUserModal';
import LeagueRankingModal from '../league/LeagueRankingModal';
import LeaveLeagueModal from '../league/LeaveLeagueModal';
import EditLeagueModal from '../league/EditLeagueModal';
import InsufficientBTLModal from '../InsufficientBTLModal';
import './LeaguesSection.css';
import { LeagueSummary } from '../../types';
import type { LeaguesPage } from '../../services/leaguesPaging';

interface LeagueCardProps {
    league: LeagueSummary;
    onView: (league: LeagueSummary) => void;
    onJoin?: (league: LeagueSummary) => void;
    onInvite?: (league: LeagueSummary) => void;
    onViewRanking?: (league: LeagueSummary) => void;
    onLeave?: (league: LeagueSummary) => void;
    onEdit?: (league: LeagueSummary) => void;
    isJoining?: boolean;
    showJoinButton?: boolean;
    showInviteButton?: boolean;
    showRankingButton?: boolean;
    showLeaveButton?: boolean;
    showEditButton?: boolean;
}

const LeagueCard = memo<LeagueCardProps>(({ league, onView, onJoin, onInvite, onViewRanking, onLeave, onEdit, isJoining = false, showJoinButton = false, showInviteButton = false, showRankingButton = false, showLeaveButton = false, showEditButton = false }) => {
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
                {league.isFree === false && league.nbBtl && league.nbBtl > 0 ? (
                    <div className="stat stat-btl">
                        <span className="stat-value stat-value-btl">{league.nbBtl}</span>
                        <span className="stat-label">BTL requis</span>
                    </div>
                ) : (
                    <div className="stat stat-free">
                        <span className="stat-value stat-value-free">Gratuit</span>
                        <span className="stat-label">Mise d'entrée</span>
                    </div>
                )}
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
                {showLeaveButton && onLeave && (
                    <button
                        className="btn btn-danger btn-leave"
                        onClick={() => { if (!league.isStarted) onLeave(league); }}
                        disabled={league.isStarted}
                        title={league.isStarted ? 'Cette ligue a déjà commencé : vous ne pouvez plus la quitter.' : `Quitter la ligue ${league.name}`}
                        aria-label={`Quitter la ligue ${league.name}`}
                    >
                        <span className="leave-icon">🚪</span>
                        Quitter
                    </button>
                )}
                {showEditButton && onEdit && (
                    <button
                        className="btn btn-outline btn-edit"
                        onClick={() => onEdit(league)}
                        disabled={league.isStarted}
                        title={league.isStarted ? 'Cette ligue a déjà commencé' : `Modifier la ligue ${league.name}`}
                        aria-label={`Modifier la ligue ${league.name}`}
                    >
                        <span className="edit-icon">✏️</span>
                        Modifier
                    </button>
                )}
            </div>
        </div>
    );
});

LeagueCard.displayName = 'LeagueCard';

type TabType = 'participatedLeagues' | 'myLeagues' | 'availableLeagues';

interface LeaguesSectionProps {}

const LeaguesSection = memo<LeaguesSectionProps>(() => {
    const { profile, refetch: refetchProfile } = useUserProfile();
    const userBtlBalance = profile?.nb_btl ?? 0;

    const [activeTab, setActiveTab] = useState<TabType>('myLeagues');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
    const [isRankingModalOpen, setIsRankingModalOpen] = useState<boolean>(false);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [isInsufficientBTLModalOpen, setIsInsufficientBTLModalOpen] = useState<boolean>(false);
    const [insufficientBTLData, setInsufficientBTLData] = useState<{ required: number; action: string } | null>(null);
    const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
    const [selectedLeagueForInvite, setSelectedLeagueForInvite] = useState<LeagueSummary | null>(null);
    const [selectedLeagueForRanking, setSelectedLeagueForRanking] = useState<LeagueSummary | null>(null);
    const [selectedLeagueForLeave, setSelectedLeagueForLeave] = useState<LeagueSummary | null>(null);
    const [selectedLeagueForEdit, setSelectedLeagueForEdit] = useState<any | null>(null);
    const [participatedLeagues, setParticipatedLeagues] = useState<LeagueSummary[]>([]);
    const [createdLeagues, setCreatedLeagues] = useState<LeagueSummary[]>([]);
    const [availableLeagues, setAvailableLeagues] = useState<LeagueSummary[]>([]);

    const [participatedPage, setParticipatedPage] = useState<LeaguesPage | null>(null);
    const [createdPage, setCreatedPage] = useState<LeaguesPage | null>(null);
    const [availablePage, setAvailablePage] = useState<LeaguesPage | null>(null);

    const pageSize = 10;

    const [isLoadingParticipated, setIsLoadingParticipated] = useState<boolean>(false);
    const [isLoadingCreated, setIsLoadingCreated] = useState<boolean>(false);
    const [isLoadingAvailable, setIsLoadingAvailable] = useState<boolean>(false);
    const [joiningLeagueId, setJoiningLeagueId] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [error, setError] = useState<string>('');
    const location = useLocation();
    const navigate = useNavigate();

    // Load participated leagues (leagues where user is participant but not creator)
    const loadParticipatedLeagues = useCallback(async () => {
        setIsLoadingParticipated(true);
        try {
            const res = await leagueApiService.getParticipatedLeaguesPage(1, pageSize);
            if (res.success && res.data) {
                setParticipatedPage(res.data);
                setParticipatedLeagues(res.data.leagues);
            } else {
                setParticipatedPage({ leagues: [], page: 1, pageSize, total: 0, totalPages: 1 });
                setParticipatedLeagues([]);
            }
        } catch (err) {
            console.error('Failed to load participated leagues:', err);
            setParticipatedPage({ leagues: [], page: 1, pageSize, total: 0, totalPages: 1 });
            setParticipatedLeagues([]);
        } finally {
            setIsLoadingParticipated(false);
        }
    }, [pageSize]);

    // Load created leagues
    const loadCreatedLeagues = useCallback(async () => {
        setIsLoadingCreated(true);
        try {
            const res = await leagueApiService.getCreatedLeaguesPage(1, pageSize);
            if (res.success && res.data) {
                setCreatedPage(res.data);
                setCreatedLeagues(res.data.leagues);
            } else {
                setCreatedPage({ leagues: [], page: 1, pageSize, total: 0, totalPages: 1 });
                setCreatedLeagues([]);
            }
        } catch (err) {
            console.error('Failed to load created leagues:', err);
            setCreatedPage({ leagues: [], page: 1, pageSize, total: 0, totalPages: 1 });
            setCreatedLeagues([]);
        } finally {
            setIsLoadingCreated(false);
        }
    }, [pageSize]);

    // Load available leagues
    const loadAvailableLeagues = useCallback(async () => {
        setIsLoadingAvailable(true);
        try {
            const res = await leagueApiService.getAvailableLeaguesPage(1, pageSize);
            if (res.success && res.data) {
                setAvailablePage(res.data);
                setAvailableLeagues(res.data.leagues);
            } else {
                setAvailablePage({ leagues: [], page: 1, pageSize, total: 0, totalPages: 1 });
                setAvailableLeagues([]);
            }
        } catch (err) {
            console.error('Failed to load available leagues:', err);
            setAvailablePage({ leagues: [], page: 1, pageSize, total: 0, totalPages: 1 });
            setAvailableLeagues([]);
        } finally {
            setIsLoadingAvailable(false);
        }
    }, [pageSize]);

    const loadMoreParticipated = useCallback(async () => {
        if (isLoadingParticipated) return;
        if (!participatedPage) return;
        if (participatedPage.page >= participatedPage.totalPages) return;
        setIsLoadingParticipated(true);
        try {
            const next = participatedPage.page + 1;
            const res = await leagueApiService.getParticipatedLeaguesPage(next, pageSize);
            if (res.success && res.data) {
                const data = res.data;
                setParticipatedPage(data);
                setParticipatedLeagues(prev => [...prev, ...data.leagues]);
            }
        } finally {
            setIsLoadingParticipated(false);
        }
    }, [isLoadingParticipated, participatedPage]);

    const loadMoreCreated = useCallback(async () => {
        if (isLoadingCreated) return;
        if (!createdPage) return;
        if (createdPage.page >= createdPage.totalPages) return;
        setIsLoadingCreated(true);
        try {
            const next = createdPage.page + 1;
            const res = await leagueApiService.getCreatedLeaguesPage(next, pageSize);
            if (res.success && res.data) {
                const data = res.data;
                setCreatedPage(data);
                setCreatedLeagues(prev => [...prev, ...data.leagues]);
            }
        } finally {
            setIsLoadingCreated(false);
        }
    }, [isLoadingCreated, createdPage]);

    const loadMoreAvailable = useCallback(async () => {
        if (isLoadingAvailable) return;
        if (!availablePage) return;
        if (availablePage.page >= availablePage.totalPages) return;
        setIsLoadingAvailable(true);
        try {
            const next = availablePage.page + 1;
            const res = await leagueApiService.getAvailableLeaguesPage(next, pageSize);
            if (res.success && res.data) {
                const data = res.data;
                setAvailablePage(data);
                setAvailableLeagues(prev => [...prev, ...data.leagues]);
            }
        } finally {
            setIsLoadingAvailable(false);
        }
    }, [isLoadingAvailable, availablePage]);

    // Load data on component mount
    useEffect(() => {
        loadParticipatedLeagues();
        loadCreatedLeagues();
        loadAvailableLeagues();
    }, [loadParticipatedLeagues, loadCreatedLeagues, loadAvailableLeagues]);

    // Handle league creation success
    const handleCreateLeague = useCallback((leagueData: any, message: string) => {
        setIsCreateModalOpen(false);
        setSuccessMessage(message || 'Ligue créée avec succès !');
        setTimeout(() => setSuccessMessage(''), 5000);
        loadCreatedLeagues();
        loadAvailableLeagues();
    }, [loadCreatedLeagues, loadAvailableLeagues]);

    const handleJoinLeague = useCallback(async (league: LeagueSummary) => {
        if (joiningLeagueId !== null) {
            return; // Prevent multiple simultaneous join requests
        }

        if (league.isStarted) {
            setError('Cette ligue a déjà commencé, impossible de la rejoindre.');
            return;
        }

        const requiredBtl = (league.isFree === false && league.nbBtl && league.nbBtl > 0) ? league.nbBtl : 0;
        // Refresh profile balance right before a paid join to avoid stale client state
        // (webhook/other actions could have changed nb_btl)
        let freshBalance = userBtlBalance;
        if (requiredBtl > 0) {
            try {
                // Best-effort refresh (hook returns void). The backend remains source of truth.
                await refetchProfile();
             } catch {
                 // ignore: we'll still attempt join and rely on backend 403
             }

             // After refetch, use the latest known balance if available
             freshBalance = (profile?.nb_btl ?? freshBalance);

              if (freshBalance < requiredBtl) {
                 setInsufficientBTLData({
                     required: requiredBtl,
                     action: `rejoindre "${league.name}"`
                 });
                 setIsInsufficientBTLModalOpen(true);
                 return;
              }
         }

        setJoiningLeagueId(league.id);
        setError('');

        try {
            const isPaidLeague = requiredBtl > 0;
             console.log(`🔄 Joining league ${league.id}: ${league.name}${isPaidLeague ? ` (${league.nbBtl} BTL)` : ''}`);

             const result = await leagueApiService.joinLeague(league.id);

             if (result.success) {
                 if (isPaidLeague) {
                     console.log('💳 Paid league joined - refreshing balance and cache...');
                     secureApiClient.clearCache();
                     refetchProfile().catch(err => {
                         console.warn('Failed to refresh profile after joining league:', err);
                     });
                 }

                 let successMsg = result.message || `🎉 Vous avez rejoint la ligue "${league.name}" avec succès !`;
                 if (isPaidLeague) {
                    successMsg += ` ${requiredBtl} BTL ont été débités de votre compte.`;
                 }

                 setSuccessMessage(successMsg);
                 setTimeout(() => setSuccessMessage(''), 6000);

                 // Refresh both lists to reflect the changes
                 await Promise.all([
                     loadCreatedLeagues(),
                     loadParticipatedLeagues(),
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
                } else if (errorMsg.toLowerCase().includes('btl') || errorMsg.toLowerCase().includes('insufficient') || errorMsg.toLowerCase().includes('solde') || errorMsg.includes('403')) {
                    const required = requiredBtl;
                     // Montrer directement le modal d’insuffisance pour une conversion clean
                     setInsufficientBTLData({ required, action: `rejoindre "${league.name}"` });
                     setIsInsufficientBTLModalOpen(true);
                     errorMsg = `💳 Solde insuffisant ! Vous avez ${userBtlBalance} BTL mais cette ligue nécessite ${required} BTL.`;
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
     }, [joiningLeagueId, userBtlBalance, loadCreatedLeagues, loadParticipatedLeagues, loadAvailableLeagues, refetchProfile]);

    // Handle view league details
    const handleViewLeague = useCallback((league: LeagueSummary) => {
        setSelectedLeagueId(league.id);
        setIsDetailsModalOpen(true);

        // Keep URL shareable + recoverable (open modal on paste)
        // We store the leagueId in query string only (no sensitive data)
        const params = new URLSearchParams(location.search);
        params.set('leagueId', String(league.id));
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }, [location.pathname, location.search, navigate]);

    // Handle close details modal
    const handleCloseDetailsModal = useCallback(() => {
        setIsDetailsModalOpen(false);
        setSelectedLeagueId(null);

        // Clean URL after closing modal for better UX
        const params = new URLSearchParams(location.search);
        if (params.has('leagueId')) {
            params.delete('leagueId');
            const nextSearch = params.toString();
            navigate({ pathname: location.pathname, search: nextSearch ? nextSearch : '' }, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    // Open details modal if a shareable link contains ?leagueId=
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const leagueIdFromUrl = params.get('leagueId');
        if (!leagueIdFromUrl) return;

        const parsed = Number(leagueIdFromUrl);
        if (!Number.isFinite(parsed) || parsed <= 0) return;

        // Avoid re-setting state if already open with the same league
        setSelectedLeagueId(prev => (prev === parsed ? prev : parsed));
        setIsDetailsModalOpen(true);
    }, [location.search]);

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

    // Handle leave league
    const handleLeaveLeague = useCallback((league: LeagueSummary) => {
        if (league.isStarted) {
            setError('Cette ligue a déjà commencé : vous ne pouvez plus la quitter.');
            return;
        }
        setSelectedLeagueForLeave(league);
        setIsLeaveModalOpen(true);
    }, []);

    // Handle close leave modal
    const handleCloseLeaveModal = useCallback(() => {
        setIsLeaveModalOpen(false);
        setSelectedLeagueForLeave(null);
    }, []);

    // Handle leave success
    const handleLeaveSuccess = useCallback(() => {
        // Close modal
        handleCloseLeaveModal();

        secureApiClient.clearCache();
        refetchProfile().catch(() => {});
        loadCreatedLeagues();
        loadParticipatedLeagues();
        loadAvailableLeagues();
    }, [handleCloseLeaveModal, loadAvailableLeagues, loadCreatedLeagues, loadParticipatedLeagues, refetchProfile]);

    // Handle invitation sent
    const handleInvitationSent = useCallback((user: UserSearchResult) => {
        // Show success message
        setSuccessMessage(`🎉 Invitation envoyée à ${user.pseudo} avec succès !`);
        setTimeout(() => setSuccessMessage(''), 5000);
        // Could refresh league data here if needed
    }, []);

    const handleEditLeague = useCallback(async (league: LeagueSummary) => {
        try {
            const result = await leagueApiService.getLeagueDetails(league.id);
            if (result.success && result.data) {
                const startDate = result.data.start_date > 9999999999
                    ? Math.floor(result.data.start_date / 1000)  // Millisecondes → Secondes
                    : Math.floor(result.data.start_date);        // Déjà en secondes

                setSelectedLeagueForEdit({
                    id: result.data.id,
                    name: result.data.name,
                    isStarted: result.data.is_started,
                    maxPlayers: result.data.max_players,
                    isFree: result.data.is_free,
                    nbBtl: result.data.nb_btl,
                    startDate: startDate
                });
                setIsEditModalOpen(true);
            } else {
                setError('Impossible de charger les détails de la ligue');
            }
        } catch (err) {
            console.error('Failed to load league details:', err);
            setError('Erreur lors du chargement des détails de la ligue');
        }
    }, []);

    // Handle close edit modal
    const handleCloseEditModal = useCallback(() => {
        setIsEditModalOpen(false);
        setSelectedLeagueForEdit(null);
    }, []);

    // Handle edit success
    const handleEditSuccess = useCallback(() => {
        setSuccessMessage('🎉 Ligue modifiée avec succès !');
        setTimeout(() => setSuccessMessage(''), 5000);

        // Fermer le modal d'abord
        handleCloseEditModal();

        setTimeout(() => {
            console.log('🗑️ Clearing API cache to force fresh data...');
            secureApiClient.clearCache();
            console.log('🔄 Refreshing all leagues after edit...');
            loadCreatedLeagues();
            loadParticipatedLeagues();
            loadAvailableLeagues();
        }, 100);
    }, [handleCloseEditModal, loadCreatedLeagues, loadParticipatedLeagues, loadAvailableLeagues]);

    return (
        <div className="leagues-section">
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
                    aria-label="Ligues participées"
                >
                    <span className="tab-content-wrapper">
                        <span className="tab-title">Participées</span>
                        <span className="tab-badge">{participatedLeagues.length}</span>
                    </span>
                </button>
                <button
                    className={`tab-button ${activeTab === 'myLeagues' ? 'active' : ''}`}
                    onClick={() => setActiveTab('myLeagues')}
                    aria-label="Mes ligues créées"
                >
                    <span className="tab-content-wrapper">
                        <span className="tab-title">Créées</span>
                        <span className="tab-badge">{createdLeagues.length}</span>
                    </span>
                </button>
                <button
                    className={`tab-button ${activeTab === 'availableLeagues' ? 'active' : ''}`}
                    onClick={() => setActiveTab('availableLeagues')}
                    aria-label="Ligues disponibles"
                >
                    <span className="tab-content-wrapper">
                        <span className="tab-title">Disponibles</span>
                        <span className="tab-badge">{availableLeagues.length}</span>
                    </span>
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
                                    onLeave={handleLeaveLeague}
                                    showJoinButton={false}
                                    showInviteButton={false}
                                    showRankingButton={true}
                                    showLeaveButton={true}
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
                                    <Link className="btn btn-outline" to="/invitations">
                                        Voir mes invitations
                                    </Link>
                                </div>
                            </div>
                        )}

                        {participatedPage && participatedPage.totalPages > 1 && (
                            <div className="load-more-wrapper">
                                <button
                                    className="btn btn-secondary btn-load-more"
                                    onClick={loadMoreParticipated}
                                    disabled={isLoadingParticipated}
                                    style={{ width: '100%' }}
                                >
                                    {isLoadingParticipated ? '⏳ Chargement...' : 'Charger plus de ligues participées'}
                                </button>
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
                                    onEdit={handleEditLeague}
                                    showJoinButton={false}
                                    showInviteButton={true}
                                    showRankingButton={true}
                                    showEditButton={true}
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

                        {createdPage && createdPage.totalPages > 1 && (
                            <div className="load-more-wrapper">
                                <button
                                    className="btn btn-secondary btn-load-more"
                                    onClick={loadMoreCreated}
                                    disabled={isLoadingCreated}
                                    style={{ width: '100%' }}
                                >
                                    {isLoadingCreated ? '⏳ Chargement...' : 'Charger plus de ligues créées'}
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

                        {availablePage && availablePage.totalPages > 1 && (
                            <div className="load-more-wrapper">
                                <button
                                    className="btn btn-secondary btn-load-more"
                                    onClick={loadMoreAvailable}
                                    disabled={isLoadingAvailable}
                                    style={{ width: '100%' }}
                                >
                                    {isLoadingAvailable ? '⏳ Chargement...' : 'Charger plus de ligues disponibles'}
                                </button>
                            </div>
                        )}
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
                excludeUserIds={[]}
            />

            <LeaveLeagueModal
                isOpen={isLeaveModalOpen}
                leagueId={selectedLeagueForLeave?.id || null}
                leagueName={selectedLeagueForLeave?.name}
                onClose={handleCloseLeaveModal}
                onLeaveSuccess={handleLeaveSuccess}
            />

            {isEditModalOpen && selectedLeagueForEdit && (
                <EditLeagueModal
                    league={selectedLeagueForEdit}
                    onClose={handleCloseEditModal}
                    onSuccess={handleEditSuccess}
                />
            )}

            {isInsufficientBTLModalOpen && insufficientBTLData && (
                <InsufficientBTLModal
                    currentBalance={userBtlBalance}
                    requiredAmount={insufficientBTLData.required}
                    action={insufficientBTLData.action}
                    onClose={() => setIsInsufficientBTLModalOpen(false)}
                />
            )}
        </div>
    );
});

LeaguesSection.displayName = 'LeaguesSection';

export default LeaguesSection;
