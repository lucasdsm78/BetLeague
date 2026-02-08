/**
 * MyCreatedTournaments - Component for displaying tournaments created by the user
 * Shows all tournaments the user has created with dates, stages and management info
 */

import React, { memo, useState, useCallback } from 'react';
import { useMyCreatedTournamentsQuery } from '../../hooks/queries/useTournamentQueries';
import type { CreatedTournament } from '../../types/api/tournament';
import TournamentStages from './TournamentStages';
import './MyCreatedTournaments.css';

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MyCreatedTournaments: React.FC = memo(() => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);

  const query = useMyCreatedTournamentsQuery(page, pageSize);
  const tournaments = query.data?.tournaments ?? [];
  const totalCount = query.data?.total_count ?? 0;
  const isLoading = query.isLoading;
  const error = query.error?.message ?? null;

  const handlePreviousPage = useCallback(() => {
    if (page > 1) setPage(prev => prev - 1);
  }, [page]);

  const handleNextPage = useCallback(() => {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (page < totalPages) setPage(prev => prev + 1);
  }, [page, totalCount, pageSize]);

  const handleViewStages = useCallback((tournamentId: number) => {
    setSelectedTournamentId(prev => (prev === tournamentId ? null : tournamentId));
  }, []);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="created-tournaments">
      {/* Header */}
      <div className="created-tournaments-header">
        <div className="created-tournaments-header-content">
          <div className="created-tournaments-header-text">
            <h2 className="created-tournaments-title">
              <span className="title-icon">{'\u2696\uFE0F'}</span>
              Mes tournois créés
            </h2>
            <p className="created-tournaments-subtitle">
              Tous les tournois que vous avez créés et organisez
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="created-tournaments-content">
        {/* Loading State */}
        {isLoading && (
          <div className="created-tournaments-loading">
            <div className="created-loading-spinner" />
            <p className="created-loading-text">Chargement de vos tournois...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="created-tournaments-error">
            <span className="created-error-icon">⚠️</span>
            <h3>Erreur de chargement</h3>
            <p>{error}</p>
            <button className="created-btn-retry" onClick={() => query.refetch()}>
              🔄 Réessayer
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && tournaments.length === 0 && (
          <div className="created-tournaments-empty">
            <span className="created-empty-icon">🛠️</span>
            <h3>Aucun tournoi créé</h3>
            <p>Vous n'avez pas encore créé de tournoi.</p>
            <p className="created-empty-hint">
              Créez votre premier tournoi depuis l'onglet « Tournois disponibles » !
            </p>
          </div>
        )}

        {/* Tournaments List */}
        {!isLoading && !error && tournaments.length > 0 && (
          <>
            <div className="created-tournaments-list">
              {tournaments.map((tournament: CreatedTournament) => (
                <div key={tournament.id} className="created-tournament-card">
                  {/* Card Header */}
                  <div className="created-tournament-card-header">
                    <div className="created-tournament-info">
                      <h3 className="created-tournament-name">
                        {tournament.name}
                      </h3>
                      {tournament.is_private && (
                        <span className="created-badge-private">
                          🔒 Privé
                        </span>
                      )}
                    </div>

                    <button
                      className="created-btn-view-stages"
                      onClick={() => handleViewStages(tournament.id)}
                    >
                      <span className="created-btn-icon">
                        {selectedTournamentId === tournament.id ? '\u25BC' : '\u25B6'}
                      </span>
                      {selectedTournamentId === tournament.id ? 'Masquer les \u00e9tapes' : 'Voir les \u00e9tapes'}
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="created-tournament-card-body">
                    <div className="created-tournament-stats">
                      <div className="created-stat-item">
                        <span className="created-stat-icon">📅</span>
                        <div className="created-stat-content">
                          <span className="created-stat-label">Début</span>
                          <span className="created-stat-value">{formatDate(tournament.start_date)}</span>
                        </div>
                      </div>

                      <div className="created-stat-item">
                        <span className="created-stat-icon">🏁</span>
                        <div className="created-stat-content">
                          <span className="created-stat-label">Fin</span>
                          <span className="created-stat-value">{formatDate(tournament.end_date)}</span>
                        </div>
                      </div>

                      <div className="created-stat-item">
                        <span className="created-stat-icon">🆔</span>
                        <div className="created-stat-content">
                          <span className="created-stat-label">ID</span>
                          <span className="created-stat-value">#{tournament.id}</span>
                        </div>
                      </div>

                      <div className="created-stat-item">
                        <span className="created-stat-icon">📋</span>
                        <div className="created-stat-content">
                          <span className="created-stat-label">UUID</span>
                          <span className="created-stat-value created-stat-uuid">
                            {tournament.uuid.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stages Section (Expandable) */}
                  {selectedTournamentId === tournament.id && (
                    <div className="created-tournament-stages-container">
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
              <div className="created-tournaments-pagination">
                <button
                  className="created-pagination-btn"
                  onClick={handlePreviousPage}
                  disabled={page === 1}
                >
                  <span className="created-pagination-icon">←</span>
                  Précédent
                </button>

                <div className="created-pagination-info">
                  Page <strong>{page}</strong> sur <strong>{totalPages}</strong>
                </div>

                <button
                  className="created-pagination-btn"
                  onClick={handleNextPage}
                  disabled={page === totalPages}
                >
                  Suivant
                  <span className="created-pagination-icon">→</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

MyCreatedTournaments.displayName = 'MyCreatedTournaments';

export default MyCreatedTournaments;
