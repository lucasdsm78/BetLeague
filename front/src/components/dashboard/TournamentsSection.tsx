/**
 * Tournaments Section Component
 * Displays tournaments for subscribed users with creation capability
 */

import React, { useState, useCallback, useMemo } from 'react';
import CreateTournamentModal from './CreateTournamentModal';
import TournamentCard from './TournamentCard';
import TournamentJoinSuccessModal from './TournamentJoinSuccessModal';
import TournamentSubscriptionModal from './TournamentSubscriptionModal';
import MyTournaments from './MyTournaments';
import MyCreatedTournaments from './MyCreatedTournaments';
import FinishedTournaments from './FinishedTournaments';
import { useProfileMeQuery } from '../../hooks/queries/useProfileQuery';
import { useGlobalToast } from '../../toast/ToastProvider';
import { useAvailableTournamentsQuery, useJoinTournamentMutation, useTournamentCreationAccessQuery } from '../../hooks/queries/useTournamentQueries';
import type { Tournament, TournamentCreateResponse } from '../../types/api/tournament';
import './TournamentsSection.css';

type TournamentTab = 'available' | 'my-tournaments' | 'my-created' | 'finished-tournaments';

const TournamentsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TournamentTab>('available');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTournamentSubscriptionModalOpen, setIsTournamentSubscriptionModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [joinedTournament, setJoinedTournament] = useState<Tournament | null>(null);

  const { showInfo, showError } = useGlobalToast();
  const { data: profile } = useProfileMeQuery();

  const creationAccessQuery = useTournamentCreationAccessQuery();
  const creationAccess = creationAccessQuery.data;
  const isCreationBlocked = Boolean(creationAccess && !creationAccess.can_create_tournament);
  const isTournamentSubscriptionEnabled = profile?.commerce_availability?.tournament_subscription_enabled !== false;
  const createButtonLabel = isCreationBlocked
    ? (isTournamentSubscriptionEnabled ? 'Passer à l’illimité' : 'Abonnement indisponible')
    : 'Créer un tournoi';
  const createButtonIcon = isCreationBlocked ? '✨' : '➕';

  const availableQuery = useAvailableTournamentsQuery(page, pageSize, { enabled: activeTab === 'available' });
  const tournaments = useMemo(() => availableQuery.data?.tournaments ?? [], [availableQuery.data?.tournaments]);
  const totalCount = availableQuery.data?.total_count ?? 0;
  const isLoading = availableQuery.isLoading;
  const error = availableQuery.error?.message ?? null;

  const joinMutation = useJoinTournamentMutation();

  const handleOpenCreateModal = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (isCreationBlocked) {
      if (!isTournamentSubscriptionEnabled) {
        showError('Indisponible', "L'abonnement tournoi est temporairement indisponible.");
        return;
      }
      showInfo('Quota mensuel atteint', 'Vos 2 tournois gratuits du mois sont utilisés. Passez à l’abonnement pour créer sans limite.');
      setIsTournamentSubscriptionModalOpen(true);
      return;
    }
    setIsCreateModalOpen(true);
  }, [isCreationBlocked, isTournamentSubscriptionEnabled, showError, showInfo]);

  const handleOpenTournamentSubscription = useCallback(() => {
    if (!isTournamentSubscriptionEnabled) {
      showError('Indisponible', "L'abonnement tournoi est temporairement indisponible.");
      return;
    }
    setIsTournamentSubscriptionModalOpen(true);
  }, [isTournamentSubscriptionEnabled, showError]);

  const handleCloseTournamentSubscription = useCallback(() => {
    setIsTournamentSubscriptionModalOpen(false);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    console.trace('Close modal stack trace');
    setIsCreateModalOpen(false);
  }, []);

  const handleTournamentCreated = useCallback((result?: TournamentCreateResponse) => {
    const remaining = result?.monthly_free_tournaments_remaining;
    if (typeof remaining === 'number' && remaining >= 0) {
      const description = remaining > 0
        ? `Votre tournoi a été créé avec succès. Il vous reste ${remaining} tournoi gratuit ce mois-ci.`
        : 'Votre tournoi a été créé avec succès. Vous avez utilisé vos 2 tournois gratuits du mois.';
      showInfo('Tournoi créé', description);
    } else {
      showInfo('Tournoi créé', 'Votre tournoi a été créé avec succès !');
    }
    void creationAccessQuery.refetch();
    setActiveTab('my-created');
  }, [creationAccessQuery, showInfo]);

  const handleJoinTournament = useCallback(async (tournamentId: number): Promise<void> => {
    try {
      await joinMutation.mutateAsync({ tournamentId });
      const tournament = tournaments.find((t: Tournament) => t.id === tournamentId);
      if (tournament) setJoinedTournament(tournament);
      // Pas de refetch manuel: l'invalidation est gérée par la mutation React Query
    } catch (err: any) {
      showError('Erreur', err?.message || 'Impossible de rejoindre le tournoi');
      throw err;
    }
  }, [joinMutation, tournaments, showError]);

  const handlePreviousPage = useCallback(() => {
    if (page > 1) setPage(prev => prev - 1);
  }, [page]);

  const handleNextPage = useCallback(() => {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (page < totalPages) setPage(prev => prev + 1);
  }, [page, totalCount, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="tournaments-section">
      <div className="tournaments-header">
        <div className="tournaments-header-content">
          <div className="tournaments-header-text">
            <h2 className="tournaments-title">🏆 Tournois</h2>
            <p className="tournaments-subtitle">
              Créez jusqu’à 2 tournois gratuits par mois, puis passez à l’illimité si vous voulez aller plus loin.
            </p>
          </div>
          <button
            type="button"
            className="btn-create-tournament-header"
            onClick={handleOpenCreateModal}
          >
            <span className="btn-icon">{createButtonIcon}</span>
            {createButtonLabel}
          </button>
        </div>
      </div>

      {creationAccess && (
        <div className={`tournaments-creation-card ${creationAccess.has_active_subscription ? 'is-subscriber' : creationAccess.can_create_tournament ? 'is-free' : 'is-locked'}`}>
          <div className="tournaments-creation-copy">
            <span className="tournaments-creation-chip">
              {creationAccess.has_active_subscription
                ? 'Abonnement actif · création illimitée'
                : `${creationAccess.monthly_free_tournaments_remaining}/${creationAccess.monthly_free_tournaments_limit} gratuits restants`
              }
            </span>
            <h3>
              {creationAccess.has_active_subscription
                ? 'Créez autant de tournois que vous voulez'
                : creationAccess.can_create_tournament
                  ? 'Votre quota gratuit mensuel est actif'
                  : 'Passez à l’abonnement pour débloquer l’illimité'
              }
            </h3>
            <p>
              {creationAccess.has_active_subscription
                ? 'Votre abonnement tournoi vous donne un accès illimité à la création, idéal pour organiser plusieurs compétitions chaque mois.'
                : creationAccess.can_create_tournament
                  ? 'Chaque mois, vous pouvez lancer 2 tournois gratuitement. Le compteur se réinitialise automatiquement au début du mois suivant.'
                  : isTournamentSubscriptionEnabled
                    ? 'Vous avez utilisé vos 2 tournois gratuits du mois. L’abonnement tournoi vous permet de continuer sans limite, sur mobile comme sur desktop.'
                    : 'Vous avez utilisé vos 2 tournois gratuits du mois. La souscription tournoi est momentanément suspendue.'
              }
            </p>
          </div>

          <div className="tournaments-creation-metrics">
            <div className="creation-metric">
              <span className="creation-metric-label">Utilisés</span>
              <strong>{creationAccess.monthly_free_tournaments_used}</strong>
            </div>
            <div className="creation-metric">
              <span className="creation-metric-label">Restants</span>
              <strong>{creationAccess.has_active_subscription ? '∞' : creationAccess.monthly_free_tournaments_remaining}</strong>
            </div>
            <div className="creation-metric creation-metric-action">
              <button
                type="button"
                className={`btn ${creationAccess.has_active_subscription ? 'btn-secondary' : creationAccess.can_create_tournament ? 'btn-primary' : 'btn-primary'}`}
                onClick={creationAccess.can_create_tournament ? handleOpenCreateModal : handleOpenTournamentSubscription}
                disabled={!creationAccess.can_create_tournament && !isTournamentSubscriptionEnabled}
              >
                {creationAccess.can_create_tournament ? 'Créer maintenant' : (isTournamentSubscriptionEnabled ? 'Débloquer l’illimité' : 'Indisponible temporairement')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="tournaments-tabs" role="tablist" aria-label="Navigation tournois">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'available' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('available')}
          role="tab"
          aria-selected={activeTab === 'available'}
        >
          <span className="tab-icon" aria-hidden="true">🎯</span>
          <span className="tab-label">Tournois disponibles</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'my-tournaments' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('my-tournaments')}
          role="tab"
          aria-selected={activeTab === 'my-tournaments'}
        >
          <span className="tab-icon" aria-hidden="true">🏅</span>
          <span className="tab-label">Mes tournois rejoints</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'my-created' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('my-created')}
          role="tab"
          aria-selected={activeTab === 'my-created'}
        >
          <span className="tab-icon" aria-hidden="true">{'\u2696\uFE0F'}</span>
          <span className="tab-label">Mes tournois créés</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'finished-tournaments' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('finished-tournaments')}
          role="tab"
          aria-selected={activeTab === 'finished-tournaments'}
        >
          <span className="tab-icon" aria-hidden="true">🏆</span>
          <span className="tab-label">Mes tournois terminés</span>
        </button>
      </div>

      <div className="tournaments-content">
        {/* Available Tournaments Tab */}
        {activeTab === 'available' && (
          <>
            {/* Loading State */}
            {isLoading && (
              <div className="tournaments-loading">
                <div className="loading-spinner" />
                <p className="loading-text">Chargement des tournois...</p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="tournaments-error">
                <span className="error-icon">⚠️</span>
                <h3>Erreur de chargement</h3>
                <p>{error}</p>
                <button className="btn-retry" onClick={() => availableQuery.refetch()}>
                  🔄 Réessayer
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && tournaments.length === 0 && (
              <div className="tournaments-empty">
                <span className="empty-icon">🏆</span>
                <h3>Aucun tournoi disponible</h3>
                <p>Soyez le premier à créer un tournoi !</p>
                <button type="button" className="btn-create-tournament-cta" onClick={handleOpenCreateModal}>
                  <span className="btn-icon">{createButtonIcon}</span>
                  {createButtonLabel}
                </button>
              </div>
            )}

            {/* Tournaments Grid */}
            {!isLoading && !error && tournaments.length > 0 && (
              <>
                <div className="tournaments-grid">
                  {tournaments.map(tournament => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                      onJoin={handleJoinTournament}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="tournaments-pagination">
                    <button
                      className="pagination-btn"
                      onClick={handlePreviousPage}
                      disabled={page === 1}
                    >
                      <span className="pagination-icon">←</span>
                      Précédent
                    </button>

                    <div className="pagination-info">
                      Page <strong>{page}</strong> sur <strong>{totalPages}</strong>
                    </div>

                    <button
                      className="pagination-btn"
                      onClick={handleNextPage}
                      disabled={page === totalPages}
                    >
                      Suivant
                      <span className="pagination-icon">→</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* My Tournaments Tab */}
        {activeTab === 'my-tournaments' && (
          <MyTournaments />
        )}

        {/* My Created Tournaments Tab */}
        {activeTab === 'my-created' && (
          <MyCreatedTournaments />
        )}

        {/* Finished Tournaments Tab */}
        {activeTab === 'finished-tournaments' && (
          <FinishedTournaments />
        )}
      </div>

      {/* Create Tournament Modal */}
      {isCreateModalOpen && (
        <CreateTournamentModal
          onClose={handleCloseCreateModal}
          onTournamentCreated={handleTournamentCreated}
          onSwitchToMyTournaments={() => setActiveTab('my-tournaments')}
          creationAccess={creationAccess}
          onRequireSubscription={handleOpenTournamentSubscription}
        />
      )}

      {isTournamentSubscriptionModalOpen && (
        <TournamentSubscriptionModal
          onClose={handleCloseTournamentSubscription}
          onSubscriptionComplete={() => {
            void creationAccessQuery.refetch();
          }}
        />
      )}

      {/* Join Success Modal */}
      {joinedTournament && (
        <TournamentJoinSuccessModal
          tournament={joinedTournament}
          onClose={() => setJoinedTournament(null)}
        />
      )}
    </div>
  );
};

TournamentsSection.displayName = 'TournamentsSection';

export default TournamentsSection;
