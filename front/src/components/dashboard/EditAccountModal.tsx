import React, { useState, useCallback, useEffect, memo } from 'react';
import './EditAccountModal.css';
import { useUpdateProfileMutation } from '../../hooks/queries/useProfileMutations';
import { useGlobalToast } from '../../toast/ToastProvider';

interface EditAccountModalProps {
  pseudo: string;
  email: string;
  isTwoFactorEnabled?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EditAccountModal = memo<EditAccountModalProps>(({ pseudo, email, isTwoFactorEnabled = false, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    pseudo: pseudo,
    email: email,
    current_password: '',
    two_fa_code: '',
  });

  const [originalData] = useState({ pseudo, email });
  const [errors, setErrors] = useState<{ pseudo?: string; email?: string; current_password?: string; two_fa_code?: string; general?: string }>({});
  const [success, setSuccess] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  const [touched, setTouched] = useState({ pseudo: false, email: false, current_password: false, two_fa_code: false });

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

  const requiresCurrentPassword = formData.email.trim().toLowerCase() !== originalData.email.toLowerCase();
  const requiresTwoFactorCode = Boolean(isTwoFactorEnabled && hasChanges());

  const validateCurrentPassword = useCallback((value: string): string | undefined => {
    if (!requiresCurrentPassword) return undefined;
    if (value.trim().length < 8) return 'Le mot de passe actuel est requis pour changer l\'email';
    return undefined;
  }, [requiresCurrentPassword]);

  const validateTwoFactorCode = useCallback((value: string): string | undefined => {
    if (!requiresTwoFactorCode) return undefined;
    if (!/^\d{6}$/.test(value.trim())) return 'Le code 2FA à 6 chiffres est requis';
    return undefined;
  }, [requiresTwoFactorCode]);

  const updateProfileMutation = useUpdateProfileMutation();
  const toast = useGlobalToast();

  const isSubmitting = updateProfileMutation.isPending;
  const hasRequiredCurrentPassword = !requiresCurrentPassword || formData.current_password.trim().length >= 8;
  const hasRequiredTwoFactorCode = !requiresTwoFactorCode || /^\d{6}$/.test(formData.two_fa_code.trim());

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Marquer tous les champs comme touchés
    setTouched({ pseudo: true, email: true, current_password: true, two_fa_code: true });

    // Valider tous les champs
    const pseudoError = validateField('pseudo', formData.pseudo);
    const emailError = validateField('email', formData.email);
    const currentPasswordError = validateCurrentPassword(formData.current_password);
    const twoFactorCodeError = validateTwoFactorCode(formData.two_fa_code);

    if (pseudoError || emailError || currentPasswordError || twoFactorCodeError) {
      setErrors({
        pseudo: pseudoError,
        email: emailError,
        current_password: currentPasswordError,
        two_fa_code: twoFactorCodeError,
      });
      return;
    }

    // Vérifier s'il y a des changements
    if (!hasChanges()) {
      setErrors({ general: 'Aucune modification détectée' });
      return;
    }

    setErrors({});

    try {
      const updateData: { pseudo?: string; email?: string; current_password?: string; two_fa_code?: string } = {};
      const hasEmailChanged = formData.email.trim().toLowerCase() !== originalData.email.toLowerCase();

      if (formData.pseudo.trim() !== originalData.pseudo) {
        updateData.pseudo = formData.pseudo.trim();
      }

      if (hasEmailChanged) {
        updateData.email = formData.email.trim().toLowerCase();
        updateData.current_password = formData.current_password.trim();
      }

      if (requiresTwoFactorCode) {
        updateData.two_fa_code = formData.two_fa_code.trim();
      }

      await updateProfileMutation.mutateAsync(updateData);

      setSuccess(true);

      // Marquer si l'email a changé
      if (hasEmailChanged) {
        setEmailChanged(true);
      }

      toast.showSuccess(
        'Profil mis à jour',
        hasEmailChanged ? 'Email mis à jour. Votre session sécurisée a été renouvelée.' : 'Modifications enregistrées.'
      );

      // Délai pour lire le message (plus long si email changé)
      const delay = hasEmailChanged ? 2000 : 1500;

      setTimeout(() => {
        onSuccess();
        onClose();
      }, delay);
    } catch (error: any) {
      // Gérer les erreurs spécifiques
      if (error.message) {
        const lowerMessage = error.message.toLowerCase();
        if (lowerMessage.includes('mot de passe actuel') || lowerMessage.includes('current_password')) {
          setErrors({ current_password: error.message });
          toast.showError('Mot de passe requis', error.message);
        } else if (lowerMessage.includes('2fa')) {
          setErrors({ two_fa_code: error.message });
          toast.showError('Code 2FA invalide', error.message);
        } else if (lowerMessage.includes('pseudo')) {
          setErrors({ pseudo: error.message });
          toast.showError('Pseudo invalide', error.message);
        } else if (lowerMessage.includes('email')) {
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
  }, [formData, originalData, validateField, validateCurrentPassword, validateTwoFactorCode, hasChanges, onSuccess, onClose, updateProfileMutation, toast, requiresTwoFactorCode]);

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

  const isFormValid =
    !errors.pseudo &&
    !errors.email &&
    !errors.current_password &&
    !errors.two_fa_code &&
    hasChanges() &&
    hasRequiredCurrentPassword &&
    hasRequiredTwoFactorCode;

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

          {requiresCurrentPassword && (
            <div className="form-group">
              <label htmlFor="edit-current-password" className="form-label">
                Mot de passe actuel
              </label>
              <input
                id="edit-current-password"
                type="password"
                className={`form-input ${errors.current_password ? 'input-error' : ''}`}
                value={formData.current_password}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, current_password: value }));
                  if (touched.current_password) {
                    setErrors(prev => ({ ...prev, current_password: validateCurrentPassword(value) }));
                  }
                }}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, current_password: true }));
                  setErrors(prev => ({ ...prev, current_password: validateCurrentPassword(formData.current_password) }));
                }}
                disabled={isSubmitting || success}
                placeholder="Confirmez avec votre mot de passe actuel"
                autoComplete="current-password"
                aria-invalid={!!errors.current_password}
                aria-describedby={errors.current_password ? 'current-password-error' : undefined}
              />
              {errors.current_password && (
                <span id="current-password-error" className="error-message" role="alert">
                  {errors.current_password}
                </span>
              )}
            </div>
          )}

          {requiresTwoFactorCode && (
            <div className="form-group">
              <label htmlFor="edit-two-fa-code" className="form-label">
                Code 2FA
              </label>
              <input
                id="edit-two-fa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={`form-input ${errors.two_fa_code ? 'input-error' : ''}`}
                value={formData.two_fa_code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData(prev => ({ ...prev, two_fa_code: value }));
                  if (touched.two_fa_code) {
                    setErrors(prev => ({ ...prev, two_fa_code: validateTwoFactorCode(value) }));
                  }
                }}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, two_fa_code: true }));
                  setErrors(prev => ({ ...prev, two_fa_code: validateTwoFactorCode(formData.two_fa_code) }));
                }}
                disabled={isSubmitting || success}
                placeholder="123456"
                autoComplete="one-time-code"
                maxLength={6}
                aria-invalid={!!errors.two_fa_code}
                aria-describedby={errors.two_fa_code ? 'two-fa-code-error' : undefined}
              />
              {errors.two_fa_code && (
                <span id="two-fa-code-error" className="error-message" role="alert">
                  {errors.two_fa_code}
                </span>
              )}
            </div>
          )}

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
