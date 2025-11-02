import React, { useCallback, useEffect, useRef, useState } from 'react';
import './CreateTicketModal.css';

interface DeleteTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: number | null;
  onConfirm: (id: number) => Promise<void>;
}

const DeleteTicketModal: React.FC<DeleteTicketModalProps> = ({ isOpen, onClose, ticketId, onConfirm }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen && closeBtnRef.current) closeBtnRef.current.focus();
  }, [isOpen]);

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) onClose();
  }, [onClose, isSubmitting]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape' && !isSubmitting) onClose();
  }, [isOpen, onClose, isSubmitting]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const handleConfirm = useCallback(async () => {
    if (!ticketId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(ticketId);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la suppression');
    } finally {
      setIsSubmitting(false);
    }
  }, [ticketId, onConfirm]);

  if (!isOpen || ticketId == null) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-ticket-title" onClick={handleOverlayClick}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="delete-ticket-title">Supprimer le ticket</h3>
          <button ref={closeBtnRef} className="icon-btn" onClick={onClose} aria-label="Fermer" disabled={isSubmitting}>×</button>
        </div>

        <div className="inline-warning" role="alert">
          Cette action est définitive. Le ticket #{ticketId} sera supprimé.
        </div>

        {error && (
          <div className="error-banner" role="alert">{error}</div>
        )}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Annuler</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteTicketModal;

