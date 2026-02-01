/**
 * MyTournaments - Premium component for displaying user's registered tournaments
 * Shows all tournaments the user is currently participating in
 */

import React, { memo, useState, useCallback } from 'react';
import { useMyTournamentsQuery } from '../../hooks/queries/useTournamentQueries';
import type { MyTournament } from '../../types/api/tournament';
import TournamentStages from './TournamentStages';
import { useGlobalToast } from '../../toast/ToastProvider';
import './MyTournaments.css';

const MyTournaments: React.FC = memo(() => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const { showError } = useGlobalToast();

  const myQuery = useMyTournamentsQuery(page, pageSize);
  const tournaments = myQuery.data?.tournaments ?? [];
  const totalCount = myQuery.data?.total_count ?? 0;
  const isLoading = myQuery.isLoading;
  const error = myQuery.error?.message ?? null;

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

  const handleViewStages = useCallback((tournamentId: number) => {
    setSelectedTournamentId(selectedTournamentId === tournamentId ? null : tournamentId);
  }, [selectedTournamentId]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="my-tournaments">
      {/* Header */}
      <div className="my-tournaments-header">
        <div className="my-tournaments-header-content">
          <div className="my-tournaments-header-text">
            <h2 className="my-tournaments-title">
              <span className="title-icon">🏅</span>
              Mes tournois rejoints
            </h2>
            <p className="my-tournaments-subtitle">
              Tous les tournois que vous avez rejoints
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="my-tournaments-content">
        {/* Loading State */}
        {isLoading && (
          <div className="my-tournaments-loading">
            <div className="loading-spinner" />
            <p className="loading-text">Chargement de vos tournois...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="my-tournaments-error">
            <span className="error-icon">⚠️</span>
            <h3>Erreur de chargement</h3>
            <p>{error}</p>
            <button className="btn-retry" onClick={() => myQuery.refetch()}>
              🔄 Réessayer
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && tournaments.length === 0 && (
          <div className="my-tournaments-empty">
            <span className="empty-icon">🎯</span>
            <h3>Aucun tournoi rejoint</h3>
            <p>Vous n'êtes inscrit à aucun tournoi pour le moment.</p>
            <p className="empty-hint">Rejoignez ou créez un tournoi pour commencer à jouer !</p>
          </div>
        )}

        {/* Tournaments List */}
        {!isLoading && !error && tournaments.length > 0 && (
          <>
            <div className="my-tournaments-list">
              {tournaments.map((tournament: MyTournament) => (
                <div key={tournament.id} className="my-tournament-card">
                  {/* Card Header */}
                  <div className="my-tournament-card-header">
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

                    <button
                      className="btn-view-stages"
                      onClick={() => handleViewStages(tournament.id)}
                    >
                      <span className="btn-icon">
                        {selectedTournamentId === tournament.id ? '▼' : '▶'}
                      </span>
                      {selectedTournamentId === tournament.id ? 'Masquer les étapes' : 'Voir les étapes'}
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="my-tournament-card-body">
                    <div className="tournament-stats">
                      <div className="stat-item">
                        <span className="stat-icon">👥</span>
                        <div className="stat-content">
                          <span className="stat-label">Joueurs max</span>
                          <span className="stat-value">{tournament.max_players}</span>
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

                  {/* Stages Section (Expandable) */}
                  {selectedTournamentId === tournament.id && (
                    <div className="my-tournament-stages-container">
                      <TournamentStages
                        tournamentId={tournament.id}
                        tournamentName={tournament.name}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="my-tournaments-pagination">
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

MyTournaments.displayName = 'MyTournaments';

export default MyTournaments;
