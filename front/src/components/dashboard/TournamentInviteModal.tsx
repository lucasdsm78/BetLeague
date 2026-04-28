import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  useInviteUserToTournamentMutation,
} from '../../hooks/queries/useTournamentQueries';
import { useInvalidateInvitations } from '../../hooks/queries/useInvitationsQueries';
import { useAuthStore } from '../../store/authStore';
import type { UserSearchResult } from 'types/entities/userSearch';
import UserSearchInput from '../league/UserSearchInput';
import './TournamentInviteModal.css';

interface TournamentInviteModalProps {
  isOpen: boolean;
  tournamentId: number | null;
  tournamentName?: string;
  onClose: () => void;
}

type FeedbackState = {
  tone: 'success' | 'error';
  title: string;
  message: string;
} | null;

const TournamentInviteModal: React.FC<TournamentInviteModalProps> = memo(({
  isOpen,
  tournamentId,
  tournamentName,
  onClose,
}) => {
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const authUser = useAuthStore((state) => state.user);
  const inviteMutation = useInviteUserToTournamentMutation(tournamentId);
  const invalidateInvitations = useInvalidateInvitations();
  const isInviting = inviteMutation.isPending;

  const currentUserId = authUser?.id ? Number(authUser.id) : null;

  const excludeUserIds = useMemo(() => {
    const ids: number[] = [];
    if (typeof currentUserId === 'number' && currentUserId > 0) {
      ids.push(currentUserId);
    }
    return Array.from(new Set(ids));
  }, [currentUserId]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedUser(null);
    setFeedback(null);
  }, [isOpen, tournamentId]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isInviting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isInviting, isOpen, onClose]);

  const handleUserSelect = useCallback((user: UserSearchResult) => {
    setSelectedUser(user);
    setFeedback(null);
  }, []);

  const handleInvite = useCallback(async () => {
    if (!selectedUser || !tournamentId || isInviting) return;

    setFeedback(null);

    try {
      const response = await inviteMutation.mutateAsync({ userId: selectedUser.id });
      setFeedback({
        tone: 'success',
        title: 'Invitation envoyée',
        message: response.message || `Invitation envoyée à ${selectedUser.pseudo}.`,
      });
      invalidateInvitations.invalidateAll();
      setSelectedUser(null);
    } catch (inviteError) {
      setFeedback({
        tone: 'error',
        title: 'Erreur',
        message: inviteError instanceof Error ? inviteError.message : "Impossible d'envoyer l'invitation.",
      });
    }
  }, [invalidateInvitations, inviteMutation, isInviting, selectedUser, tournamentId]);

  const handleClearSelection = useCallback(() => {
    setSelectedUser(null);
    setFeedback(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="tournament-invite-modal-overlay" onClick={() => { if (!isInviting) onClose(); }}>
      <div
        className="tournament-invite-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tournament-invite-title"
      >
        <div className="tournament-invite-header">
          <div>
            <p className="tournament-invite-eyebrow">Invitation tournoi</p>
            <h2 id="tournament-invite-title">Inviter un joueur</h2>
            <p className="tournament-invite-subtitle">
              {tournamentName ? `Tournoi : ${tournamentName}` : 'Sélectionnez un joueur à inviter sur ce tournoi.'}
            </p>
          </div>
          <button
            type="button"
            className="tournament-invite-close"
            onClick={onClose}
            aria-label="Fermer"
            disabled={isInviting}
          >
            ✕
          </button>
        </div>

        <div className="tournament-invite-body">
          {feedback && (
            <div className={`tournament-invite-feedback ${feedback.tone}`} role={feedback.tone === 'success' ? 'status' : 'alert'}>
              <strong>{feedback.title}</strong>
              <span>{feedback.message}</span>
            </div>
          )}

          <section className="tournament-invite-panel">
            <div className="tournament-invite-panel-header">
              <h3>Rechercher un utilisateur</h3>
              <p>Invitez rapidement un joueur par pseudo ou par email.</p>
            </div>

            <UserSearchInput
              onUserSelect={handleUserSelect}
              placeholder="Rechercher un joueur à inviter..."
              disabled={isInviting}
              excludeUserIds={excludeUserIds}
            />

            {selectedUser && (
              <div className="tournament-selected-user-card">
                <div className="tournament-selected-user-main">
                  <div className="tournament-selected-user-avatar">👤</div>
                  <div>
                    <div className="tournament-selected-user-pseudo">{selectedUser.pseudo}</div>
                    <div className="tournament-selected-user-email">{selectedUser.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="tournament-selected-user-clear"
                  onClick={handleClearSelection}
                >
                  Retirer
                </button>
              </div>
            )}
          </section>

        </div>

        <div className="tournament-invite-footer">
          <button
            type="button"
            className="tournament-invite-btn secondary"
            onClick={onClose}
              disabled={isInviting}
          >
            Fermer
          </button>
          <button
            type="button"
            className="tournament-invite-btn primary"
            onClick={handleInvite}
            disabled={!selectedUser || isInviting}
          >
            {isInviting ? 'Invitation…' : 'Envoyer l’invitation'}
          </button>
        </div>
      </div>
    </div>
  );
});

TournamentInviteModal.displayName = 'TournamentInviteModal';

export default TournamentInviteModal;

