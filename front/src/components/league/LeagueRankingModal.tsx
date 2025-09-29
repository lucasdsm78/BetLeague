/**
 * LeagueRankingModal - Modal pour afficher le classement d'une ligue
 * Composant React TypeScript moderne, sécurisé et responsive
 */

import React, { memo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import LeagueRanking from './LeagueRanking';
import './LeagueRankingModal.css';

interface LeagueRankingModalProps {
  isOpen: boolean;
  leagueId: number | null;
  leagueName?: string;
  onClose: () => void;
  onPlayerClick?: (pseudo: string, position: number) => void;
}

const LeagueRankingModal: React.FC<LeagueRankingModalProps> = ({
  isOpen,
  leagueId,
  leagueName,
  onClose,
  onPlayerClick
}) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleContentClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
      const modal = document.querySelector('.ranking-modal');
      if (modal) {
        (modal as HTMLElement).focus();
      }
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !leagueId) {
    return null;
  }

  const modalContent = (
    <div
      className="ranking-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ranking-modal-title"
      aria-describedby="ranking-modal-description"
    >
      <div
        className="ranking-modal"
        onClick={handleContentClick}
        tabIndex={-1}
      >
        <header className="ranking-modal__header">
          <h2 id="ranking-modal-title" className="ranking-modal__title">
            <span className="ranking-modal__title-icon" aria-hidden="true">🏆</span>
            {leagueName ? `Classement - ${leagueName}` : 'Classement de la Ligue'}
          </h2>
          <button
            className="ranking-modal__close"
            onClick={onClose}
            type="button"
            aria-label="Fermer la modal de classement"
            title="Fermer (Échap)"
          >
            ✕
          </button>
        </header>

        <div className="ranking-modal__content">
          <div id="ranking-modal-description" className="sr-only">
            Modal affichant le classement complet de la ligue avec les positions,
            statistiques et performances de tous les participants.
          </div>

          <LeagueRanking
            leagueId={leagueId}
            leagueName={leagueName}
            onPlayerClick={onPlayerClick}
            showStats={true}
            className="ranking-modal__ranking"
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default memo(LeagueRankingModal);

