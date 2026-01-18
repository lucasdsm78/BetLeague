import React, { useState, useCallback, useEffect, memo } from 'react';
import './EditAccountModal.css';
import { useUpdateProfileMutation } from '../../hooks/queries/useProfileMutations';
import { useGlobalToast } from '../../toast/ToastProvider';

interface EditAccountModalProps {
  pseudo: string;
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EditAccountModal = memo<EditAccountModalProps>(({ pseudo, email, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    pseudo: pseudo,
    email: email,
  });

  const [originalData] = useState({ pseudo, email });
  const [errors, setErrors] = useState<{ pseudo?: string; email?: string; general?: string }>({});
  const [success, setSuccess] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  const [touched, setTouched] = useState({ pseudo: false, email: false });

  // Validation en temps réel
  const validateField = useCallback((field: 'pseudo' | 'email', value: string): string | undefined => {
    if (field === 'pseudo') {
      const trimmed = value.trim();
      if (!trimmed) return 'Le pseudo ne peut pas être vide';
      if (trimmed.length < 2) return 'Le pseudo doit contenir au moins 2 caractères';
      if (trimmed.length > 50) return 'Le pseudo ne peut pas dépasser 50 caractères';
      if (!/^[a-zA-Z0-9\s\-_.]+$/.test(trimmed)) {
        return 'Caractères autorisés: lettres, chiffres, espaces, tirets, underscores, points';
      }
    }

    if (field === 'email') {
      const trimmed = value.trim().toLowerCase();
      if (!trimmed) return 'L\'email ne peut pas être vide';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) return 'Format d\'email invalide';
      if (trimmed.length > 320) return 'L\'email est trop long (maximum 320 caractères)';
    }

    return undefined;
  }, []);

  const handleChange = useCallback((field: 'pseudo' | 'email', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Valider uniquement si le champ a été touché
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((field: 'pseudo' | 'email') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, [formData, validateField]);

  const hasChanges = useCallback(() => {
    return formData.pseudo.trim() !== originalData.pseudo ||
           formData.email.trim().toLowerCase() !== originalData.email.toLowerCase();
  }, [formData, originalData]);

  const updateProfileMutation = useUpdateProfileMutation();
  const toast = useGlobalToast();

  const isSubmitting = updateProfileMutation.isPending;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Marquer tous les champs comme touchés
    setTouched({ pseudo: true, email: true });

    // Valider tous les champs
    const pseudoError = validateField('pseudo', formData.pseudo);
    const emailError = validateField('email', formData.email);

    if (pseudoError || emailError) {
      setErrors({ pseudo: pseudoError, email: emailError });
      return;
    }

    // Vérifier s'il y a des changements
    if (!hasChanges()) {
      setErrors({ general: 'Aucune modification détectée' });
      return;
    }

    setErrors({});

    try {
      const updateData: { pseudo?: string; email?: string } = {};
      const hasEmailChanged = formData.email.trim().toLowerCase() !== originalData.email.toLowerCase();

      if (formData.pseudo.trim() !== originalData.pseudo) {
        updateData.pseudo = formData.pseudo.trim();
      }

      if (hasEmailChanged) {
        updateData.email = formData.email.trim().toLowerCase();
      }

      const response = await updateProfileMutation.mutateAsync(updateData);

      if (response.success) {
        setSuccess(true);

        // Marquer si l'email a changé
        if (hasEmailChanged) {
          setEmailChanged(true);
        }

        toast.showSuccess(
          'Profil mis à jour',
          hasEmailChanged ? 'Email mis à jour. Votre session peut être rafraîchie.' : 'Modifications enregistrées.'
        );

        // Délai pour lire le message (plus long si email changé)
        const delay = hasEmailChanged ? 2000 : 1500;

        setTimeout(() => {
          onSuccess();
          onClose();
        }, delay);
      } else {
        const msg = response.error || 'Échec de la mise à jour du profil';
        setErrors({ general: msg });
        toast.showError('Mise à jour impossible', msg);
      }
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du profil:', error);

      // Gérer les erreurs spécifiques
      if (error.message) {
        if (error.message.toLowerCase().includes('pseudo')) {
          setErrors({ pseudo: error.message });
          toast.showError('Pseudo invalide', error.message);
        } else if (error.message.toLowerCase().includes('email')) {
          setErrors({ email: error.message });
          toast.showError('Email invalide', error.message);
        } else {
          setErrors({ general: error.message });
          toast.showError('Erreur', error.message);
        }
      } else {
        setErrors({ general: 'Une erreur est survenue lors de la mise à jour' });
        toast.showError('Erreur', 'Une erreur est survenue lors de la mise à jour');
      }
    }
  }, [formData, originalData, validateField, hasChanges, onSuccess, onClose, updateProfileMutation, toast]);

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

  const isFormValid = !errors.pseudo && !errors.email && hasChanges();

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}>
      <div className="modal-container" role="dialog" aria-labelledby="modal-title" aria-modal="true">
        <div className="modal-header">
          <h2 id="modal-title">Modifier les informations</h2>
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
                <span className="success-text">
                  {emailChanged
                    ? 'Email mis à jour avec succès !'
                    : 'Profil mis à jour avec succès !'}
                </span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="edit-pseudo" className="form-label">
              Pseudo
            </label>
            <input
              id="edit-pseudo"
              type="text"
              className={`form-input ${errors.pseudo ? 'input-error' : ''}`}
              value={formData.pseudo}
              onChange={(e) => handleChange('pseudo', e.target.value)}
              onBlur={() => handleBlur('pseudo')}
              disabled={isSubmitting || success}
              placeholder="Votre pseudo"
              autoComplete="username"
              maxLength={50}
              aria-invalid={!!errors.pseudo}
              aria-describedby={errors.pseudo ? 'pseudo-error' : undefined}
            />
            {errors.pseudo && (
              <span id="pseudo-error" className="error-message" role="alert">
                {errors.pseudo}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="edit-email" className="form-label">
              Email
            </label>
            <input
              id="edit-email"
              type="email"
              className={`form-input ${errors.email ? 'input-error' : ''}`}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              disabled={isSubmitting || success}
              placeholder="votre@email.com"
              autoComplete="email"
              maxLength={320}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <span id="email-error" className="error-message" role="alert">
                {errors.email}
              </span>
            )}
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

EditAccountModal.displayName = 'EditAccountModal';

export default EditAccountModal;
