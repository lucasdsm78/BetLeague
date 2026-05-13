import React, { useState, useCallback, useEffect, memo } from 'react';
import './EditLeagueModal.css';
import { updateLeague } from '../../services/api/leagues';

interface LeagueToEdit {
  id: number;
  name: string;
  isStarted?: boolean;
  maxPlayers?: number;
  minPlayers?: number;
  isFree?: boolean;
  nbBtl?: number;
  startDate?: number; // Timestamp Unix
}

interface EditLeagueModalProps {
  league: LeagueToEdit;
  onClose: () => void;
  onSuccess: () => void;
}

const EditLeagueModal = memo<EditLeagueModalProps>(({ league, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: league.name,
    maxPlayers: league.maxPlayers || 10,
    minPlayers: league.minPlayers || 2,
    isFree: league.isFree ?? true,
    nbBtl: league.nbBtl || 100,
  });

  const [originalData] = useState({
    name: league.name,
    maxPlayers: league.maxPlayers || 10,
    minPlayers: league.minPlayers || 2,
    isFree: league.isFree ?? true,
    nbBtl: league.nbBtl || 100,
  });

  const [errors, setErrors] = useState<{
    name?: string;
    maxPlayers?: string;
    minPlayers?: string;
    nbBtl?: string;
    general?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    maxPlayers: false,
    minPlayers: false,
    nbBtl: false,
  });

  // Validation en temps réel
  const validateField = useCallback(
    (field: 'name' | 'maxPlayers' | 'minPlayers' | 'nbBtl', value: string | number): string | undefined => {
      if (field === 'name') {
        const nameValue = String(value).trim();
        if (!nameValue) return 'Le nom de la ligue ne peut pas être vide';
        if (nameValue.length < 3) return 'Le nom doit contenir au moins 3 caractères';
        if (nameValue.length > 50) return 'Le nom ne peut pas dépasser 50 caractères';
        if (!/^[A-Za-z0-9\s\-_.]+$/.test(nameValue)) {
          return 'Caractères autorisés: lettres, chiffres, espaces, tirets, underscores et points';
        }
      }

      if (field === 'maxPlayers') {
        const maxPlayersValue = Number(value);
        if (!Number.isInteger(maxPlayersValue) || maxPlayersValue < 2) {
          return 'Le nombre minimum de participants est 2';
        }
        if (maxPlayersValue > 200) {
          return 'Le nombre maximum de joueurs est 200';
        }
      }

      if (field === 'minPlayers') {
        const minPlayersValue = Number(value);
        if (!Number.isInteger(minPlayersValue) || minPlayersValue < 2) {
          return 'Le nombre minimum de joueurs est 2';
        }
        if (minPlayersValue > formData.maxPlayers) {
          return 'Le minimum de joueurs doit être inférieur ou égal au maximum';
        }
      }

      if (field === 'nbBtl' && !formData.isFree) {
        const nbBtlValue = Number(value);
        if (!Number.isInteger(nbBtlValue) || nbBtlValue <= 0) {
          return 'Le montant BTL doit être un nombre positif';
        }
        if (nbBtlValue > 10000) {
          return 'Le montant BTL ne peut pas dépasser 10000';
        }
      }

      return undefined;
    },
    [formData.isFree]
  );

  const handleChange = useCallback(
      (field: 'name' | 'maxPlayers' | 'minPlayers' | 'nbBtl', value: string | number) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Valider uniquement si le champ a été touché
      if (touched[field]) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [touched, validateField]
  );

  const handleBlur = useCallback(
      (field: 'name' | 'maxPlayers' | 'minPlayers' | 'nbBtl') => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, formData[field]);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [formData, validateField]
  );

  const hasChanges = useCallback(() => {
    // Seuls name et maxPlayers peuvent être modifiés
    return (
      formData.name.trim() !== originalData.name ||
        formData.maxPlayers !== originalData.maxPlayers ||
        formData.minPlayers !== originalData.minPlayers
    );
  }, [formData, originalData]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Marquer tous les champs comme touchés
      setTouched({ name: true, maxPlayers: true, minPlayers: true, nbBtl: true });

      // Valider tous les champs
      const nameError = validateField('name', formData.name);
      const maxPlayersError = validateField('maxPlayers', formData.maxPlayers);
      const minPlayersError = validateField('minPlayers', formData.minPlayers);
      const nbBtlError =
        !formData.isFree ? validateField('nbBtl', formData.nbBtl) : undefined;

      if (nameError || maxPlayersError || minPlayersError || nbBtlError) {
        setErrors({ name: nameError, maxPlayers: maxPlayersError, minPlayers: minPlayersError, nbBtl: nbBtlError });
        return;
      }

      // Vérifier s'il y a des changements
      if (!hasChanges()) {
        setErrors({ general: 'Aucune modification détectée' });
        return;
      }

      setIsSubmitting(true);
      setErrors({});

      try {
        // Le backend attend TOUS les champs obligatoires (name, max_players, start_date)
        // start_date est en MILLISECONDES (aligné avec create_league)
        let startDate = league.startDate ?? Date.now();
        if (startDate < 1_000_000_000_000) {
          // Si pour une raison quelconque le front a des secondes, convertir en ms
          startDate = startDate * 1000;
        }

        // Le backend n'accepte QUE ces 3 champs pour la mise à jour
        const updateData: any = {
          name: formData.name.trim(),
          max_players: formData.maxPlayers,
          min_players: formData.minPlayers,
          start_date: startDate, // Timestamp Unix en millisecondes
        };

        await updateLeague(league.id, updateData);

        // si pas throw => succès
        setSuccess(true);

        // Appeler onSuccess immédiatement pour déclencher le rafraîchissement
        onSuccess();

        // Fermer le modal après avoir montré le message de succès
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (error: any) {
        console.error('Erreur lors de la mise à jour de la ligue:', error);

        // Gérer les erreurs spécifiques
        if (error.message) {
          if (error.message.toLowerCase().includes('nom')) {
            setErrors({ name: error.message });
          } else if (error.message.toLowerCase().includes('joueur')) {
            setErrors({ maxPlayers: error.message, minPlayers: error.message });
          } else if (error.message.toLowerCase().includes('btl')) {
            setErrors({ nbBtl: error.message });
          } else {
            setErrors({ general: error.message });
          }
        } else {
          setErrors({ general: 'Une erreur est survenue lors de la mise à jour' });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, originalData, validateField, hasChanges, league.id, onSuccess, onClose]
  );

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSubmitting, onClose]);

  // Bloquer le scroll du body quand le modal est ouvert
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const isFormValid = !errors.name && !errors.maxPlayers && !errors.minPlayers && !errors.nbBtl && hasChanges();

  // Vérifier si la ligue a déjà commencé
  const isLeagueStarted = league.isStarted;

  if (isLeagueStarted) {
    return (
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="modal-container" role="dialog" aria-labelledby="modal-title" aria-modal="true">
          <div className="modal-header">
            <h2 id="modal-title">Modification impossible</h2>
            <button
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          <div className="modal-body">
            <div className="error-banner" role="alert">
              <div className="error-content">
                <span className="error-icon" aria-hidden="true">⚠️</span>
                <span className="error-text">
                  Cette ligue a déjà commencé et ne peut plus être modifiée.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div className="modal-container" role="dialog" aria-labelledby="modal-title" aria-modal="true">
        <div className="modal-header">
          <h2 id="modal-title">Modifier la ligue</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {errors.general && (
            <div className="error-banner" role="alert" aria-live="polite">
              <div className="error-content">
                <span className="error-icon" aria-hidden="true">⚠️</span>
                <span className="error-text">{errors.general}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="success-banner" role="status" aria-live="polite">
              <div className="success-content">
                <span className="success-icon" aria-hidden="true">✅</span>
                <span className="success-text">Ligue mise à jour avec succès !</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="edit-league-name" className="form-label">
              Nom de la ligue
            </label>
            <input
              id="edit-league-name"
              type="text"
              className={`form-input ${errors.name ? 'input-error' : ''}`}
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              disabled={isSubmitting || success}
              placeholder="Nom de la ligue"
              maxLength={50}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <span id="name-error" className="error-message" role="alert">
                {errors.name}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="edit-max-players" className="form-label">
              Nombre maximum de joueurs
            </label>
            <input
              id="edit-max-players"
              type="number"
              className={`form-input ${errors.maxPlayers ? 'input-error' : ''}`}
              value={formData.maxPlayers}
              onChange={(e) => handleChange('maxPlayers', parseInt(e.target.value) || 2)}
              onBlur={() => handleBlur('maxPlayers')}
              disabled={isSubmitting || success}
              min={2}
              max={200}
              aria-invalid={!!errors.maxPlayers}
              aria-describedby={errors.maxPlayers ? 'maxPlayers-error' : undefined}
            />
            {errors.maxPlayers && (
              <span id="maxPlayers-error" className="error-message" role="alert">
                {errors.maxPlayers}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="edit-min-players" className="form-label">
              Nombre minimum de joueurs
            </label>
            <input
              id="edit-min-players"
              type="number"
              className={`form-input ${errors.minPlayers ? 'input-error' : ''}`}
              value={formData.minPlayers}
              onChange={(e) => handleChange('minPlayers', parseInt(e.target.value, 10) || 2)}
              onBlur={() => handleBlur('minPlayers')}
              disabled={isSubmitting || success}
              min={2}
              max={formData.maxPlayers}
              aria-invalid={!!errors.minPlayers}
              aria-describedby={errors.minPlayers ? 'minPlayers-error' : undefined}
            />
            {errors.minPlayers && (
              <span id="minPlayers-error" className="error-message" role="alert">
                {errors.minPlayers}
              </span>
            )}
          </div>

          {/* Note: is_free et nb_btl ne peuvent pas être modifiés après création */}
          <div className="form-group">
            <div style={{
              padding: '0.75rem',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}>
              <strong>Type de ligue :</strong> {formData.isFree ? 'Gratuite' : `Payante (${formData.nbBtl} BTL)`}
              <br />
              <small style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                Le type et le montant ne peuvent pas être modifiés après création
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting || success}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !isFormValid || success}
            >
              {isSubmitting ? 'Mise à jour...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

EditLeagueModal.displayName = 'EditLeagueModal';

export default EditLeagueModal;
