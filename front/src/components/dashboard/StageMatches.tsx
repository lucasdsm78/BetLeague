/**
 * StageMatches - Premium component for displaying matches of a tournament stage
 * Shows all matches in a specific stage with betting odds and match details
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

  // Format date and time
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return { date: dateStr, time: timeStr };
  };

  // Check if match is live (within 2 hours of start time)
  const isMatchLive = (isoString: string): boolean => {
    const matchTime = new Date(isoString).getTime();
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;
    return matchTime <= now && now <= matchTime + twoHours;
  };

  return (
    <div className="stage-matches">
      {/* Header */}
      <div className="stage-matches-header">
        <h4 className="stage-matches-title">
          <span className="matches-icon">⚽</span>
          Matchs - {stageName}
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
            const { date, time } = formatDateTime(match.time);
            const isLive = isMatchLive(match.time);

            return (
              <div
                key={match.id}
                className={`stage-match-card ${isLive ? 'live' : ''}`}
              >
                {/* Live Badge */}
                {isLive && (
                  <div className="match-live-badge">
                    <span className="live-dot" />
                    EN DIRECT
                  </div>
                )}

                {/* Match Time */}
                <div className="match-datetime">
                  <span className="match-date">{date}</span>
                  <span className="match-time">{time}</span>
                </div>

                {/* Teams */}
                <div className="match-teams">
                  <div className="match-team match-home">
                    <span className="team-name">{match.home_team}</span>
                  </div>

                  <div className="match-vs">vs</div>

                  <div className="match-team match-away">
                    <span className="team-name">{match.away_team}</span>
                  </div>
                </div>

                {/* Odds */}
                <div className="match-odds">
                  <div className="odd-item odd-home">
                    <span className="odd-label">1</span>
                    <span className="odd-value">
                      {match.cote_home != null ? match.cote_home.toFixed(2) : '-'}
                    </span>
                  </div>

                  <div className="odd-item odd-draw">
                    <span className="odd-label">N</span>
                    <span className="odd-value">
                      {match.cote_draw != null ? match.cote_draw.toFixed(2) : '-'}
                    </span>
                  </div>

                  <div className="odd-item odd-away">
                    <span className="odd-label">2</span>
                    <span className="odd-value">
                      {match.cote_away != null ? match.cote_away.toFixed(2) : '-'}
                    </span>
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
