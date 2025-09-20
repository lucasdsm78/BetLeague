/**
 * RegisterForm Component - Modern TypeScript React Registration Form
 * Optimized for sports betting theme with enhanced UX, security and mobile-first design
 */

import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AuthError } from '../services/authService';
import type { User } from '../types';

// Types
interface RegisterFormProps {
  onBack: () => void;
  onSwitchToLogin: () => void;
  onRegister: (userData: { user?: User; username?: string; pseudo?: string; email?: string }) => void;
}

interface FormData {
  pseudo: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  pseudo?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

// Password Strength Component
const PasswordStrength = memo<{ password: string }>(({ password }) => {
  const calculateStrength = useCallback((pwd: string): number => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^\w\s]/.test(pwd)) strength++;
    return Math.min(strength, 5);
  }, []);

  const strength = calculateStrength(password);
  const strengthLabels = ['Très faible', 'Faible', 'Faible', 'Moyen', 'Fort', 'Très fort'];
  const strengthColors = ['#ff4757', '#ff6b7a', '#ff9f43', '#feca57', '#48ca6c', '#2ed573'];

  if (!password) return null;

  return (
    <div className="password-strength">
      <div className="strength-meter">
        <div
          className={`strength-fill strength-${strength}`}
          style={{
            width: `${(strength / 5) * 100}%`,
            backgroundColor: strengthColors[strength]
          }}
        />
        <div className="strength-background" />
      </div>
      <div className="strength-info">
        <span
          className={`strength-label strength-${strength}`}
          style={{ color: strengthColors[strength] }}
        >
          {strengthLabels[strength]}
        </span>
        <span className="strength-requirements">
          {strength < 3 && (
            <span className="requirements-text">
              Utilisez majuscules, minuscules et chiffres
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

PasswordStrength.displayName = 'PasswordStrength';

// Form Input Component optimisé
const FormInput = memo<{
  type: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  showPasswordToggle?: boolean;
  pattern?: string;
  spellCheck?: boolean;
}>(({
  type,
  name,
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
  maxLength,
  required,
  disabled,
  showPasswordToggle,
  pattern,
  spellCheck = true
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const actualType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {placeholder}
        {required && <span className="required-asterisk" aria-label="requis">*</span>}
      </label>
      <div className={`input-wrapper ${isFocused ? 'focused' : ''} ${error ? 'error' : ''}`}>
        <input
          id={name}
          type={actualType}
          name={name}
          className="form-input"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoComplete={autoComplete}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          pattern={pattern}
          spellCheck={spellCheck}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {type === 'password' && showPasswordToggle && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            tabIndex={0}
          >
            <span className="password-toggle-icon">
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </span>
          </button>
        )}
      </div>
      {error && (
        <div className="form-error" id={`${name}-error`} role="alert">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}
    </div>
  );
});

FormInput.displayName = 'FormInput';

// Form Button Component
const FormButton = memo<{
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}>(({
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  loading = false,
  disabled = false,
  onClick,
  children,
  className = ''
}) => {
  const classes = [
    'btn',
    `btn-${variant}`,
    fullWidth ? 'btn-full-width' : '',
    loading ? 'btn-loading' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={loading ? 'Chargement en cours' : undefined}
    >
      {loading && <span className="btn-spinner" aria-hidden="true"></span>}
      <span className={loading ? 'btn-text-loading' : ''}>{children}</span>
    </button>
  );
});

FormButton.displayName = 'FormButton';

const RegisterForm = memo<RegisterFormProps>(({ onBack, onSwitchToLogin, onRegister }) => {
  const navigate = useNavigate();
  const { register } = useAuth({
    redirectOnExpiry: false,
    onAuthChange: () => {}
  });
  const [formData, setFormData] = useState<FormData>({
    pseudo: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Validation helpers
  const validatePseudo = useCallback((pseudo: string): string | undefined => {
    if (!pseudo.trim()) return 'Nom d\'utilisateur requis';
    if (pseudo.length < 3) return 'Minimum 3 caractères requis';
    if (pseudo.length > 30) return 'Maximum 30 caractères autorisés';
    if (!/^[a-zA-Z0-9_-]+$/.test(pseudo)) {
      return 'Seuls les lettres, chiffres, tirets (-) et underscores (_) sont autorisés';
    }
    if (pseudo.toLowerCase().includes('admin') || pseudo.toLowerCase().includes('bet')) {
      return 'Ce nom d\'utilisateur n\'est pas autorisé';
    }
    return undefined;
  }, []);

  const validateEmail = useCallback((email: string): string | undefined => {
    if (!email.trim()) return 'Adresse email requise';
    if (email.length > 254) return 'Adresse email trop longue';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return 'Veuillez saisir une adresse email valide';
    }
    return undefined;
  }, []);

  const validatePassword = useCallback((password: string): string | undefined => {
    if (!password) return 'Mot de passe requis';
    if (password.length < 8) return 'Minimum 8 caractères requis';
    if (password.length > 128) return 'Maximum 128 caractères autorisés';

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^\w\s]/.test(password)) strength++;

    if (strength < 3) {
      return 'Mot de passe trop faible. Utilisez majuscules, minuscules et chiffres';
    }

    // Vérifications de sécurité supplémentaires
    const commonPasswords = ['password', '123456', 'azerty', 'motdepasse'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      return 'Ce mot de passe est trop commun. Choisissez-en un plus sécurisé';
    }

    return undefined;
  }, []);

  const validateConfirmPassword = useCallback((confirmPassword: string, password: string): string | undefined => {
    if (!confirmPassword) return 'Veuillez confirmer votre mot de passe';
    if (password !== confirmPassword) {
      return 'Les mots de passe ne correspondent pas';
    }
    return undefined;
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const pseudoError = validatePseudo(formData.pseudo);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(formData.confirmPassword, formData.password);

    if (pseudoError) newErrors.pseudo = pseudoError;
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validatePseudo, validateEmail, validatePassword, validateConfirmPassword]);

  // Event handlers
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({ ...prev, [name]: value }));

    // Validation en temps réel pour effacer les erreurs
    if (errors[name as keyof FormErrors]) {
      let error: string | undefined = undefined;

      switch (name) {
        case 'pseudo':
          error = validatePseudo(value);
          break;
        case 'email':
          error = validateEmail(value);
          break;
        case 'password':
          error = validatePassword(value);
          // Revalider confirmPassword si nécessaire
          if (formData.confirmPassword && errors.confirmPassword) {
            setErrors(prev => ({
              ...prev,
              confirmPassword: validateConfirmPassword(formData.confirmPassword, value)
            }));
          }
          break;
        case 'confirmPassword':
          error = validateConfirmPassword(value, formData.password);
          break;
      }

      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  }, [errors, formData, validatePseudo, validateEmail, validatePassword, validateConfirmPassword]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }
    setIsLoading(true);
    setErrors({});

    try {
      const result = await register({
        pseudo: formData.pseudo,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        acceptTerms: true
      });

      navigate('/matches');
    } catch (error) {
      let message = 'Une erreur inattendue s\'est produite. Veuillez réessayer.';

      if (error instanceof AuthError) {
        if (error.isConflict()) {
          message = 'Cette adresse email ou ce nom d\'utilisateur est déjà utilisé.';
        } else if (error.isTooManyRequests()) {
          message = 'Trop de tentatives d\'inscription. Réessayez dans quelques minutes.';
        } else if (error.isNetworkError()) {
          message = 'Problème de connexion. Vérifiez votre connexion internet.';
        } else {
          message = error.getDisplayMessage() || message;
        }
      }

      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  }, [formData, register, validateForm, onRegister]);

  const handleBackClick = useCallback(() => {
    // Reset form state when going back
    setFormData({ pseudo: '', email: '', password: '', confirmPassword: '' });
    setErrors({});
    onBack();
  }, [onBack]);

  return (
    <div className="auth-form form-container">
      {/* Back Button */}
      <button
        className="back-button"
        onClick={handleBackClick}
        type="button"
        aria-label="Retour à l'accueil"
      />

      {/* Form Header */}
      <div className="form-header">
        <h2 className="form-title">Inscription</h2>
        <p className="form-subtitle">
          Rejoignez la communauté BetLeague et créez vos propres ligues de paris !
        </p>
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Global Error */}
        {errors.general && (
          <div className="error-banner" role="alert" aria-live="polite">
            <div className="error-content">
              <span className="error-icon" aria-hidden="true">🚨</span>
              <span className="error-text">{errors.general}</span>
            </div>
          </div>
        )}

        {/* Username Field */}
        <FormInput
          type="text"
          name="pseudo"
          placeholder="Nom d'utilisateur"
          value={formData.pseudo}
          onChange={handleChange}
          error={errors.pseudo}
          autoComplete="username"
          maxLength={30}
          required
          disabled={isLoading}
          pattern="[a-zA-Z0-9_-]+"
          spellCheck={false}
        />

        {/* Email Field */}
        <FormInput
          type="email"
          name="email"
          placeholder="Adresse email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete="email"
          maxLength={254}
          required
          disabled={isLoading}
          spellCheck={false}
        />

        {/* Password Field with Strength Meter */}
        <div className="form-group password-group">
          <FormInput
            type="password"
            name="password"
            placeholder="Mot de passe"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            autoComplete="new-password"
            maxLength={128}
            required
            disabled={isLoading}
            showPasswordToggle
          />
          <PasswordStrength password={formData.password} />
        </div>

        {/* Confirm Password Field */}
        <FormInput
          type="password"
          name="confirmPassword"
          placeholder="Confirmer le mot de passe"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          autoComplete="new-password"
          maxLength={128}
          required
          disabled={isLoading}
          showPasswordToggle
        />

        {/* Submit Button */}
        <div className="form-actions">
          <FormButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? 'Création du compte...' : 'Créer mon compte'}
          </FormButton>
        </div>
      </form>

      {/* Footer Links */}
      <div className="form-footer">
        <p>
          Déjà un compte ?{' '}
          <button
            type="button"
            className="form-link"
            onClick={onSwitchToLogin}
            disabled={isLoading}
          >
            Se connecter
          </button>
        </p>
      </div>

      {/* Terms & Privacy */}
      <div className="legal-notice">
        <p>
          En créant un compte, vous acceptez nos{' '}
          <a href="#" className="form-link" onClick={(e) => e.preventDefault()}>
            conditions d'utilisation
          </a>{' '}
          et notre{' '}
          <a href="#" className="form-link" onClick={(e) => e.preventDefault()}>
            politique de confidentialité
          </a>.
        </p>
      </div>

      {/* Security Info */}
      <div className="security-info">
        <p>
          <span className="security-icon" aria-hidden="true">🔒</span>
          Connexion sécurisée SSL - Vos données sont protégées
        </p>
      </div>
    </div>
  );
});

RegisterForm.displayName = 'RegisterForm';

export default RegisterForm;
