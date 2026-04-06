/**
 * LeaveTournamentModal - Confirmation modal for leaving a tournament
 * Pure UI component: mutation is handled by the parent
 */

import React, { useEffect, useCallback, memo, useId, useRef } from 'react';
import type { MyTournament } from '../../types/api/tournament';
import './LeaveTournamentModal.css';

interface LeaveTournamentModalProps {
  tournament: MyTournament | null;
  isLeaving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

const LeaveTournamentModal: React.FC<LeaveTournamentModalProps> = memo(({
  tournament,
  isLeaving,
  error,
  onClose,
  onConfirm,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (tournament) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [tournament]);

  useEffect(() => {
    if (!tournament) return;

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rafId = window.requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      previousActiveElementRef.current?.focus?.();
    };
  }, [tournament]);

  // Handle ESC key
  useEffect(() => {
    if (!tournament) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLeaving) onClose();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [tournament, isLeaving, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLeaving) onClose();
  }, [isLeaving, onClose]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!tournament) return null;

  return (
    <div className="leave-tournament-overlay" onClick={handleOverlayClick}>
      <div
        className="leave-tournament-content"
        onClick={handleContentClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {/* Header */}
        <div className="leave-tournament-header">
          <div className="leave-tournament-title-section">
            <span className="leave-tournament-warning-icon">⚠️</span>
            <h2 className="leave-tournament-title" id={titleId}>Quitter le tournoi</h2>
          </div>
          <button
            className="leave-tournament-close-btn"
            onClick={onClose}
            disabled={isLeaving}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="leave-tournament-body">
          <p className="leave-tournament-message" id={descriptionId}>
            Êtes-vous sûr de vouloir quitter le tournoi{' '}
            <strong>{tournament.name}</strong> ?
          </p>

          <p className="leave-tournament-hint">
            Votre place sera libérée et un autre joueur pourra rejoindre le tournoi.
          </p>

          {error && (
            <div className="leave-tournament-error" role="alert">
              <span className="leave-tournament-error-icon">⚠️</span>
              <div className="leave-tournament-error-message">{error}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="leave-tournament-actions">
          <button
            className="leave-tournament-btn leave-tournament-btn-cancel"
            onClick={onClose}
            disabled={isLeaving}
            ref={cancelButtonRef}
          >
            Annuler
          </button>
          <button
            className="leave-tournament-btn leave-tournament-btn-danger"
            onClick={onConfirm}
            disabled={isLeaving}
          >
            {isLeaving ? (
              <>
                <span className="leave-tournament-spinner" />
                Désinscription...
              </>
            ) : (
              <>
                <span className="leave-tournament-btn-icon">🚪</span>
                Quitter le tournoi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

LeaveTournamentModal.displayName = 'LeaveTournamentModal';

export default LeaveTournamentModal;
