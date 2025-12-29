/**
 * Tournaments Section Component
 * Displays tournaments for subscribed users with creation capability
 */

import React, { useState, useCallback, useEffect } from 'react';
import CreateTournamentModal from './CreateTournamentModal';
import TournamentCard from './TournamentCard';
import TournamentJoinSuccessModal from './TournamentJoinSuccessModal';
import MyTournaments from './MyTournaments';
import { useToast } from '../../hooks/useToast';
import { getTournaments, joinTournament, type Tournament } from '../../services/tournamentApi';
import './TournamentsSection.css';

type TournamentTab = 'available' | 'my-tournaments';

const TournamentsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TournamentTab>('available');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Debug log to track state changes
  useEffect(() => {
  }, [isCreateModalOpen]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(10);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [joinedTournament, setJoinedTournament] = useState<Tournament | null>(null);
  const { showInfo, showError, showSuccess } = useToast();

  // Load tournaments on mount, when page changes, or when refresh is triggered
  useEffect(() => {
    // Only fetch available tournaments when on the "available" tab
    if (activeTab !== 'available') {
      return;
    }

    let isMounted = true;

    const fetchTournaments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getTournaments(page, pageSize);
        if (isMounted) {
          setTournaments(response.tournaments);
          setTotalCount(response.total_count);
        }
      } catch (err: any) {
        console.error('Error fetching tournaments:', err);
        if (isMounted) {
          setError(err.message || 'Erreur lors du chargement des tournois');
          showError('Erreur', 'Impossible de charger les tournois');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTournaments();

    return () => {
      isMounted = false;
    };
  }, [activeTab, page, pageSize, refreshCounter]); // showError intentionally omitted to prevent infinite loop

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
    setRefreshCounter(prev => prev + 1);
  }, []); // Removed showInfo - it's stable and doesn't need to trigger re-creation

  const handleJoinTournament = useCallback(async (tournamentId: number): Promise<void> => {
    try {
      await joinTournament(tournamentId);

      const tournament = tournaments.find(t => t.id === tournamentId);
      if (tournament) {
        setJoinedTournament(tournament);
      }

      setRefreshCounter(prev => prev + 1);
    } catch (err: any) {
      console.error('Error joining tournament:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Impossible de rejoindre le tournoi';
      showError('Erreur', errorMessage);
      throw err;
    }
  }, [tournaments]); // Removed showError - it's stable and doesn't need to trigger re-creation

  const handlePreviousPage = useCallback(() => {
    if (page > 1) {
      setPage(prev => prev - 1);
    }
  }, [page]);

  const handleNextPage = useCallback(() => {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (page < totalPages) {
      setPage(prev => prev + 1);
    }
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
      <div className="tournaments-tabs">
        <button
          className={`tab-btn ${activeTab === 'available' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('available')}
        >
          <span className="tab-icon">🎯</span>
          Tournois disponibles
        </button>
        <button
          className={`tab-btn ${activeTab === 'my-tournaments' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('my-tournaments')}
        >
          <span className="tab-icon">🏅</span>
          Mes tournois
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
                <button className="btn-retry" onClick={() => setRefreshCounter(prev => prev + 1)}>
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
      </div>

      {/* Create Tournament Modal */}
      {isCreateModalOpen && (
        <CreateTournamentModal
          onClose={handleCloseCreateModal}
          onTournamentCreated={handleTournamentCreated}
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
