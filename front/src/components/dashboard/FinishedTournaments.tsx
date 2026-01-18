/**
 * FinishedTournaments - Premium component for displaying user's finished tournaments
 * Shows all completed tournaments with winner information and final results
 */

import React, { memo, useState, useEffect, useCallback } from 'react';
import { getFinishedTournaments, type TournamentFinished } from '../../services/tournamentApi';
import { useGlobalToast } from '../../toast/ToastProvider';
import './FinishedTournaments.css';

const FinishedTournaments: React.FC = memo(() => {
  const [tournaments, setTournaments] = useState<TournamentFinished[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(10);
  const { showError } = useGlobalToast();

  useEffect(() => {
    let isMounted = true;

    const loadTournaments = async () => {
      if (!isMounted) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await getFinishedTournaments(page, pageSize);
        if (isMounted) {
          setTournaments(response.tournaments);
          setTotalCount(response.total_count);
        }
      } catch (err: any) {
        console.error('Error fetching finished tournaments:', err);

        if (!isMounted) return;

        const statusCode = err.status || err.response?.status;
        const errorDetail = typeof err.details === 'string'
          ? err.details
          : err.details?.detail || err.response?.data?.detail;

        let errorMessage = 'Impossible de charger vos tournois terminés';

        if (statusCode === 404) {
          if (errorDetail?.includes('User') || errorDetail?.includes('utilisateur')) {
            errorMessage = 'Utilisateur introuvable. Veuillez vous reconnecter.';
          }
        } else if (statusCode === 500) {
          errorMessage = 'Erreur serveur lors de la récupération de vos tournois';
        } else if (errorDetail) {
          errorMessage = errorDetail;
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        showError('Erreur', errorMessage);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTournaments();

    return () => {
      isMounted = false;
    };
  }, [page, pageSize]); // showError intentionally omitted to prevent infinite loop

  const fetchFinishedTournaments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getFinishedTournaments(page, pageSize);
      setTournaments(response.tournaments);
      setTotalCount(response.total_count);
    } catch (err: any) {
      console.error('Error fetching finished tournaments:', err);

      const statusCode = err.status || err.response?.status;
      const errorDetail = typeof err.details === 'string'
        ? err.details
        : err.details?.detail || err.response?.data?.detail;

      let errorMessage = 'Impossible de charger vos tournois terminés';

      if (statusCode === 404) {
        if (errorDetail?.includes('User') || errorDetail?.includes('utilisateur')) {
          errorMessage = 'Utilisateur introuvable. Veuillez vous reconnecter.';
        }
      } else if (statusCode === 500) {
        errorMessage = 'Erreur serveur lors de la récupération de vos tournois';
      } else if (errorDetail) {
        errorMessage = errorDetail;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      showError('Erreur', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

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

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="finished-tournaments">
      {/* Header */}
      <div className="finished-tournaments-header">
        <div className="finished-tournaments-header-content">
          <div className="finished-tournaments-header-text">
            <h2 className="finished-tournaments-title">
              <span className="title-icon">🏆</span>
              Mes tournois terminés
            </h2>
            <p className="finished-tournaments-subtitle">
              Historique de tous vos tournois terminés
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="finished-tournaments-content">
        {/* Loading State */}
        {isLoading && (
          <div className="finished-tournaments-loading">
            <div className="loading-spinner" />
            <p className="loading-text">Chargement de vos tournois terminés...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="finished-tournaments-error">
            <span className="error-icon">⚠️</span>
            <h3>Erreur de chargement</h3>
            <p>{error}</p>
            <button className="btn-retry" onClick={fetchFinishedTournaments}>
              🔄 Réessayer
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && tournaments.length === 0 && (
          <div className="finished-tournaments-empty">
            <span className="empty-icon">📜</span>
            <h3>Aucun tournoi terminé</h3>
            <p>Vous n'avez pas encore participé à un tournoi qui s'est terminé.</p>
          </div>
        )}

        {/* Tournaments List */}
        {!isLoading && !error && tournaments.length > 0 && (
          <>
            <div className="finished-tournaments-list">
              {tournaments.map(tournament => (
                <div key={tournament.id} className="finished-tournament-card">
                  {/* Card Header */}
                  <div className="finished-tournament-card-header">
                    <div className="tournament-info">
                      <h3 className="tournament-name">
                        {tournament.name}
                      </h3>
                      {tournament.is_private && (
                        <span className="badge-private">
                          🔒 Privé
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="finished-tournament-card-body">
                    <div className="tournament-stats">
                      <div className="stat-item">
                        <span className="stat-icon">📅</span>
                        <div className="stat-content">
                          <span className="stat-label">Début</span>
                          <span className="stat-value">{formatDate(tournament.start_date)}</span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <span className="stat-icon">🏁</span>
                        <div className="stat-content">
                          <span className="stat-label">Fin</span>
                          <span className="stat-value">{formatDate(tournament.end_date)}</span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <span className="stat-icon">🆔</span>
                        <div className="stat-content">
                          <span className="stat-label">ID</span>
                          <span className="stat-value">#{tournament.id}</span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <span className="stat-icon">📋</span>
                        <div className="stat-content">
                          <span className="stat-label">UUID</span>
                          <span className="stat-value stat-uuid">{tournament.uuid.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="finished-tournaments-pagination">
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
    </div>
  );
});

FinishedTournaments.displayName = 'FinishedTournaments';

export default FinishedTournaments;
