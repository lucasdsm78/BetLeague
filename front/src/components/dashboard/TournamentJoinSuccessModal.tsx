/**
 * TournamentJoinSuccessModal - Premium success confirmation modal
 * Displays when user successfully joins a tournament
 */

import React, { memo, useEffect, useState } from 'react';
import type { Tournament } from '../../services/api/tournament';
import './TournamentJoinSuccessModal.css';

interface TournamentJoinSuccessModalProps {
  tournament: Tournament;
  onClose: () => void;
}

const TournamentJoinSuccessModal: React.FC<TournamentJoinSuccessModalProps> = memo(({
  tournament,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      setShowConfetti(true);
    }, 50);

    const confettiTimer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(confettiTimer);
    };
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const daysUntilStart = () => {
    const now = Date.now();
    const diff = tournament.start_date - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div
      className={`modal-overlay ${isVisible ? 'modal-overlay-visible' : ''}`}
      onClick={handleClose}
    >
      {/* Confetti effect */}
      {showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`
              }}
            />
          ))}
        </div>
      )}

      <div
        className={`modal-content ${isVisible ? 'modal-content-visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Icon */}
        <div className="modal-icon-container">
          <div className="success-checkmark">
            <div className="check-icon">
              <span className="icon-line line-tip"></span>
              <span className="icon-line line-long"></span>
              <div className="icon-circle"></div>
              <div className="icon-fix"></div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="modal-body">
          <h2 className="modal-title">🎉 Inscription confirmée !</h2>
          <p className="modal-subtitle">
            Vous avez rejoint le tournoi avec succès
          </p>

          {/* Tournament Info Card */}
          <div className="tournament-info-card">
            <div className="info-header">
              <h3 className="tournament-name">{tournament.name}</h3>
              {tournament.is_private && (
                <span className="badge-private-modal">🔒 Privé</span>
              )}
            </div>

            <div className="info-grid">
              <div className="info-item">
                <span className="info-icon">👥</span>
                <div className="info-content">
                  <span className="info-label">Joueurs</span>
                  <span className="info-value">
                    {tournament.current_players + 1}/{tournament.max_players}
                  </span>
                </div>
              </div>

              <div className="info-item">
                <span className="info-icon">📅</span>
                <div className="info-content">
                  <span className="info-label">Début</span>
                  <span className="info-value">{formatDate(tournament.start_date)}</span>
                </div>
              </div>

              {daysUntilStart() > 0 && (
                <div className="info-item highlight">
                  <span className="info-icon">⏳</span>
                  <div className="info-content">
                    <span className="info-label">Début dans</span>
                    <span className="info-value">
                      {daysUntilStart()} jour{daysUntilStart() > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Next Steps */}
          <div className="next-steps">
            <p className="next-steps-title">📋 Prochaines étapes :</p>
            <ul className="next-steps-list">
              <li>Préparez votre stratégie de paris</li>
              <li>Consultez les matchs disponibles avant le début</li>
              <li>Restez informé des notifications du tournoi</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              className="btn-primary-modal"
              onClick={handleClose}
            >
              <span className="btn-icon">🏆</span>
              C'est parti !
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          className="modal-close-btn"
          onClick={handleClose}
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
});

TournamentJoinSuccessModal.displayName = 'TournamentJoinSuccessModal';

export default TournamentJoinSuccessModal;
