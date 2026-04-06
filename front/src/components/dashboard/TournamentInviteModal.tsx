import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  useDeleteTournamentInvitationMutation,
  useInviteUserToTournamentMutation,
  useTournamentInvitationsQuery,
} from '../../hooks/queries/useTournamentQueries';
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

function getInvitationStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'accepted':
      return 'Acceptée';
    case 'refused':
      return 'Refusée';
    default:
      return 'En attente';
  }
}

function formatInvitationDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isPendingInvitation(status: string): boolean {
  return status.trim().toLowerCase() === 'pending';
}

const TournamentInviteModal: React.FC<TournamentInviteModalProps> = memo(({
  isOpen,
  tournamentId,
  tournamentName,
  onClose,
}) => {
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [deletingInvitationId, setDeletingInvitationId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const authUser = useAuthStore((state) => state.user);
  const invitationsQuery = useTournamentInvitationsQuery(isOpen ? tournamentId : null, {
    enabled: isOpen && tournamentId !== null,
  });
  const inviteMutation = useInviteUserToTournamentMutation(tournamentId);
  const deleteMutation = useDeleteTournamentInvitationMutation(tournamentId);
  const isInviting = inviteMutation.isPending;

  const invitations = invitationsQuery.data?.invitations ?? [];
  const currentUserId = authUser?.id ? Number(authUser.id) : null;

  const excludeUserIds = useMemo(() => {
    const ids = invitations.map((invitation) => invitation.user.id);
    if (typeof currentUserId === 'number' && currentUserId > 0) {
      ids.push(currentUserId);
    }
    return Array.from(new Set(ids));
  }, [currentUserId, invitations]);

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
      if (event.key === 'Escape' && !isInviting && deletingInvitationId === null) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [deletingInvitationId, isInviting, isOpen, onClose]);

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
      setSelectedUser(null);
      await invitationsQuery.refetch();
    } catch (inviteError) {
      setFeedback({
        tone: 'error',
        title: 'Erreur',
        message: inviteError instanceof Error ? inviteError.message : "Impossible d'envoyer l'invitation.",
      });
    }
  }, [inviteMutation, invitationsQuery, isInviting, selectedUser, tournamentId]);

  const handleDeleteInvitation = useCallback(async (invitationId: number) => {
    if (deletingInvitationId !== null || !tournamentId) return;

    const invitation = invitations.find((item) => item.id === invitationId);
    if (invitation && !isPendingInvitation(invitation.status)) {
      setFeedback({
        tone: 'error',
        title: 'Retrait indisponible',
        message: "Seules les invitations en attente peuvent être retirées.",
      });
      return;
    }

    setDeletingInvitationId(invitationId);
    setFeedback(null);

    try {
      const response = await deleteMutation.mutateAsync({ invitationId });
      setFeedback({
        tone: 'success',
        title: 'Invitation retirée',
        message: response.message || 'Invitation retirée.',
      });
      await invitationsQuery.refetch();
    } catch (deleteError) {
      setFeedback({
        tone: 'error',
        title: 'Erreur',
        message: deleteError instanceof Error ? deleteError.message : "Impossible de retirer l'invitation.",
      });
    } finally {
      setDeletingInvitationId(null);
    }
  }, [deleteMutation, deletingInvitationId, invitations, invitationsQuery, tournamentId]);

  const handleClearSelection = useCallback(() => {
    setSelectedUser(null);
    setFeedback(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="tournament-invite-modal-overlay" onClick={() => { if (!isInviting && deletingInvitationId === null) onClose(); }}>
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
            disabled={isInviting || deletingInvitationId !== null}
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

          <section className="tournament-invite-panel">
            <div className="tournament-invite-panel-header">
              <h3>Invitations envoyées</h3>
              <p>Suivez les joueurs déjà contactés pour ce tournoi.</p>
            </div>

            {invitationsQuery.isLoading ? (
              <div className="tournament-invitations-loading">
                <div className="tournament-invitations-spinner" />
                <span>Chargement des invitations…</span>
              </div>
            ) : invitationsQuery.isError ? (
              <div className="tournament-invitations-empty tournament-invitations-error-state">
                <span className="empty-icon">⚠️</span>
                <div>
                  <p>Impossible de charger les invitations envoyées.</p>
                  <button type="button" className="tournament-invitations-retry" onClick={() => invitationsQuery.refetch()}>
                    Réessayer
                  </button>
                </div>
              </div>
            ) : invitations.length === 0 ? (
              <div className="tournament-invitations-empty">
                <span className="empty-icon">📨</span>
                <p>Aucune invitation envoyée pour le moment.</p>
              </div>
            ) : (
              <div className="tournament-invitations-list">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="tournament-invitation-item">
                    <div className="tournament-invitation-user">
                      <div className="tournament-invitation-avatar">👤</div>
                      <div>
                        <div className="tournament-invitation-pseudo">{invitation.user.pseudo}</div>
                        <div className="tournament-invitation-email">{invitation.user.email}</div>
                      </div>
                    </div>

                    <div className="tournament-invitation-meta">
                      <span className={`tournament-invitation-status status-${invitation.status.toLowerCase()}`}>
                        {getInvitationStatusLabel(invitation.status)}
                      </span>
                      <span className="tournament-invitation-date">{formatInvitationDate(invitation.created_at)}</span>
                    </div>

                    <button
                      type="button"
                      className="tournament-invitation-delete"
                      onClick={() => handleDeleteInvitation(invitation.id)}
                      disabled={deletingInvitationId === invitation.id || !isPendingInvitation(invitation.status)}
                      aria-disabled={!isPendingInvitation(invitation.status)}
                    >
                      {deletingInvitationId === invitation.id ? 'Retrait…' : 'Retirer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="tournament-invite-footer">
          <button
            type="button"
            className="tournament-invite-btn secondary"
            onClick={onClose}
            disabled={isInviting || deletingInvitationId !== null}
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

