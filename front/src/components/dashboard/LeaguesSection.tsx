import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import secureApiClient from '../../services/secureApiClient';
import { getLeagueDetails } from '../../services/api/leagues';
import { useProfileMeQuery } from '../../hooks/queries/useProfileQuery';
import { useLeagueBalances } from '../../hooks/useLeagueBalances';
import { useLeaguesListQuery, useJoinLeagueMutation } from '../../hooks/queries/useLeaguesQueries';
import { useGlobalToast } from '../../toast/ToastProvider';
import CreateLeagueForm from '../league/CreateLeagueForm';
import LeagueDetailsModal from '../league/LeagueDetailsModal';
import InviteUserModal from '../league/InviteUserModal';
import LeagueRankingModal from '../league/LeagueRankingModal';
import LeaveLeagueModal from '../league/LeaveLeagueModal';
import EditLeagueModal from '../league/EditLeagueModal';
import InsufficientBTLModal from '../InsufficientBTLModal';
import { formatTicketAmount } from '../../utils/ticketAmount';
import './LeaguesSection.css';
import type { LeagueSummary } from 'types/entities/league';
import type { UserSearchResult } from 'types/entities/userSearch';

// SVG Icons for action buttons - inline for performance
const IconEye = () => (
    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const IconUserPlus = () => (
    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
);

const IconTrophy = () => (
    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
);

const IconEdit = () => (
    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const IconLogOut = () => (
    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

const IconPlay = () => (
    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
    </svg>
);

const IconLoader = () => (
    <span className="loading-spinner" aria-hidden="true" />
);

interface LeagueCardProps {
    league: LeagueSummary;
    onView: (league: LeagueSummary) => void;
    myBalanceBtl?: number | null;
    isBalanceLoading?: boolean;
    showMyBalance?: boolean;
    replaceEntryFeeWithBalance?: boolean;
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

const LeagueCard = memo<LeagueCardProps>(({ league, onView, myBalanceBtl = null, isBalanceLoading = false, showMyBalance = false, replaceEntryFeeWithBalance = false, onJoin, onInvite, onViewRanking, onLeave, onEdit, isJoining = false, showJoinButton = false, showInviteButton = false, showRankingButton = false, showLeaveButton = false, showEditButton = false }) => {
    const isClosed = league.status === 'CLOSED';
    const isInProgress = league.status === 'IN_PROGRESS' || league.isStarted;
    const statusLabel = isClosed ? 'Fermée' : isInProgress ? 'Active' : 'En attente';
    const statusColor = isClosed ? 'var(--text-secondary)' : isInProgress ? 'var(--success-color)' : 'var(--warning-color)';

    const isLoadingBalance = isBalanceLoading || myBalanceBtl === null || myBalanceBtl === undefined;

    const startDateLabel = (() => {
        try {
            return new Date(league.startDate).toLocaleDateString('fr-FR');
        } catch {
            return '';
        }
    })();

    const renderBalanceValue = () => {
        if (isLoadingBalance) {
            return <span className="balance-skeleton" aria-hidden="true" />;
        }
        return String(myBalanceBtl);
    };

    const estimatedTotalPotLabel = typeof league.estimatedTotalPot === 'number'
        ? formatTicketAmount(league.estimatedTotalPot, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        : null;

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
                {estimatedTotalPotLabel && (
                    <div className="stat stat-pot">
                        <span className="stat-value stat-value-pot">{estimatedTotalPotLabel}</span>
                        <span className="stat-label">Pot actuel</span>
                    </div>
                )}
                {replaceEntryFeeWithBalance ? (
                    <div className="stat stat-btl">
                        <span className="stat-value stat-value-btl" aria-busy={isLoadingBalance}>
                            {renderBalanceValue()}
                        </span>
                        <span className="stat-label">Mon solde</span>
                    </div>
                ) : (
                    <>
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

                        {showMyBalance && (
                            <div className="stat stat-btl">
                                <span className="stat-value stat-value-btl" aria-busy={isLoadingBalance}>
                                    {renderBalanceValue()}
                                </span>
                                <span className="stat-label">Mon solde</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="league-actions">
                {/* View Details Button */}
                <button
                    className="btn btn-primary"
                    onClick={() => onView(league)}
                    aria-label={`Voir les détails de ${league.name}`}
                >
                    <IconEye />
                    <span>Détails</span>
                </button>

                {/* Ranking Button */}
                {showRankingButton && onViewRanking && (
                    <button
                        className="btn btn-primary"
                        onClick={() => onViewRanking(league)}
                        title={`Voir le classement de ${league.name}`}
                        aria-label={`Voir le classement de la ligue ${league.name}`}
                    >
                        <IconTrophy />
                        <span>Classement</span>
                    </button>
                )}

                {/* Invite Button */}
                {showInviteButton && onInvite && (
                    <button
                        className="btn btn-primary"
                        onClick={() => onInvite(league)}
                        disabled={league.isStarted || isClosed}
                        title={isClosed ? 'Cette ligue est fermée' : league.isStarted ? 'Cette ligue a déjà commencé' : 'Inviter des utilisateurs'}
                        aria-label={`Inviter des utilisateurs dans la ligue ${league.name}`}
                    >
                        <IconUserPlus />
                        <span>Inviter</span>
                    </button>
                )}

                {/* Edit Button */}
                {showEditButton && onEdit && (
                    <button
                        className="btn btn-primary"
                        onClick={() => onEdit(league)}
                        disabled={league.isStarted || isClosed}
                        title={isClosed ? 'Cette ligue est fermée' : league.isStarted ? 'Cette ligue a déjà commencé' : `Modifier la ligue ${league.name}`}
                        aria-label={`Modifier la ligue ${league.name}`}
                    >
                        <IconEdit />
                        <span>Modifier</span>
                    </button>
                )}

                {/* Leave Button */}
                {showLeaveButton && onLeave && (
                    <button
                        className="btn btn-danger"
                        onClick={() => { if (!league.isStarted && !isClosed) onLeave(league); }}
                        disabled={league.isStarted || isClosed}
                        title={isClosed ? 'Cette ligue est fermée : vous ne pouvez plus la quitter.' : league.isStarted ? 'Cette ligue a déjà commencé : vous ne pouvez plus la quitter.' : `Quitter la ligue ${league.name}`}
                        aria-label={`Quitter la ligue ${league.name}`}
                    >
                        <IconLogOut />
                        <span>Quitter</span>
                    </button>
                )}

                {/* Join Button */}
                {showJoinButton && onJoin && (
                    <button
                        className={`btn btn-primary ${isJoining ? 'is-loading' : ''}`}
                        onClick={() => onJoin(league)}
                        disabled={isJoining || league.isStarted || isClosed}
                        title={isClosed ? 'Cette ligue est fermée' : league.isStarted ? 'Cette ligue a déjà commencé' : 'Rejoindre cette ligue'}
                        aria-label={`Rejoindre la ligue ${league.name}`}
                    >
                        {isJoining ? (
                            <>
                                <IconLoader />
                                <span>Rejoindre...</span>
                            </>
                        ) : isClosed ? (
                            <span>Fermée</span>
                        ) : league.isStarted ? (
                            <span>Déjà commencée</span>
                        ) : (
                            <>
                                <IconPlay />
                                <span>Rejoindre</span>
                            </>
                        )}
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
    const { showSuccess, showError } = useGlobalToast();

    const profileQuery = useProfileMeQuery();
    const profile = profileQuery.data;
    const refetchProfile = profileQuery.refetch;
    const userBtlBalance = profile?.nb_btl ?? 0;

    const [activeTab, setActiveTab] = useState<TabType>('myLeagues');

    // React Query: listes ligues (split par onglet)
    const participatedQuery = useLeaguesListQuery('participatedLeagues', { enabled: activeTab === 'participatedLeagues' });
    const createdQuery = useLeaguesListQuery('myLeagues', { enabled: activeTab === 'myLeagues' });
    const availableQuery = useLeaguesListQuery('availableLeagues', { enabled: activeTab === 'availableLeagues' });

    const joinMutation = useJoinLeagueMutation();

    const participatedLeagues = participatedQuery.data ?? [];
    const createdLeagues = createdQuery.data ?? [];
    const availableLeagues = availableQuery.data ?? [];

    const isLoadingParticipated = participatedQuery.isLoading || participatedQuery.isFetching;
    const isLoadingCreated = createdQuery.isLoading || createdQuery.isFetching;
    const isLoadingAvailable = availableQuery.isLoading || availableQuery.isFetching;

    const [joiningLeagueId, setJoiningLeagueId] = useState<number | null>(null);

    const handleJoinLeague = useCallback(async (league: LeagueSummary) => {
        try {
            setJoiningLeagueId(league.id);
            await joinMutation.mutateAsync({ leagueId: league.id });
            showSuccess('Ligue rejointe', `Vous avez rejoint ${league.name}`);
            refetchProfile();
        } catch (e: any) {
            showError('Erreur', e?.message || 'Impossible de rejoindre la ligue');
        } finally {
            setJoiningLeagueId(null);
        }
    }, [joinMutation, refetchProfile, showSuccess, showError]);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
    const [isRankingModalOpen, setIsRankingModalOpen] = useState<boolean>(false);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [isInsufficientBTLModalOpen, setIsInsufficientBTLModalOpen] = useState<boolean>(false);
    const [insufficientBTLData, _setInsufficientBTLData] = useState<{ required: number; action: string } | null>(null);
    const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
    const [selectedLeagueForInvite, setSelectedLeagueForInvite] = useState<LeagueSummary | null>(null);
    const [selectedLeagueForRanking, setSelectedLeagueForRanking] = useState<LeagueSummary | null>(null);
    const [selectedLeagueForLeave, setSelectedLeagueForLeave] = useState<LeagueSummary | null>(null);
    const [selectedLeagueForEdit, setSelectedLeagueForEdit] = useState<any | null>(null);

    const location = useLocation();
    const navigate = useNavigate();

    // Handle league creation success
    const handleCreateLeague = useCallback((_leagueData: any, message: string) => {
        setIsCreateModalOpen(false);
        showSuccess('Ligue créée', message || 'Ligue créée avec succès !');
        // Rafraîchir les données via React Query
        createdQuery.refetch();
        availableQuery.refetch();
    }, [showSuccess, createdQuery, availableQuery]);

    // Handle view league details
    const handleViewLeague = useCallback((league: LeagueSummary) => {
        setSelectedLeagueId(league.id);
        setIsDetailsModalOpen(true);

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

        // Shareable link support: open ranking modal via URL param
        const params = new URLSearchParams(location.search);
        params.set('leagueRankId', String(league.id));
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }, [location.pathname, location.search, navigate]);

    const handleCloseRankingModal = useCallback(() => {
        setIsRankingModalOpen(false);
        setSelectedLeagueForRanking(null);

        // Clean URL after closing ranking modal
        const params = new URLSearchParams(location.search);
        if (params.has('leagueRankId')) {
            params.delete('leagueRankId');
            const nextSearch = params.toString();
            navigate({ pathname: location.pathname, search: nextSearch ? nextSearch : '' }, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    // Open ranking modal when a shareable link contains ?leagueRankId=
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const rankIdFromUrl = params.get('leagueRankId');
        if (!rankIdFromUrl) return;

        const parsed = Number(rankIdFromUrl);
        if (!Number.isFinite(parsed) || parsed <= 0) return;

        // If already open on the same league, do nothing.
        setSelectedLeagueForRanking(prev => (prev?.id === parsed ? prev : ({ id: parsed } as any)));
        setIsRankingModalOpen(true);
    }, [location.search]);

    // Handle leave league
    const handleLeaveLeague = useCallback((league: LeagueSummary) => {
        if (league.isStarted) {
            showError('Impossible', 'Cette ligue a déjà commencé : vous ne pouvez plus la quitter.');
            return;
        }
        setSelectedLeagueForLeave(league);
        setIsLeaveModalOpen(true);
    }, [showError]);

    // Handle close leave modal
    const handleCloseLeaveModal = useCallback(() => {
        setIsLeaveModalOpen(false);
        setSelectedLeagueForLeave(null);
    }, []);

    // Handle leave success
    const handleLeaveSuccess = useCallback(() => {
        handleCloseLeaveModal();
        secureApiClient.clearCache();
        refetchProfile().catch(() => {});
        // refresh listes
        participatedQuery.refetch();
        createdQuery.refetch();
        availableQuery.refetch();
    }, [handleCloseLeaveModal, participatedQuery, createdQuery, availableQuery, refetchProfile]);

    const handleInvitationSent = useCallback((user: UserSearchResult) => {
        showSuccess('Invitation envoyée', `Invitation envoyée à ${user.pseudo} avec succès !`);
    }, [showSuccess]);

    const handleEditLeague = useCallback(async (league: LeagueSummary) => {
        try {
            const data = await getLeagueDetails(league.id);
            const rawStartDate = Number(data.start_date);
            const startDate = rawStartDate > 9999999999
                ? Math.floor(rawStartDate / 1000)
                : Math.floor(rawStartDate);

            setSelectedLeagueForEdit({
                id: data.id,
                name: data.name,
                isStarted: data.is_started,
                maxPlayers: data.max_players,
                isFree: data.is_free,
                nbBtl: data.nb_btl,
                startDate: startDate
            });
            setIsEditModalOpen(true);
        } catch (err) {
            console.error('Failed to load league details:', err);
            showError('Erreur', 'Erreur lors du chargement des détails de la ligue');
        }
    }, [showError]);

    // Handle close edit modal
    const handleCloseEditModal = useCallback(() => {
        setIsEditModalOpen(false);
        setSelectedLeagueForEdit(null);
    }, []);

    const handleEditSuccess = useCallback(() => {
        showSuccess('Ligue modifiée', 'Ligue modifiée avec succès !');

        handleCloseEditModal();

        setTimeout(() => {
            secureApiClient.clearCache();
            participatedQuery.refetch();
            createdQuery.refetch();
            availableQuery.refetch();
        }, 100);
    }, [handleCloseEditModal, participatedQuery, createdQuery, availableQuery, showSuccess]);

    const allLeagueIds = useMemo(() => {
        const ids = [...participatedLeagues, ...createdLeagues].map((l) => l.id);
        return Array.from(new Set(ids));
    }, [participatedLeagues, createdLeagues]);

    const {
        getBalance,
        isBalanceLoading,
    } = useLeagueBalances(allLeagueIds, { autoFetch: true, concurrency: 6 });

    return (
        <div className="leagues-section">

            <div className="section-header">
                <h2>Ligues</h2>
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
                                    myBalanceBtl={getBalance(league.id) ?? null}
                                    isBalanceLoading={isBalanceLoading(league.id)}
                                    replaceEntryFeeWithBalance={true}
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
                                    myBalanceBtl={getBalance(league.id) ?? null}
                                    isBalanceLoading={isBalanceLoading(league.id)}
                                    showMyBalance={true}
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
                                    onClick={() => availableQuery.refetch()}
                                    disabled={isLoadingAvailable}
                                >
                                    {isLoadingAvailable ? '⏳ Actualisation...' : 'Actualiser'}
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
