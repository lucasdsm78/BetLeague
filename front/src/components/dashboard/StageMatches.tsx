/**
 * StageMatches - Premium component for displaying matches of a tournament stage
 * Shows all player matchups in a specific tournament stage
 */

import React, { memo, useState, useEffect, useCallback } from 'react';
import { getStageMatches, type StageMatch } from '../../services/tournamentApi';
import { useToast } from '../../hooks/useToast';
import './StageMatches.css';

interface StageMatchesProps {
  tournamentId: number;
  stageType: string;
  stageName: string;
}

const StageMatches: React.FC<StageMatchesProps> = memo(({
  tournamentId,
  stageType,
  stageName
}) => {
  const [matches, setMatches] = useState<StageMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useToast();

  // Fetch matches on mount
  const fetchMatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getStageMatches(tournamentId, stageType);
      setMatches(response.matches || []);
    } catch (err: any) {
      console.error('Error fetching stage matches:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Impossible de charger les matchs';
      setError(errorMessage);
      showError('Erreur', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId, stageType]); // Removed showError from deps - it's stable

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Format date from timestamp
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if match is ongoing
  const isMatchOngoing = (startDate: number, endDate: number): boolean => {
    const now = Date.now();
    return now >= startDate && now <= endDate;
  };

  // Check if match is completed
  const isMatchCompleted = (winnerId: number | null): boolean => {
    return winnerId !== null;
  };

  return (
    <div className="stage-matches">
      {/* Header */}
      <div className="stage-matches-header">
        <h4 className="stage-matches-title">
          <span className="matches-icon">⚔️</span>
          {stageName}
        </h4>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="stage-matches-loading">
          <div className="stage-matches-spinner" />
          <p className="stage-matches-loading-text">Chargement des matchs...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="stage-matches-error">
          <span className="stage-matches-error-icon">⚠️</span>
          <h5>Erreur de chargement</h5>
          <p>{error}</p>
          <button className="btn-retry-matches" onClick={fetchMatches}>
            🔄 Réessayer
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && matches.length === 0 && (
        <div className="stage-matches-empty">
          <span className="stage-matches-empty-icon">🎯</span>
          <h5>Aucun match disponible</h5>
          <p>Les matchs de cette étape n'ont pas encore été créés.</p>
        </div>
      )}

      {/* Matches Grid */}
      {!isLoading && !error && matches.length > 0 && (
        <div className="stage-matches-grid">
          {matches.map((match) => {
            const isOngoing = isMatchOngoing(match.start_date, match.end_date);
            const isCompleted = isMatchCompleted(match.winner_id);
            const player1IsWinner = match.winner_id === match.player1_summary.id;
            const player2IsWinner = match.winner_id === match.player2_summary.id;

            return (
              <div
                key={match.id}
                className={`stage-match-card ${isOngoing ? 'ongoing' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                {/* Status Badge */}
                {isOngoing && !isCompleted && (
                  <div className="match-status-badge ongoing-badge">
                    <span className="status-dot" />
                    EN COURS
                  </div>
                )}
                {isCompleted && (
                  <div className="match-status-badge completed-badge">
                    ✓ TERMINÉ
                  </div>
                )}

                {/* Match Dates */}
                <div className="match-period">
                  <div className="match-period-item">
                    <span className="period-label">Début</span>
                    <span className="period-value">{formatDate(match.start_date)}</span>
                  </div>
                  <div className="match-period-item">
                    <span className="period-label">Fin</span>
                    <span className="period-value">{formatDate(match.end_date)}</span>
                  </div>
                </div>

                {/* Players Matchup */}
                <div className="players-matchup">
                  <div className={`player-card ${player1IsWinner ? 'winner' : ''} ${match.loser_id === match.player1_summary.id ? 'loser' : ''}`}>
                    <div className="player-info">
                      <div className="player-avatar">{match.player1_summary.pseudo.charAt(0).toUpperCase()}</div>
                      <div className="player-details">
                        <span className="player-name">{match.player1_summary.pseudo}</span>
                        <span className="player-email">{match.player1_summary.email}</span>
                      </div>
                    </div>
                    {player1IsWinner && <div className="winner-crown">👑</div>}
                  </div>

                  <div className="vs-divider">
                    <span className="vs-text">VS</span>
                  </div>

                  <div className={`player-card ${player2IsWinner ? 'winner' : ''} ${match.loser_id === match.player2_summary.id ? 'loser' : ''}`}>
                    <div className="player-info">
                      <div className="player-avatar">{match.player2_summary.pseudo.charAt(0).toUpperCase()}</div>
                      <div className="player-details">
                        <span className="player-name">{match.player2_summary.pseudo}</span>
                        <span className="player-email">{match.player2_summary.email}</span>
                      </div>
                    </div>
                    {player2IsWinner && <div className="winner-crown">👑</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

StageMatches.displayName = 'StageMatches';

export default StageMatches;
