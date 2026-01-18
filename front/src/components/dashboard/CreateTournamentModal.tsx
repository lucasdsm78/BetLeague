/**
 * CreateTournamentModal - Modal for creating tournaments
 * Premium design with validation and security
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createTournament, TournamentCreateRequest } from '../../services/tournamentApi';
import { useGlobalToast } from '../../toast/ToastProvider';
import './CreateTournamentModal.css';

interface CreateTournamentModalProps {
  onClose: () => void;
  onTournamentCreated: () => void;
  onSwitchToMyTournaments?: () => void;
}

type CreateTournamentFormErrors = Partial<{
  name: string;
  max_players: string;
  start_date: string;
  end_date: string;
}>;

const TOURNAMENT_DURATION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad2 = (n: number) => String(n).padStart(2, '0');

const toDatetimeLocalValue = (epochMs?: number): string => {
  if (!epochMs || !Number.isFinite(epochMs)) return '';
  const d = new Date(epochMs);
  // datetime-local attend une date "locale" sans timezone
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const datetimeLocalToEpochMs = (value: string): number | undefined => {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : undefined;
};

const addDaysMs = (epochMs: number, days: number): number => epochMs + days * DAY_MS;

const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({ onClose, onTournamentCreated, onSwitchToMyTournaments }) => {
  const [formData, setFormData] = useState<TournamentCreateRequest>({
    name: '',
    is_private: false,
    max_players: 16,
    start_date: undefined,
  });

  const [startDateLocal, setStartDateLocal] = useState<string>('');
  const [endDateLocal, setEndDateLocal] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<CreateTournamentFormErrors>({});
  const { showSuccess, showError } = useGlobalToast();
  const canCloseRef = useRef(false);
  const didInitDatesRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      canCloseRef.current = true;
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const resetDatesToToday = useCallback(() => {
    const now = Date.now();
    const startLocal = toDatetimeLocalValue(now);
    const endMs = addDaysMs(now, TOURNAMENT_DURATION_DAYS);

    setStartDateLocal(startLocal);
    setEndDateLocal(toDatetimeLocalValue(endMs));
    setFormData(prev => ({
      ...prev,
      start_date: now,
    }));
    setErrors(prev => ({ ...prev, start_date: undefined, end_date: undefined }));
  }, []);

  // Initialise par défaut: début = aujourd'hui, fin = +7 jours (affichage)
  useEffect(() => {
    if (didInitDatesRef.current) return;
    didInitDatesRef.current = true;
    resetDatesToToday();
  }, [resetDatesToToday]);

  const validateForm = useCallback((): boolean => {
    const newErrors: CreateTournamentFormErrors = {};

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

    // Dates: fin auto-calculée (+7 jours). On valide seulement le début.
    const startMs = datetimeLocalToEpochMs(startDateLocal);
    if (startDateLocal && startMs === undefined) {
      newErrors.start_date = 'Date de début invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, startDateLocal]);

  const handleInputChange = useCallback((field: keyof TournamentCreateRequest, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  const handleStartDateChange = useCallback((value: string) => {
    setStartDateLocal(value);

    const startMs = datetimeLocalToEpochMs(value);
    if (startMs === undefined) {
      setFormData(prev => ({ ...prev, start_date: undefined }));
      setEndDateLocal('');
      setErrors(prev => ({ ...prev, start_date: 'Date de début invalide' }));
      return;
    }

    // Affichage UX: fin = début + 7 jours (source de vérité = backend)
    const endMs = addDaysMs(startMs, TOURNAMENT_DURATION_DAYS);
    setEndDateLocal(toDatetimeLocalValue(endMs));

    setFormData(prev => ({ ...prev, start_date: startMs }));
    setErrors(prev => ({ ...prev, start_date: undefined }));
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
        max_players: 16,
        ...(typeof formData.start_date === 'number' ? { start_date: formData.start_date } : {}),
      });

      showSuccess(
        'Tournoi créé !',
        `Tu es automatiquement inscrit au tournoi "${formData.name.trim()}".`
      );

      onTournamentCreated();
      onSwitchToMyTournaments?.();
      onClose();
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        'Une erreur est survenue lors de la création du tournoi';

      showError('Erreur de création', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, showSuccess, showError, onTournamentCreated, onSwitchToMyTournaments, onClose]);

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
              Créez votre tournoi et affrontez 15 autres joueurs dans une compétition à élimination directe !
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

            {/* Dates */}
            <div className="form-group">
              <div className="form-label-row">
                <label htmlFor="tournament-start-date" className="form-label">
                  <span className="label-icon">🗓️</span>
                  Date de début
                </label>
                <button
                  type="button"
                  className="btn btn-tertiary btn-reset-today"
                  onClick={resetDatesToToday}
                  disabled={isSubmitting}
                >
                  <span className="label-desktop">Réinitialiser à aujourd’hui</span>
                  <span className="label-mobile">Aujourd’hui</span>
                </button>
              </div>
              <input
                id="tournament-start-date"
                type="datetime-local"
                className={`form-input ${errors.start_date ? 'error' : ''}`}
                value={startDateLocal}
                onChange={(e) => handleStartDateChange(e.target.value)}
                disabled={isSubmitting}
                inputMode="numeric"
              />
              {errors.start_date && (
                <span className="form-error">{errors.start_date}</span>
              )}
              <span className="form-hint">Durée fixe : {TOURNAMENT_DURATION_DAYS} jours (fin calculée automatiquement).</span>
            </div>

            <div className="form-group">
              <label htmlFor="tournament-end-date" className="form-label">
                <span className="label-icon">⏳</span>
                Date de fin
              </label>
              <input
                id="tournament-end-date"
                type="datetime-local"
                className={`form-input ${errors.end_date ? 'error' : ''}`}
                value={endDateLocal}
                disabled
                readOnly
              />
              {errors.end_date && (
                <span className="form-error">{errors.end_date}</span>
              )}
              <span className="form-hint">Calcul automatique : début + {TOURNAMENT_DURATION_DAYS} jours.</span>
            </div>

            {/* Tournament Info */}
            <div className="tournament-info-box">
              <div className="info-item">
                <span className="info-icon">⏱️</span>
                <span className="info-text">Durée : {TOURNAMENT_DURATION_DAYS} jours</span>
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
