import React, { useState, useCallback, useEffect, memo, useMemo } from 'react';
import { inviteUserToLeague } from '../../services/api/leagues';
import { deleteLeagueInvitation } from '../../services/api/invitations';
import { useInvalidateInvitations, useLeagueSentInvitationsQuery } from '../../hooks/queries/useInvitationsQueries';
import type { UserSearchResult } from 'types/entities/userSearch';
import UserSearchInput from './UserSearchInput';
import './InviteUserModal.css';

interface InviteUserModalProps {
  isOpen: boolean;
  leagueId: number | null;
  leagueName?: string;
  onClose: () => void;
  onInviteSent?: (user: UserSearchResult) => void;
  excludeUserIds?: number[];
}

const InviteUserModal: React.FC<InviteUserModalProps> = memo(({
  isOpen,
  leagueId,
  leagueName,
  onClose,
  onInviteSent,
  excludeUserIds = []
}) => {
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [deletingInvitationId, setDeletingInvitationId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const invalidateInvitations = useInvalidateInvitations();
  const sentInvitationsQuery = useLeagueSentInvitationsQuery(isOpen ? leagueId : null, {
    enabled: isOpen && leagueId !== null,
  });
  const sentInvitations = sentInvitationsQuery.data?.invitations ?? [];
  const mergedExcludeUserIds = useMemo(
    () => Array.from(new Set([...excludeUserIds, ...sentInvitations.map((invitation) => invitation.user.id)])),
    [excludeUserIds, sentInvitations],
  );

  const formatInvitationDate = useCallback((timestamp: number) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedUser(null);
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px';
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Handle user selection from search
  const handleUserSelect = useCallback((user: UserSearchResult) => {
    setSelectedUser(user);
    setError('');
    setSuccessMessage('');
  }, []);

  // Handle send invitation
  const handleSendInvitation = useCallback(async () => {
    if (!selectedUser || !leagueId || isInviting) return;

    setIsInviting(true);
    setError('');
    setSuccessMessage('');

    try {

      const data = await inviteUserToLeague(leagueId, selectedUser.id);
      const successMsg = data.message || `🎉 Invitation envoyée à ${selectedUser.pseudo} !`;
      setSuccessMessage(successMsg);

      if (onInviteSent) {
        onInviteSent(selectedUser);
      }

      await invalidateInvitations.invalidateLeagueSent(leagueId);
      await sentInvitationsQuery.refetch();
      setSelectedUser(null);

    } catch (err: any) {
      let errorMessage = `Erreur réseau lors de l'envoi de l'invitation à ${selectedUser.pseudo}. Veuillez réessayer.`;

      // Try to extract more specific error message
      if (err?.message && typeof err.message === 'string') {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
      console.error('❌ Exception while sending invitation:', err);
    } finally {
      setIsInviting(false);
    }
  }, [selectedUser, leagueId, isInviting, onInviteSent, invalidateInvitations, sentInvitationsQuery]);

  // Handle delete invitation
  const handleDeleteInvitation = useCallback(async (invitationId: number) => {
    if (deletingInvitationId !== null || !leagueId) return;

    setDeletingInvitationId(invitationId);
    setError('');
    setSuccessMessage('');

    try {
      const data = await deleteLeagueInvitation(invitationId);
      setSuccessMessage(data.message || 'Invitation retirée.');
      await invalidateInvitations.invalidateLeagueSent(leagueId);
      await sentInvitationsQuery.refetch();
    } catch (err: any) {
      setError(err?.message || "Impossible de retirer l'invitation.");
    } finally {
      setDeletingInvitationId(null);
    }
  }, [deletingInvitationId, invalidateInvitations, leagueId, sentInvitationsQuery]);

  // Clear selected user
  const handleClearSelection = useCallback(() => {
    setSelectedUser(null);
    setError('');
    setSuccessMessage('');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="invite-modal-header">
          <div className="invite-title-section">
            <h2 className="invite-title">Inviter un utilisateur</h2>
            {leagueName && (
              <p className="invite-subtitle">
                Ligue : <span className="league-name-highlight">{leagueName}</span>
              </p>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="invite-modal-body">
          {/* Success Message */}
          {successMessage && (
            <div className="invite-success" role="alert">
              <span className="success-icon">✅</span>
              <div className="success-content">
                <div className="success-title">Invitation envoyée !</div>
                <div className="success-message">{successMessage}</div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="invite-error" role="alert">
              <span className="error-icon">⚠️</span>
              <div className="error-content">
                <div className="error-title">Erreur</div>
                <div className="error-message">{error}</div>
              </div>
            </div>
          )}

          {/* Search Section */}
          <div className="search-section">
            <label htmlFor="user-search" className="search-label">
              Rechercher un utilisateur
            </label>
            <UserSearchInput
              onUserSelect={handleUserSelect}
              placeholder="Tapez le nom ou l'email de l'utilisateur..."
              disabled={isInviting}
              excludeUserIds={mergedExcludeUserIds}
            />
            <p className="search-hint">
              Minimum 2 caractères requis. Recherchez par nom d'utilisateur ou email.
            </p>
          </div>

          <div className="league-sent-invitations-section">
            <div className="league-sent-invitations-header">
              <h3>Invitations envoyées</h3>
              <p>Retirez une invitation si vous ne souhaitez plus réserver une place.</p>
            </div>

            {sentInvitationsQuery.isLoading ? (
              <div className="league-sent-invitations-empty">Chargement des invitations…</div>
            ) : sentInvitations.length === 0 ? (
              <div className="league-sent-invitations-empty">Aucune invitation envoyée pour le moment.</div>
            ) : (
              <div className="league-sent-invitations-list">
                {sentInvitations.map((invitation) => (
                  <div key={invitation.id} className="league-sent-invitation-item">
                    <div className="league-sent-invitation-user">
                      <div className="league-sent-invitation-avatar">👤</div>
                      <div className="league-sent-invitation-content">
                        <div className="league-sent-invitation-pseudo">{invitation.user.pseudo}</div>
                        <div className="league-sent-invitation-email">{invitation.user.email}</div>
                      </div>
                    </div>
                    <div className="league-sent-invitation-meta">
                      <span className="league-sent-invitation-status">{String(invitation.status || '').toLowerCase() === 'pending' ? 'En attente' : invitation.status}</span>
                      <span className="league-sent-invitation-date">{formatInvitationDate(invitation.created_at)}</span>
                    </div>
                    <button
                      type="button"
                      className="league-sent-invitation-delete"
                      onClick={() => handleDeleteInvitation(invitation.id)}
                      disabled={deletingInvitationId === invitation.id}
                    >
                      {deletingInvitationId === invitation.id ? 'Retrait…' : 'Retirer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected User Preview */}
          {selectedUser && (
            <div className="selected-user-preview">
              <div className="preview-header">
                <h3>Utilisateur sélectionné</h3>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="clear-selection-btn"
                  aria-label="Désélectionner cet utilisateur"
                >
                  ✕
                </button>
              </div>
              <div className="selected-user-card">
                <div className="user-avatar-large">
                  <span className="avatar-icon">👤</span>
                </div>
                <div className="user-details">
                  <div className="user-pseudo-large">{selectedUser.pseudo}</div>
                  <div className="user-email-large">{selectedUser.email}</div>
                </div>
                <div className="invitation-icon">
                  <span className="invite-icon">✉️</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="invite-modal-actions">
          <button
            className="btn btn-outline"
            onClick={onClose}
            disabled={isInviting || deletingInvitationId !== null}
          >
            Fermer
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSendInvitation}
            disabled={!selectedUser || isInviting}
          >
            {isInviting ? (
              <>
                <span className="loading-spinner"></span>
                Envoi en cours...
              </>
            ) : (
              <>
                <span className="invite-btn-icon">✉️</span>
                Envoyer l'invitation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

InviteUserModal.displayName = 'InviteUserModal';

export default InviteUserModal;

