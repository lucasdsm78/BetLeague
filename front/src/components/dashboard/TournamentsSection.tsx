/**
 * Tournaments Section Component
 * Displays tournaments for subscribed users with creation capability
 */

import React, { useState, useCallback, useEffect } from 'react';
import CreateTournamentModal from './CreateTournamentModal';
import TournamentCard from './TournamentCard';
import TournamentJoinSuccessModal from './TournamentJoinSuccessModal';
import MyTournaments from './MyTournaments';
import FinishedTournaments from './FinishedTournaments';
import { useGlobalToast } from '../../toast/ToastProvider';
import { useAvailableTournamentsQuery, useJoinTournamentMutation } from '../../hooks/queries/useTournamentQueries';
import type { Tournament } from '../../services/tournamentApi';
import './TournamentsSection.css';

type TournamentTab = 'available' | 'my-tournaments' | 'finished-tournaments';

const TournamentsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TournamentTab>('available');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [joinedTournament, setJoinedTournament] = useState<Tournament | null>(null);

  const { showInfo, showError } = useGlobalToast();

  const availableQuery = useAvailableTournamentsQuery(page, pageSize, { enabled: activeTab === 'available' });
  const tournaments = availableQuery.data?.tournaments ?? [];
  const totalCount = availableQuery.data?.total_count ?? 0;
  const isLoading = availableQuery.isLoading;
  const error = availableQuery.error?.message ?? null;

  const joinMutation = useJoinTournamentMutation();

  const handleOpenCreateModal = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    console.trace('Close modal stack trace');
    setIsCreateModalOpen(false);
  }, []);

  const handleTournamentCreated = useCallback(() => {
    showInfo('Tournoi créé', 'Votre tournoi a été créé avec succès !');
    setActiveTab('my-tournaments');
  }, [showInfo]);

  const handleJoinTournament = useCallback(async (tournamentId: number): Promise<void> => {
    try {
      await joinMutation.mutateAsync({ tournamentId });
      const tournament = tournaments.find(t => t.id === tournamentId);
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
              Participez aux tournois exclusifs et devenez champion !
            </p>
          </div>
          <button
            type="button"
            className="btn-create-tournament-header"
            onClick={handleOpenCreateModal}
          >
            <span className="btn-icon">➕</span>
            Créer un tournoi
          </button>
        </div>
      </div>

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
                  <span className="btn-icon">➕</span>
                  Créer un tournoi
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
