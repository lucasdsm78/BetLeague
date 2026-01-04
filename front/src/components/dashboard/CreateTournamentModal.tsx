/**
 * CreateTournamentModal - Modal for creating tournaments
 * Premium design with validation and security
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createTournament, TournamentCreateRequest } from '../../services/tournamentApi';
import { useToast } from '../../hooks/useToast';
import './CreateTournamentModal.css';

interface CreateTournamentModalProps {
  onClose: () => void;
  onTournamentCreated: () => void;
}

const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({ onClose, onTournamentCreated }) => {
  const [formData, setFormData] = useState<TournamentCreateRequest>({
    name: '',
    is_private: false,
    max_players: 16
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TournamentCreateRequest, string>>>({});
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
    const newErrors: Partial<Record<keyof TournamentCreateRequest, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Le nom doit contenir au moins 3 caractères';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'Le nom ne peut pas dépasser 50 caractères';
    } else if (!/^[a-zA-Z0-9\s\-_éèêàâôûùçÉÈÊÀÂÔÛÙÇ]+$/.test(formData.name.trim())) {
      newErrors.name = 'Le nom contient des caractères invalides';
    }

    if (formData.max_players !== 16) {
      newErrors.max_players = 'Le nombre de joueurs doit être 16';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = useCallback((field: keyof TournamentCreateRequest, value: string | boolean | number) => {
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
      await createTournament({
        name: formData.name.trim(),
        is_private: formData.is_private,
        max_players: 16
      });

      showSuccess(
        'Tournoi créé !',
        `Le tournoi "${formData.name.trim()}" a été créé avec succès`
      );

      onTournamentCreated();
      onClose();
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        'Une erreur est survenue lors de la création du tournoi';

      showError('Erreur de création', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, showSuccess, showError, onTournamentCreated, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting && canCloseRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <div className="modal-overlay create-tournament-modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content create-tournament-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-icon">🏆</div>
          <h2 className="modal-title">Créer un tournoi</h2>
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
              Créez votre tournoi et affrontez jusqu'à 16 joueurs dans une compétition à élimination directe !
            </p>

            {/* Tournament Name */}
            <div className="form-group">
              <label htmlFor="tournament-name" className="form-label">
                <span className="label-icon">📝</span>
                Nom du tournoi
                <span className="label-required">*</span>
              </label>
              <input
                id="tournament-name"
                type="text"
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Ex: Ligue des Champions 2024"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={isSubmitting}
                maxLength={50}
                autoFocus
              />
              {errors.name && (
                <span className="form-error">{errors.name}</span>
              )}
              <span className="form-hint">
                {formData.name.length}/50 caractères
              </span>
            </div>

            {/* Max Players - Fixed at 16 */}
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">👥</span>
                Nombre de joueurs
              </label>
              <div className="player-count-fixed">
                <div className="player-count-display">
                  <span className="count-number">16</span>
                  <span className="count-label">joueurs maximum</span>
                </div>
                <span className="count-description">Format tournoi à élimination directe</span>
              </div>
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

            {/* Tournament Info */}
            <div className="tournament-info-box">
              <div className="info-item">
                <span className="info-icon">⏱️</span>
                <span className="info-text">Durée : 7 jours</span>
              </div>
              <div className="info-item">
                <span className="info-icon">🎯</span>
                <span className="info-text">Format : Élimination directe</span>
              </div>
              <div className="info-item">
                <span className="info-icon">🏅</span>
                <span className="info-text">Récompenses : BTL + badges</span>
              </div>
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
              className="btn btn-primary btn-create-tournament"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-small" />
                  Création...
                </>
              ) : (
                <>
                  <span className="btn-icon">🏆</span>
                  Créer le tournoi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

CreateTournamentModal.displayName = 'CreateTournamentModal';

export default CreateTournamentModal;
