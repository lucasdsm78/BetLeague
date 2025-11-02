import React, { memo, useCallback, useState } from 'react';
import { deleteTicket } from 'services/ticketsApi';
import './CreateTicketModal.css';

interface DeleteTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: number | null;
  ticketNumber: number | null;
  onSuccess: () => void;
}

const DeleteTicketModal: React.FC<DeleteTicketModalProps> = memo(({
  isOpen,
  onClose,
  ticketId,
  ticketNumber,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    if (!ticketId) return;

    try {
      setLoading(true);
      setError(null);
      await deleteTicket(ticketId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la suppression du ticket');
      console.error('Delete ticket error:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId, onSuccess, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  }, [onClose, loading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !loading) {
      onClose();
    }
  }, [onClose, loading]);

  if (!isOpen || !ticketId) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div className="modal-card delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="delete-modal-title">Supprimer le ticket</h3>
          <button
            className="icon-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="delete-warning">
            <span className="warning-icon" aria-hidden="true">⚠️</span>
            <div className="warning-content">
              <p className="warning-title">Attention</p>
              <p className="warning-message">
                Êtes-vous sûr de vouloir supprimer le ticket <strong>#{ticketNumber}</strong> ?
              </p>
              <p className="warning-note">
                Cette action est <strong>irréversible</strong>. Votre mise sera restituée.
              </p>
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-outline"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Annuler
          </button>
          <button
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={loading}
            type="button"
          >
            {loading ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
});

DeleteTicketModal.displayName = 'DeleteTicketModal';

export default DeleteTicketModal;
