/**
 * CreateTournamentModal - Modal for creating tournaments
 * Premium design with validation and security
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createTournament, TournamentCreationError } from '../../services/api/tournament';
import type { TournamentCreateRequest, TournamentCreateResponse, TournamentCreationAccess } from '../../types/api/tournament';
import { useGlobalToast } from '../../toast/ToastProvider';
import './CreateTournamentModal.css';

interface CreateTournamentModalProps {
  onClose: () => void;
  onTournamentCreated: (result?: TournamentCreateResponse) => void;
  onSwitchToMyTournaments?: () => void;
  creationAccess?: TournamentCreationAccess | null;
  onRequireSubscription?: () => void;
}

type CreateTournamentFormErrors = Partial<{
  name: string;
  max_players: string;
  start_date: string;
  end_date: string;
}>;

const TOURNAMENT_DURATION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const BRACKET_SIZES = [4, 8, 16] as const;

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

const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  onClose,
  onTournamentCreated,
  onSwitchToMyTournaments,
  creationAccess,
  onRequireSubscription,
}) => {
  const [formData, setFormData] = useState<TournamentCreateRequest>({
    name: '',
    is_private: false,
    max_players: 4,
    start_date: undefined,
  });

  const [startDateLocal, setStartDateLocal] = useState<string>('');
  const [endDateLocal, setEndDateLocal] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<CreateTournamentFormErrors>({});
  const { showSuccess, showError } = useGlobalToast();
  const canCloseRef = useRef(false);
  const didInitDatesRef = useRef(false);
  const isBlockedByQuota = Boolean(creationAccess && !creationAccess.can_create_tournament);
  const quotaVariant = creationAccess?.has_active_subscription ? 'is-subscriber' : isBlockedByQuota ? 'is-locked' : 'is-free';

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
    setFormData((prev: TournamentCreateRequest) => ({
      ...prev,
      start_date: now,
    }));
    setErrors((prev: CreateTournamentFormErrors) => ({ ...prev, start_date: undefined, end_date: undefined }));
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

    if (!BRACKET_SIZES.includes(formData.max_players as (typeof BRACKET_SIZES)[number])) {
      newErrors.max_players = 'Le format du bracket doit être 4, 8 ou 16 joueurs';
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
    setFormData((prev: TournamentCreateRequest) => ({ ...prev, [field]: value } as TournamentCreateRequest));
    setErrors((prev: CreateTournamentFormErrors) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleStartDateChange = useCallback((value: string) => {
    setStartDateLocal(value);

    const startMs = datetimeLocalToEpochMs(value);
    if (startMs === undefined) {
      setFormData((prev: TournamentCreateRequest) => ({ ...prev, start_date: undefined }));
      setEndDateLocal('');
      setErrors((prev: CreateTournamentFormErrors) => ({ ...prev, start_date: 'Date de début invalide' }));
      return;
    }

    // Affichage UX: fin = début + 7 jours (source de vérité = backend)
    const endMs = addDaysMs(startMs, TOURNAMENT_DURATION_DAYS);
    setEndDateLocal(toDatetimeLocalValue(endMs));

    setFormData((prev: TournamentCreateRequest) => ({ ...prev, start_date: startMs }));
    setErrors((prev: CreateTournamentFormErrors) => ({ ...prev, start_date: undefined }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBlockedByQuota) {
      onRequireSubscription?.();
      onClose();
      return;
    }

    if (!validateForm()) {
      showError('Formulaire invalide', 'Veuillez corriger les erreurs');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createTournament({
        name: formData.name.trim(),
        is_private: formData.is_private,
        max_players: formData.max_players,
        ...(typeof formData.start_date === 'number' ? { start_date: formData.start_date } : {}),
      });

      const remaining = response.monthly_free_tournaments_remaining;
      const successMessage = typeof remaining === 'number'
        ? remaining > 0
          ? `Tu es automatiquement inscrit au tournoi "${formData.name.trim()}". Il te reste ${remaining} tournoi gratuit ce mois-ci.`
          : `Tu es automatiquement inscrit au tournoi "${formData.name.trim()}". Tu as utilisé tes 2 tournois gratuits du mois.`
        : `Tu es automatiquement inscrit au tournoi "${formData.name.trim()}".`;

      showSuccess('Tournoi créé !', successMessage);

      onTournamentCreated(response);
      onSwitchToMyTournaments?.();
      onClose();
    } catch (error: any) {
      if (error instanceof TournamentCreationError && error.requiresSubscription) {
        showError('Quota mensuel atteint', error.message);
        onRequireSubscription?.();
        onClose();
        return;
      }

      const errorMessage =
        error?.message ||
        'Une erreur est survenue lors de la création du tournoi';

      showError('Erreur de création', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [isBlockedByQuota, formData, validateForm, showSuccess, showError, onTournamentCreated, onSwitchToMyTournaments, onClose, onRequireSubscription]);

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
            <div className={`creation-quota-banner ${quotaVariant}`}>
              <div className="creation-quota-banner-header">
                <span className="creation-quota-badge">
                  {creationAccess?.has_active_subscription
                    ? 'Abonnement actif'
                    : `${creationAccess?.monthly_free_tournaments_remaining ?? 2}/${creationAccess?.monthly_free_tournaments_limit ?? 2} gratuits restants`
                  }
                </span>
                <span className="creation-quota-kicker">
                  {creationAccess?.has_active_subscription ? 'Création illimitée' : 'Quota mensuel'}
                </span>
              </div>
              <p className="creation-quota-text">
                {creationAccess?.has_active_subscription
                  ? 'Vous pouvez créer autant de tournois que nécessaire, sans aucune limite mensuelle.'
                  : isBlockedByQuota
                    ? 'Vos 2 tournois gratuits du mois ont été utilisés. Passez à l’abonnement pour continuer sans attendre le mois prochain.'
                    : 'Chaque mois, vous disposez de 2 créations gratuites. Le compteur se met à jour instantanément après chaque tournoi créé.'
                }
              </p>
            </div>

            <p className="form-description">
              Créez votre tournoi et affrontez {Math.max(formData.max_players - 1, 1)} autres joueurs dans une compétition à élimination directe !
            </p>

            {isBlockedByQuota ? (
              <div className="creation-lock-panel">
                <div className="creation-lock-icon">✨</div>
                <h3>Débloquez la création illimitée</h3>
                <p>
                  Vous avez déjà profité de vos 2 tournois gratuits ce mois-ci. L’abonnement tournoi débloque une création illimitée,
                  une expérience plus fluide et une organisation sans friction, même sur mobile.
                </p>
                <div className="creation-lock-actions">
                  <button type="button" className="btn btn-primary" onClick={() => { onRequireSubscription?.(); onClose(); }}>
                    Voir l’abonnement tournoi
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <>
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

            {/* Max Players */}
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">👥</span>
                Format du bracket
              </label>
              <div className="privacy-toggle-container">
                {BRACKET_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`privacy-option ${formData.max_players === size ? 'active' : ''}`}
                    onClick={() => handleInputChange('max_players', size)}
                    disabled={isSubmitting}
                  >
                    <span className="privacy-icon">🏁</span>
                    <div className="privacy-content">
                      <span className="privacy-title">{size} joueurs</span>
                      <span className="privacy-description">Bracket {size / 2 > 1 ? `${size / 2} matchs au 1er tour` : 'direct'} </span>
                    </div>
                  </button>
                ))}
              </div>
              {errors.max_players && <span className="form-error">{errors.max_players}</span>}
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
                className="form-input"
                value={endDateLocal}
                disabled
                aria-readonly="true"
              />
              <span className="form-hint">Calculée automatiquement à partir de la date de début.</span>
            </div>

            {/* Footer Actions */}
            <div className="modal-footer tournament-modal-footer">
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
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Création...' : 'Créer le tournoi'}
              </button>
            </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

CreateTournamentModal.displayName = 'CreateTournamentModal';

export default CreateTournamentModal;
