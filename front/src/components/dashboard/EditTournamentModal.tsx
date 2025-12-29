/**
 * EditTournamentModal - Modal for editing tournaments
 * Handles all backend error cases with proper validation
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { updateTournament, TournamentUpdateRequest, Tournament } from '../../services/tournamentApi';
import { useToast } from '../../hooks/useToast';
import './EditTournamentModal.css';

interface EditTournamentModalProps {
  tournament: Tournament;
  onClose: () => void;
  onTournamentUpdated: () => void;
}

const EditTournamentModal: React.FC<EditTournamentModalProps> = ({
  tournament,
  onClose,
  onTournamentUpdated
}) => {
  const [formData, setFormData] = useState<TournamentUpdateRequest>({
    name: tournament.name,
    is_private: tournament.is_private,
    start_date: tournament.start_date,
    end_date: tournament.end_date,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TournamentUpdateRequest, string>>>({});
  const { showSuccess, showError } = useToast();
  const canCloseRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      canCloseRef.current = true;
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof TournamentUpdateRequest, string>> = {};

    if (formData.name !== undefined) {
      if (!formData.name.trim()) {
        newErrors.name = 'Le nom est requis';
      } else if (formData.name.trim().length < 3) {
        newErrors.name = 'Le nom doit contenir au moins 3 caractères';
      } else if (formData.name.trim().length > 50) {
        newErrors.name = 'Le nom ne peut pas dépasser 50 caractères';
      } else if (!/^[a-zA-Z0-9\s\-_éèêàâôûùçÉÈÊÀÂÔÛÙÇ]+$/.test(formData.name.trim())) {
        newErrors.name = 'Le nom contient des caractères invalides';
      }
    }

    if (formData.start_date !== undefined && formData.end_date !== undefined) {
      if (formData.start_date >= formData.end_date) {
        newErrors.start_date = 'La date de début doit être antérieure à la date de fin';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = useCallback((field: keyof TournamentUpdateRequest, value: string | boolean | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showError('Formulaire invalide', 'Veuillez corriger les erreurs');
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: TournamentUpdateRequest = {};
      if (formData.name !== undefined && formData.name.trim() !== tournament.name) {
        updateData.name = formData.name.trim();
      }
      if (formData.is_private !== undefined && formData.is_private !== tournament.is_private) {
        updateData.is_private = formData.is_private;
      }
      if (formData.start_date !== undefined && formData.start_date !== tournament.start_date) {
        updateData.start_date = formData.start_date;
      }
      if (formData.end_date !== undefined && formData.end_date !== tournament.end_date) {
        updateData.end_date = formData.end_date;
      }

      if (Object.keys(updateData).length === 0) {
        showError('Aucune modification', 'Aucun changement détecté');
        setIsSubmitting(false);
        return;
      }

      await updateTournament(tournament.id, updateData);

      showSuccess(
        'Tournoi modifié !',
        `Le tournoi "${formData.name?.trim() || tournament.name}" a été modifié avec succès`
      );

      onTournamentUpdated();
      onClose();
    } catch (error: any) {

      const statusCode = error.status || error.response?.status;
      const errorDetail = typeof error.details === 'string'
        ? error.details
        : error.details?.detail || error.response?.data?.detail;

      if (statusCode === 404) {
        if (errorDetail?.includes('User') || errorDetail?.includes('utilisateur')) {
          showError('Utilisateur introuvable', 'Votre session a expiré. Veuillez vous reconnecter.');
        } else {
          showError('Tournoi introuvable', 'Le tournoi que vous tentez de modifier n\'existe plus.');
        }
      } else if (statusCode === 409) {
        showError('Nom déjà utilisé', 'Un tournoi avec ce nom existe déjà. Veuillez choisir un autre nom.');
        setErrors(prev => ({ ...prev, name: 'Ce nom est déjà utilisé' }));
      } else if (statusCode === 401) {
        if (errorDetail?.includes('owner') || errorDetail?.includes('propriétaire')) {
          showError('Non autorisé', 'Vous devez être le propriétaire du tournoi pour le modifier.');
        } else if (errorDetail?.includes('started') || errorDetail?.includes('commencé')) {
          showError('Tournoi commencé', 'Impossible de modifier un tournoi qui a déjà commencé.');
        } else {
          showError('Non autorisé', 'Vous n\'avez pas l\'autorisation de modifier ce tournoi.');
        }
      } else if (statusCode === 500) {
        showError('Erreur serveur', 'Une erreur interne est survenue. Veuillez réessayer plus tard.');
      } else {
        const errorMessage = errorDetail ||
                            error.message ||
                            'Une erreur est survenue lors de la modification du tournoi';
        showError('Erreur de modification', errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, tournament, validateForm, showSuccess, showError, onTournamentUpdated, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting && canCloseRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const formatDateForInput = (timestamp: number | undefined): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const parseDateFromInput = (value: string): number | undefined => {
    if (!value) return undefined;
    return new Date(value).getTime();
  };

  const modalContent = (
    <div className="modal-overlay edit-tournament-modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content edit-tournament-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon">✏️</div>
          <h2 className="modal-title">Modifier le tournoi</h2>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="tournament-form">
          <div className="form-section">
            <p className="form-description">
              Modifiez les informations de votre tournoi.
            </p>

            {/* Tournament Name */}
            <div className="form-group">
              <label htmlFor="tournament-name" className="form-label">
                <span className="label-icon">📝</span>
                Nom du tournoi
              </label>
              <input
                id="tournament-name"
                type="text"
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Ex: Ligue des Champions 2024"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={isSubmitting}
                maxLength={50}
                autoFocus
              />
              {errors.name && (
                <span className="form-error">{errors.name}</span>
              )}
              <span className="form-hint">
                {(formData.name || '').length}/50 caractères
              </span>
            </div>

            {/* Privacy Toggle */}
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔒</span>
                Confidentialité
              </label>
              <div className="privacy-toggle-container">
                <button
                  type="button"
                  className={`privacy-option ${!formData.is_private ? 'active' : ''}`}
                  onClick={() => handleInputChange('is_private', false)}
                  disabled={isSubmitting}
                >
                  <span className="privacy-icon">🌍</span>
                  <div className="privacy-content">
                    <span className="privacy-title">Public</span>
                    <span className="privacy-description">Tout le monde peut rejoindre</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`privacy-option ${formData.is_private ? 'active' : ''}`}
                  onClick={() => handleInputChange('is_private', true)}
                  disabled={isSubmitting}
                >
                  <span className="privacy-icon">🔐</span>
                  <div className="privacy-content">
                    <span className="privacy-title">Privé</span>
                    <span className="privacy-description">Sur invitation uniquement</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Start Date */}
            <div className="form-group">
              <label htmlFor="start-date" className="form-label">
                <span className="label-icon">📅</span>
                Date de début
              </label>
              <input
                id="start-date"
                type="datetime-local"
                className={`form-input ${errors.start_date ? 'error' : ''}`}
                value={formatDateForInput(formData.start_date)}
                onChange={(e) => handleInputChange('start_date', parseDateFromInput(e.target.value))}
                disabled={isSubmitting}
              />
              {errors.start_date && (
                <span className="form-error">{errors.start_date}</span>
              )}
            </div>

            {/* End Date */}
            <div className="form-group">
              <label htmlFor="end-date" className="form-label">
                <span className="label-icon">🏁</span>
                Date de fin
              </label>
              <input
                id="end-date"
                type="datetime-local"
                className={`form-input ${errors.end_date ? 'error' : ''}`}
                value={formatDateForInput(formData.end_date)}
                onChange={(e) => handleInputChange('end_date', parseDateFromInput(e.target.value))}
                disabled={isSubmitting}
              />
              {errors.end_date && (
                <span className="form-error">{errors.end_date}</span>
              )}
            </div>

          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-update-tournament"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-small" />
                  Modification...
                </>
              ) : (
                <>
                  <span className="btn-icon">✏️</span>
                  Modifier le tournoi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return modalContent;
};

EditTournamentModal.displayName = 'EditTournamentModal';

export default EditTournamentModal;
