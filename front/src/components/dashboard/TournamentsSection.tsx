/**
 * Tournaments Section Component
 * Displays tournaments for subscribed users with creation capability
 */

import React, { useState, useCallback, memo, useEffect } from 'react';
import CreateTournamentModal from './CreateTournamentModal';
import TournamentCard from './TournamentCard';
import { useToast } from '../../hooks/useToast';
import { getTournaments, joinTournament, type Tournament } from '../../services/tournamentApi';
import './TournamentsSection.css';

const TournamentsSection: React.FC = memo(() => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(10);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const { showInfo, showError, showSuccess } = useToast();

  // Load tournaments on mount, when page changes, or when refresh is triggered
  useEffect(() => {
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
  }, [page, pageSize, refreshCounter]); // showError intentionally omitted to prevent infinite loop

  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleTournamentCreated = useCallback(() => {
    showInfo('Tournoi créé', 'Votre tournoi a été créé avec succès !');
    setRefreshCounter(prev => prev + 1);
  }, [showInfo]);

  const handleJoinTournament = useCallback(async (tournamentId: number) => {
    try {
      await joinTournament(tournamentId);
      showSuccess('Succès', 'Vous avez rejoint le tournoi !');
      setRefreshCounter(prev => prev + 1);
    } catch (err: any) {
      console.error('Error joining tournament:', err);
      showError('Erreur', err.message || 'Impossible de rejoindre le tournoi');
    }
  }, [showSuccess, showError]);

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
            className="btn-create-tournament-header"
            onClick={handleOpenCreateModal}
          >
            <span className="btn-icon">➕</span>
            Créer un tournoi
          </button>
        </div>
      </div>

      <div className="tournaments-content">
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
            <button className="btn-create-tournament-cta" onClick={handleOpenCreateModal}>
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
      </div>

      {/* Create Tournament Modal */}
      {isCreateModalOpen && (
        <CreateTournamentModal
          onClose={handleCloseCreateModal}
          onTournamentCreated={handleTournamentCreated}
        />
      )}
    </div>
  );
});

TournamentsSection.displayName = 'TournamentsSection';

export default TournamentsSection;