/**
 * LeaveLeagueModal - Secure confirmation modal for leaving a league
 * Mobile-first, TypeScript, optimized for performance and UX
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import { leaveLeague } from '../../services/api/leagues';
import userProfileService from '../../services/userProfileService';
import './LeaveLeagueModal.css';

interface LeaveLeagueModalProps {
  isOpen: boolean;
  leagueId: number | null;
  leagueName?: string;
  onClose: () => void;
  onLeaveSuccess?: () => void;
}

const LeaveLeagueModal: React.FC<LeaveLeagueModalProps> = memo(({
  isOpen,
  leagueId,
  leagueName,
  onClose,
  onLeaveSuccess
}) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string>('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsLeaving(false);
    }
  }, [isOpen]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isLeaving) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, isLeaving, onClose]);

  // Handle leave league
  const handleLeaveLeague = useCallback(async () => {
    if (!leagueId || isLeaving) return;

    setIsLeaving(true);
    setError('');

    try {
      const data = await leaveLeague(leagueId);

      // si pas throw => succès
      // Rafraîchir le profil utilisateur pour récupérer le solde BTL mis à jour
      const profileResult = await userProfileService.fetchCurrentUserProfile();

      if (profileResult.success && profileResult.data) {
        console.log('✅ User profile refreshed. New BTL balance:', (profileResult.data as any).nb_btl);
      } else {
        console.warn('⚠️ Failed to refresh user profile, but league exit was successful');
      }

      if (onLeaveSuccess) {
        onLeaveSuccess();
      }

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      const errorMessage = err?.message || 'Erreur lors de la désinscription';
      setError(errorMessage);
      console.error('❌ Exception while leaving league:', err);
    } finally {
      setIsLeaving(false);
    }
  }, [leagueId, isLeaving, onLeaveSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="leave-modal-overlay" onClick={() => { if (!isLeaving) onClose(); }}>
      <div className="leave-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="leave-modal-header">
          <div className="leave-title-section">
            <span className="warning-icon">⚠️</span>
            <h2 className="leave-title">Quitter la ligue</h2>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isLeaving}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="leave-modal-body">
          {/* Confirmation Message */}
          <p className="confirmation-message">
            Êtes-vous sûr de vouloir quitter la ligue <strong>{leagueName || 'cette ligue'}</strong> ?
          </p>

          <p className="leave-hint">
            Si la ligue est payante et n'a pas encore commencé, vos BTL seront automatiquement recrédités sur votre compte.
          </p>

          {/* Error Message */}
          {error && (
            <div className="leave-error" role="alert">
              <span className="error-icon">⚠️</span>
              <div className="error-content">
                <div className="error-message">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="leave-modal-actions">
          <button
            className="btn btn-outline"
            onClick={onClose}
            disabled={isLeaving}
          >
            Annuler
          </button>
          <button
            className="btn btn-danger"
            onClick={handleLeaveLeague}
            disabled={isLeaving}
          >
            {isLeaving ? (
              <>
                <span className="loading-spinner"></span>
                Désinscription...
              </>
            ) : (
              <>
                <span className="leave-btn-icon">🚪</span>
                Quitter la ligue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

LeaveLeagueModal.displayName = 'LeaveLeagueModal';

export default LeaveLeagueModal;
