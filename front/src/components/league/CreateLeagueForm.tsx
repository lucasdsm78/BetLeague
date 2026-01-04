/**
 * CreateLeagueForm - Secure, Mobile-First League Creation Component
 * Optimized for performance, security, and UX best practices
 */

import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { useEnhancedAuth } from '../../hooks/useAuth.enhanced';
import { useUserProfile } from '../../hooks/useUserProfile';
import secureApiClient from '../../services/secureApiClient';
import leagueApiService, {
  LeagueCreateFormData,
  ValidationResult
} from '../../services/leagueApiService';
import InsufficientBTLModal from '../InsufficientBTLModal';
import './CreateLeagueForm.css';

// Types for enhanced type safety
interface FormErrors {
  name?: string;
  maxMembers?: string;
  entryFee?: string;
  description?: string;
  general?: string;
}

interface CreateLeagueFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (league: any, message: string) => void;
  className?: string;
}

// Secure input validation patterns
const VALIDATION_PATTERNS = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 50,
  MAX_MEMBERS_MIN: 2,
  MAX_MEMBERS_MAX: 200,
  ENTRY_FEE_MIN: 0,
  ENTRY_FEE_MAX: 10000,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;

// Optimized FormInput component with security features
const SecureFormInput = memo<{
  type: string;
  name: string;
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  pattern?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  'aria-describedby'?: string;
}>(({
  type,
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  min,
  max,
  step,
  maxLength,
  required = false,
  disabled = false,
  autoComplete = 'off',
  pattern,
  inputMode,
  'aria-describedby': ariaDescribedBy,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`form-group ${error ? 'has-error' : ''} ${isFocused ? 'focused' : ''}`}>
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="required-indicator" aria-label="requis">*</span>}
      </label>
      <div className="input-wrapper">
        <input
          ref={inputRef}
          id={name}
          type={type}
          name={name}
          className="form-input"
          value={value}
          onChange={onChange}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          pattern={pattern}
          inputMode={inputMode}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${name}-error` : ariaDescribedBy}
          spellCheck={type === 'text' ? 'false' : undefined}
        />
      </div>
      {error && (
        <div
          id={`${name}-error`}
          className="form-error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

SecureFormInput.displayName = 'SecureFormInput';

// Optimized Select component
const SecureFormSelect = memo<{
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string; description?: string }[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
}>(({ name, label, value, onChange, options, error, required = false, disabled = false }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`form-group ${error ? 'has-error' : ''} ${isFocused ? 'focused' : ''}`}>
      <label htmlFor={name} className="form-label">
        {label}
        {required && <span className="required-indicator" aria-label="requis">*</span>}
      </label>
      <div className="select-wrapper">
        <select
          id={name}
          name={name}
          className="form-select"
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          disabled={disabled}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${name}-error` : undefined}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="select-arrow" aria-hidden="true">▼</div>
      </div>
      {error && (
        <div
          id={`${name}-error`}
          className="form-error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

SecureFormSelect.displayName = 'SecureFormSelect';

// Optimized Textarea component
const SecureFormTextarea = memo<{
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  error?: string;
  disabled?: boolean;
}>(({ name, label, value, onChange, onBlur, placeholder, maxLength, rows = 3, error, disabled = false }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(value.length);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCharCount(e.target.value.length);
    onChange(e);
  }, [onChange]);

  return (
    <div className={`form-group ${error ? 'has-error' : ''} ${isFocused ? 'focused' : ''}`}>
      <label htmlFor={name} className="form-label">
        {label}
        {maxLength && (
          <span className="char-counter">
            {charCount}/{maxLength}
          </span>
        )}
      </label>
      <div className="textarea-wrapper">
        <textarea
          id={name}
          name={name}
          className="form-textarea"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          disabled={disabled}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${name}-error` : undefined}
          spellCheck="true"
        />
      </div>
      {error && (
        <div
          id={`${name}-error`}
          className="form-error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

SecureFormTextarea.displayName = 'SecureFormTextarea';

// Main CreateLeagueForm component
const CreateLeagueForm = memo<CreateLeagueFormProps>(({
  isOpen,
  onClose,
  onSuccess,
  className = ''
}) => {
  const { user } = useEnhancedAuth();
  const { profile, refetch: refetchProfile } = useUserProfile();

  // Get user's BTL balance from profile (most accurate source)
  // Fallback to user.btlBalance if profile not loaded yet, then to 0
  const userBtlBalance = profile?.nb_btl ?? user?.btlBalance ?? 0;

  // Form state with optimized initial values
  const [formData, setFormData] = useState<LeagueCreateFormData>({
    name: '',
    type: 'private',
    maxMembers: 10,
    entryFee: 0,
    description: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isInsufficientBTLModalOpen, setIsInsufficientBTLModalOpen] = useState(false);

  // Refs for accessibility and performance
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Optimized validation functions with security checks
  const validateName = useCallback((name: string): ValidationResult => {
    return leagueApiService.validateLeagueName(name);
  }, []);

  const validateMaxMembers = useCallback((value: number): string | undefined => {
    if (!Number.isInteger(value) || value < VALIDATION_PATTERNS.MAX_MEMBERS_MIN) {
      return `Minimum ${VALIDATION_PATTERNS.MAX_MEMBERS_MIN} participants requis`;
    }
    if (value > VALIDATION_PATTERNS.MAX_MEMBERS_MAX) {
      return `Maximum ${VALIDATION_PATTERNS.MAX_MEMBERS_MAX} participants autorisés`;
    }
    return undefined;
  }, []);

  const validateEntryFee = useCallback((value: number): string | undefined => {
    if (!Number.isInteger(value) || value < VALIDATION_PATTERNS.ENTRY_FEE_MIN) {
      return 'La mise d\'entrée ne peut pas être négative';
    }
    if (value > VALIDATION_PATTERNS.ENTRY_FEE_MAX) {
      return `Maximum ${VALIDATION_PATTERNS.ENTRY_FEE_MAX} BTL autorisés`;
    }
    // Check if user has enough BTL for paid league creation
    if (value > 0 && value > userBtlBalance) {
      return `Solde insuffisant (vous avez ${userBtlBalance} BTL)`;
    }
    return undefined;
  }, [userBtlBalance]);

  const validateDescription = useCallback((description: string): string | undefined => {
    if (description && description.length > VALIDATION_PATTERNS.DESCRIPTION_MAX_LENGTH) {
      return `Maximum ${VALIDATION_PATTERNS.DESCRIPTION_MAX_LENGTH} caractères autorisés`;
    }
    return undefined;
  }, []);

  // Comprehensive form validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    const nameValidation = validateName(formData.name);
    if (!nameValidation.isValid) {
      newErrors.name = nameValidation.error;
    }

    // Max members validation
    const maxMembersError = validateMaxMembers(formData.maxMembers);
    if (maxMembersError) {
      newErrors.maxMembers = maxMembersError;
    }

    // Entry fee validation
    const entryFeeError = validateEntryFee(formData.entryFee);
    if (entryFeeError) {
      newErrors.entryFee = entryFeeError;
    }

    // Description validation
    const descriptionError = validateDescription(formData.description || '');
    if (descriptionError) {
      newErrors.description = descriptionError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateName, validateMaxMembers, validateEntryFee, validateDescription]);

  // Optimized input handlers with debouncing
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    // Clear related errors immediately for better UX
    setErrors(prev => ({
      ...prev,
      [name]: undefined,
      general: undefined,
    }));

    // Type-safe value conversion
    let processedValue: string | number = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseInt(value, 10);
      if (isNaN(processedValue as number)) {
        processedValue = 0;
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));

    // Show preview for valid forms
    if (name === 'entryFee' || name === 'maxMembers') {
      setShowPreview(true);
    }
  }, []);

  // Real-time field validation on blur
  const handleFieldBlur = useCallback((fieldName: keyof FormErrors) => {
    switch (fieldName) {
      case 'name':
        const nameValidation = validateName(formData.name);
        if (!nameValidation.isValid) {
          setErrors(prev => ({ ...prev, name: nameValidation.error }));
        }
        break;
      case 'maxMembers':
        const maxMembersError = validateMaxMembers(formData.maxMembers);
        if (maxMembersError) {
          setErrors(prev => ({ ...prev, maxMembers: maxMembersError }));
        }
        break;
      case 'entryFee':
        const entryFeeError = validateEntryFee(formData.entryFee);
        if (entryFeeError) {
          setErrors(prev => ({ ...prev, entryFee: entryFeeError }));
        }
        break;
      case 'description':
        const descriptionError = validateDescription(formData.description || '');
        if (descriptionError) {
          setErrors(prev => ({ ...prev, description: descriptionError }));
        }
        break;
    }
  }, [formData, validateName, validateMaxMembers, validateEntryFee, validateDescription]);

  // Secure form submission with comprehensive error handling
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      console.warn('Form validation failed');
      return;
    }

    // Vérifier le solde BTL avant de soumettre pour les ligues payantes
    if (formData.entryFee > 0 && formData.entryFee > userBtlBalance) {
      setIsInsufficientBTLModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      console.log('🚀 Submitting league creation form...', formData);

      // Debug auth state before making request
      console.log('🔐 Auth state before league creation:', {
        user,
        hasUser: !!user,
        userEmail: user?.email
      });

      const result = await leagueApiService.createLeague(formData);

      if (result.success) {
        console.log('✅ League created successfully:', result);

        // Pour les ligues payantes: rafraîchir le cache et le profil
        if (formData.entryFee > 0) {
          console.log(`💳 League created with entry fee: ${formData.entryFee} BTL`);
          console.log('🗑️ Clearing API cache to ensure fresh data...');

          // Vider le cache pour forcer le rechargement des données
          secureApiClient.clearCache();

          // Rafraîchir le profil utilisateur pour mettre à jour le solde BTL
          console.log(`💳 Refreshing user profile to update BTL balance (debited ${formData.entryFee} BTL)...`);
          refetchProfile().catch(err => {
            console.warn('Failed to refresh profile after league creation:', err);
          });
        }

        // Reset form state
        setFormData({
          name: '',
          type: 'private',
          maxMembers: 10,
          entryFee: 0,
          description: '',
        });
        setShowPreview(false);
        setErrors({});

        // Close modal and notify parent with appropriate message
        const successMessage = formData.entryFee > 0
          ? `Ligue créée avec succès ! ${formData.entryFee} BTL ont été débités de votre compte.`
          : 'Ligue créée avec succès !';

        onClose();
        onSuccess(result.data, result.message || successMessage);
      } else {
        console.error('❌ League creation failed:', result.error);

        // Enhanced error handling for BTL-related errors
        let errorMessage = result.error || 'Erreur lors de la création de la ligue';

        // Check for BTL-related errors from backend
        if (errorMessage.toLowerCase().includes('btl') ||
            errorMessage.toLowerCase().includes('insufficient') ||
            errorMessage.toLowerCase().includes('solde')) {
          errorMessage = `💳 Solde BTL insuffisant. Vous avez ${userBtlBalance} BTL mais la création de cette ligue nécessite ${formData.entryFee} BTL.`;
          setErrors({ entryFee: errorMessage });
        } else {
          setErrors({ general: errorMessage });
        }
      }
    } catch (error: any) {
      console.error('❌ Unexpected error during league creation:', error);

      // Check if it's a BTL-related error
      const errorMessage = error?.message || error?.toString() || '';
      if (errorMessage.toLowerCase().includes('btl') ||
          errorMessage.toLowerCase().includes('insufficient') ||
          errorMessage.toLowerCase().includes('solde')) {
        setErrors({
          entryFee: `💳 Solde BTL insuffisant. Vous avez ${userBtlBalance} BTL mais cette ligue nécessite ${formData.entryFee} BTL.`
        });
      } else {
        setErrors({
          general: 'Une erreur inattendue s\'est produite. Veuillez réessayer.'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onClose, onSuccess, userBtlBalance, refetchProfile]);

  // Enhanced keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        type: 'private',
        maxMembers: 10,
        entryFee: 0,
        description: '',
      });
      setErrors({});
      setShowPreview(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Don't render if not open (performance optimization)
  if (!isOpen) {
    return null;
  }

  // Calculate estimated pot for preview
  const estimatedPot = formData.entryFee > 0 && formData.maxMembers > 0
    ? formData.maxMembers * formData.entryFee
    : 0;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-league-title"
    >
      <div
        className={`modal-content create-league-modal ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 id="create-league-title" className="modal-title">
            Créer une nouvelle ligue
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fermer la modal"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Error Banner */}
        {errors.general && (
          <div className="error-banner" role="alert" aria-live="assertive">
            <span className="error-icon" aria-hidden="true">🚨</span>
            <span className="error-text">{errors.general}</span>
          </div>
        )}

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="create-league-form"
          noValidate
        >
          {/* League Name */}
          <SecureFormInput
            type="text"
            name="name"
            label="Nom de la ligue"
            value={formData.name}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur('name')}
            error={errors.name}
            placeholder="Ex: Ligue Premier League"
            maxLength={VALIDATION_PATTERNS.NAME_MAX_LENGTH}
            required
            disabled={isSubmitting}
            autoComplete="off"
            pattern="[A-Za-z0-9\s\-_\.]+"
          />

          {/* Type and Max Members Row */}
          <div className="form-row">
            <SecureFormSelect
              name="type"
              label="Visibilité"
              value={formData.type}
              onChange={handleInputChange}
              options={[
                {
                  value: 'private',
                  label: '🔒 Privée',
                  description: 'Accessible uniquement sur invitation'
                },
                {
                  value: 'public',
                  label: '🌍 Publique',
                  description: 'Visible et accessible à tous'
                },
              ]}
              error={errors.maxMembers}
              required
              disabled={isSubmitting}
            />

            <SecureFormInput
              type="number"
              name="maxMembers"
              label="Nombre maximum de participants"
              value={formData.maxMembers}
              onChange={handleInputChange}
              onBlur={() => handleFieldBlur('maxMembers')}
              error={errors.maxMembers}
              min={VALIDATION_PATTERNS.MAX_MEMBERS_MIN}
              max={VALIDATION_PATTERNS.MAX_MEMBERS_MAX}
              required
              disabled={isSubmitting}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

          {/* Entry Fee with BTL Balance Display */}
          <SecureFormInput
            type="number"
            name="entryFee"
            label="Mise d'entrée (BTL)"
            value={formData.entryFee}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur('entryFee')}
            error={errors.entryFee}
            min={VALIDATION_PATTERNS.ENTRY_FEE_MIN}
            max={VALIDATION_PATTERNS.ENTRY_FEE_MAX}
            required
            disabled={isSubmitting}
            step={1}
            inputMode="numeric"
            pattern="[0-9]*"
          />

          {/* BTL Balance and Status */}
          <div className="btl-balance-section">
            <div id="btl-balance-display" className="btl-balance-display">
              <span className="btl-balance-label">💳 Votre solde:</span>
              <span className="btl-balance-value">{userBtlBalance.toLocaleString()} BTL</span>
            </div>
            {formData.entryFee > 0 && (
              <div className={`btl-status ${formData.entryFee <= userBtlBalance ? 'sufficient' : 'insufficient'}`}>
                {formData.entryFee <= userBtlBalance ? (
                  <>
                    <span className="status-icon">✓</span>
                    <span className="status-text">Solde suffisant</span>
                  </>
                ) : (
                  <>
                    <span className="status-icon" aria-hidden="true">✕</span>
                    <span className="status-text">
                      Solde insuffisant (il manque {(formData.entryFee - userBtlBalance).toLocaleString()} BTL)
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div id="entry-fee-help" className="form-help">
            {formData.entryFee === 0
              ? '💡 Ligue gratuite - aucune mise d\'entrée requise'
              : '💰 Les participants devront payer cette mise pour rejoindre la ligue'
            }
          </div>

          {/* Description */}
          <SecureFormTextarea
            name="description"
            label="Description (optionnel)"
            value={formData.description || ''}
            onChange={handleInputChange}
            onBlur={() => handleFieldBlur('description')}
            error={errors.description}
            placeholder="Règles spéciales, informations sur les prix, etc..."
            maxLength={VALIDATION_PATTERNS.DESCRIPTION_MAX_LENGTH}
            rows={3}
            disabled={isSubmitting}
          />

          {/* Preview Section */}
          {showPreview && estimatedPot > 0 && (
            <div className="league-preview">
              <h4 className="preview-title">🏆 Aperçu de la ligue</h4>
              <div className="preview-stats">
                <div className="preview-stat">
                  <span className="stat-label">Cagnotte totale estimée:</span>
                  <span className="stat-value">{estimatedPot.toLocaleString()} BTL</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">Mise par participant:</span>
                  <span className="stat-value">{formData.entryFee} BTL</span>
                </div>
                <div className="preview-stat">
                  <span className="stat-label">Participants maximum:</span>
                  <span className="stat-value">{formData.maxMembers}</span>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="modal-actions">
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
              disabled={
                isSubmitting ||
                !formData.name.trim() ||
                !!errors.name ||
                !!errors.maxMembers ||
                !!errors.entryFee ||
                !!errors.description
              }
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner" aria-hidden="true"></span>
                  Création en cours...
                </>
              ) : (
                'Créer la ligue'
              )}
            </button>
          </div>
        </form>
      </div>

      {isInsufficientBTLModalOpen && (
        <InsufficientBTLModal
          currentBalance={userBtlBalance}
          requiredAmount={formData.entryFee}
          action="créer cette ligue"
          onClose={() => setIsInsufficientBTLModalOpen(false)}
        />
      )}
    </div>
  );
});

CreateLeagueForm.displayName = 'CreateLeagueForm';

export default CreateLeagueForm;
