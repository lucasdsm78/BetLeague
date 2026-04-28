/**
 * TournamentCard - Premium card component for displaying tournament
 */

import React, { memo, useMemo, useState } from 'react';
import type { Tournament } from '../../types/api/tournament';
import './TournamentCard.css';

interface TournamentCardProps {
  tournament: Tournament;
  onJoin: (tournamentId: number) => Promise<void>;
}

const TournamentCard: React.FC<TournamentCardProps> = memo(({ tournament, onJoin }) => {
  const [isJoining, setIsJoining] = useState(false);
  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    return Math.round((tournament.current_players / tournament.max_players) * 100);
  }, [tournament.current_players, tournament.max_players]);

  // Format dates
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate days remaining
  const daysRemaining = useMemo(() => {
    const now = Date.now();
    const diff = tournament.start_date - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [tournament.start_date]);

  // Check if full
  const isFull = tournament.current_players >= tournament.max_players;

  // Check if started
  const hasStarted = Date.now() >= tournament.start_date;

  const handleJoinClick = async () => {
    if (!isFull && !isJoining) {
      setIsJoining(true);
      try {
        await onJoin(tournament.id);
      } catch (error) {
        console.error('Failed to join tournament:', error);
      } finally {
        setIsJoining(false);
      }
    }
  };

  return (
    <div className={`tournament-card ${isFull ? 'tournament-card-full' : ''} ${hasStarted ? 'tournament-card-started' : ''}`}>
      {/* Header */}
      <div className="tournament-card-header">
        <div className="tournament-badge-container">
          {tournament.is_private && (
            <span className="tournament-badge badge-private">
              🔒 Privé
            </span>
          )}
          {!isFull && !hasStarted && (
            <span className="tournament-badge badge-open">
              ✨ Ouvert
            </span>
          )}
          {isFull && !hasStarted && (
            <span className="tournament-badge badge-full">
              🔴 Complet
            </span>
          )}
          {hasStarted && (
            <span className="tournament-badge badge-started">
              En cours
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="tournament-card-title">{tournament.name}</h3>

      {/* Players Info */}
      <div className="tournament-players">
        <div className="players-count">
          <span className="players-icon">👥</span>
          <span className="players-text">
            <strong>{tournament.current_players}</strong> / {tournament.max_players} joueurs
          </span>
        </div>

        <div className="players-progress-bar">
          <div
            className="players-progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="players-percentage">{progressPercentage}% rempli</div>
      </div>

      {/* Dates */}
      <div className="tournament-dates">
        <div className="tournament-date-item">
          <span className="date-icon">📅</span>
          <div className="date-content">
            <span className="date-label">Début</span>
            <span className="date-value">{formatDate(tournament.start_date)}</span>
          </div>
        </div>

        <div className="tournament-date-item">
          <span className="date-icon">🏁</span>
          <div className="date-content">
            <span className="date-label">Fin</span>
            <span className="date-value">{formatDate(tournament.end_date)}</span>
          </div>
        </div>
      </div>

      {/* Time Remaining */}
      {!hasStarted && daysRemaining > 0 && (
        <div className="tournament-countdown">
          <span className="countdown-icon">⏳</span>
          <span className="countdown-text">
            Début dans <strong>{daysRemaining} jour{daysRemaining > 1 ? 's' : ''}</strong>
          </span>
        </div>
      )}

      {/* Action Button */}
      <button
        className={`tournament-join-btn ${isFull || isJoining ? 'btn-disabled' : ''} ${isJoining ? 'btn-loading' : ''}`}
        onClick={handleJoinClick}
        disabled={isFull || isJoining}
      >
        {isJoining ? (
          <>
            <span className="btn-spinner" />
            Inscription en cours...
          </>
        ) : isFull ? (
          <>
            <span className="btn-icon">🔴</span>
            Complet
          </>
        ) : (
          <>
            <span className="btn-icon">🏆</span>
            Rejoindre
          </>
        )}
      </button>
    </div>
  );
});

TournamentCard.displayName = 'TournamentCard';

export default TournamentCard;
