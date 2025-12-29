import React, { memo, useState, useEffect, useCallback } from 'react';
import { getCreatedTournaments, type TournamentCreated } from '../../services/tournamentApi';
import { useToast } from '../../hooks/useToast';
import EditTournamentModal from './EditTournamentModal';
import './CreatedTournaments.css';

const CreatedTournaments: React.FC = memo(() => {
  const [tournaments, setTournaments] = useState<TournamentCreated[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(10);
  const [editingTournament, setEditingTournament] = useState<TournamentCreated | null>(null);
  const { showError } = useToast();

  const fetchCreatedTournaments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getCreatedTournaments(page, pageSize);
      setTournaments(response.tournaments);
      setTotalCount(response.total_count);
    } catch (err: any) {
      console.error('Error fetching created tournaments:', err);

      const statusCode = err.status || err.response?.status;
      const errorDetail = typeof err.details === 'string'
        ? err.details
        : err.details?.detail || err.response?.data?.detail;

      let errorMessage = 'Impossible de charger vos tournois créés';

      if (statusCode === 402) {
        errorMessage = 'Abonnement requis pour accéder à vos tournois créés';
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

  useEffect(() => {
    let isMounted = true;

    const loadTournaments = async () => {
      if (!isMounted) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await getCreatedTournaments(page, pageSize);
        if (isMounted) {
          setTournaments(response.tournaments);
          setTotalCount(response.total_count);
        }
      } catch (err: any) {
        console.error('Error fetching created tournaments:', err);

        if (!isMounted) return;

        const statusCode = err.status || err.response?.status;
        const errorDetail = typeof err.details === 'string'
          ? err.details
          : err.details?.detail || err.response?.data?.detail;

        let errorMessage = 'Impossible de charger vos tournois créés';

        if (statusCode === 402) {
          errorMessage = 'Abonnement requis pour accéder à vos tournois créés';
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

  const handleEditTournament = useCallback((tournament: TournamentCreated) => {
    setEditingTournament(tournament);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setEditingTournament(null);
  }, []);

  const handleTournamentUpdated = useCallback(() => {
    fetchCreatedTournaments();
  }, [fetchCreatedTournaments]);

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
    <div className="created-tournaments">
      {/* Header */}
      <div className="created-tournaments-header">
        <div className="created-tournaments-header-content">
          <div className="created-tournaments-header-text">
            <h2 className="created-tournaments-title">
              <span className="title-icon">👑</span>
              Mes tournois créés
            </h2>
            <p className="created-tournaments-subtitle">
              Gérez et suivez tous les tournois que vous avez créés
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="created-tournaments-content">
        {/* Loading State */}
        {isLoading && (
          <div className="created-tournaments-loading">
            <div className="loading-spinner" />
            <p className="loading-text">Chargement de vos tournois créés...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="created-tournaments-error">
            <span className="error-icon">⚠️</span>
            <h3>Erreur de chargement</h3>
            <p>{error}</p>
            <button className="btn-retry" onClick={fetchCreatedTournaments}>
              🔄 Réessayer
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && tournaments.length === 0 && (
          <div className="created-tournaments-empty">
            <span className="empty-icon">🎯</span>
            <h3>Aucun tournoi créé</h3>
            <p>Vous n'avez pas encore créé de tournoi.</p>
            <p className="empty-hint">Créez votre premier tournoi pour commencer à organiser vos compétitions !</p>
          </div>
        )}

        {/* Tournaments List */}
        {!isLoading && !error && tournaments.length > 0 && (
          <>
            <div className="created-tournaments-list">
              {tournaments.map(tournament => (
                <div key={tournament.id} className="created-tournament-card">
                  {/* Card Header */}
                  <div className="created-tournament-card-header">
                    <div className="tournament-info">
                      <h3 className="tournament-name">
                        {tournament.name}
                      </h3>
                      {tournament.is_private && (
                        <span className="badge-private">
                          🔒 Privé
                        </span>
                      )}
                      {!tournament.is_private && (
                        <span className="badge-public">
                          🌍 Public
                        </span>
                      )}
                    </div>
                    <button
                      className="btn-edit-tournament"
                      onClick={() => handleEditTournament(tournament)}
                      title="Modifier le tournoi"
                    >
                      <span className="btn-icon">✏️</span>
                      <span className="btn-text">Modifier</span>
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="created-tournament-card-body">
                    {/* Tournament Dates */}
                    <div className="tournament-dates">
                      <div className="date-item">
                        <span className="date-icon">📅</span>
                        <div className="date-content">
                          <span className="date-label">Début</span>
                          <span className="date-value">{formatDate(tournament.start_date)}</span>
                        </div>
                      </div>

                      <div className="date-separator">→</div>

                      <div className="date-item">
                        <span className="date-icon">🏁</span>
                        <div className="date-content">
                          <span className="date-label">Fin</span>
                          <span className="date-value">{formatDate(tournament.end_date)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tournament Meta */}
                    <div className="tournament-meta">
                      <div className="meta-item">
                        <span className="meta-icon">🆔</span>
                        <div className="meta-content">
                          <span className="meta-label">ID</span>
                          <span className="meta-value">#{tournament.id}</span>
                        </div>
                      </div>

                      <div className="meta-item">
                        <span className="meta-icon">📋</span>
                        <div className="meta-content">
                          <span className="meta-label">UUID</span>
                          <span className="meta-value meta-uuid">{tournament.uuid.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="created-tournaments-pagination">
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

      {/* Edit Tournament Modal */}
      {editingTournament && (
        <EditTournamentModal
          tournament={{
            id: editingTournament.id,
            uuid: editingTournament.uuid,
            name: editingTournament.name,
            is_private: editingTournament.is_private,
            max_players: 0,
            current_players: 0,
            start_date: editingTournament.start_date,
            end_date: editingTournament.end_date
          }}
          onClose={handleCloseEditModal}
          onTournamentUpdated={handleTournamentUpdated}
        />
      )}
    </div>
  );
});

CreatedTournaments.displayName = 'CreatedTournaments';

export default CreatedTournaments;
