/**
 * LoginForm Component - Modern TypeScript React Login Form
 * Optimized for sports betting theme with enhanced UX and mobile-first design
 */

import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AuthError } from '../services/authService';
import type { User } from '../types';

// Types
interface LoginFormProps {
  onBack: () => void;
  onSwitchToRegister: () => void;
  onLogin: (userData: { user?: User; username?: string; pseudo?: string; email?: string }) => void;
}

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

// Input Component optimisé pour le design moderne
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
  showPasswordToggle
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

// Button Component optimisé
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

const LoginForm = memo<LoginFormProps>(({ onBack, onSwitchToRegister, onLogin }) => {
  const navigate = useNavigate();
  const { login } = useAuth({
    redirectOnExpiry: false,
    onAuthChange: () => {}
  });
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  // Validation helpers
  const validateEmail = useCallback((email: string): string | undefined => {
    if (!email.trim()) return 'Email requis';
    if (email.length > 254) return 'Email trop long';
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return 'Veuillez saisir un email valide';
    }
    return undefined;
  }, []);

  const validatePassword = useCallback((password: string): string | undefined => {
    if (!password) return 'Mot de passe requis';
    if (password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères';
    if (password.length > 128) return 'Mot de passe trop long';
    return undefined;
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);

    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateEmail, validatePassword]);

  // Event handlers
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({ ...prev, [name]: value }));

    // Validation en temps réel pour effacer les erreurs
    if (errors[name as keyof FormErrors]) {
      const error = name === 'email'
        ? validateEmail(value)
        : validatePassword(value);

      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  }, [errors, validateEmail, validatePassword]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Rate limiting
    if (attemptCount >= 5) {
      setErrors({
        general: 'Trop de tentatives de connexion. Veuillez attendre quelques minutes avant de réessayer.'
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await login({
        email: formData.email,
        password: formData.password,
        code: "string"
      });
      setAttemptCount(0);

    } catch (error) {
      setAttemptCount(prev => prev + 1);

      let message = 'Une erreur inattendue s\'est produite. Veuillez réessayer.';

      if (error instanceof AuthError) {
        if (error.isUnauthorized()) {
          message = 'Email ou mot de passe incorrect. Vérifiez vos informations.';
        } else if (error.isTooManyRequests()) {
          message = 'Trop de tentatives de connexion. Réessayez dans quelques minutes.';
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
  }, [formData, login, validateForm, attemptCount, onLogin]);

  const handleBackClick = useCallback(() => {
    // Reset form state when going back
    setFormData({ email: '', password: '' });
    setErrors({});
    setAttemptCount(0);
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
      ></button>

      {/* Form Header */}
      <div className="form-header">
        <h2 className="form-title">Connexion</h2>
        <p className="form-subtitle">
          Bon retour sur BetLeague ! Connectez-vous pour accéder à vos ligues.
        </p>
      </div>

      {/* Login Form */}
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
        />

        {/* Password Field */}
        <FormInput
          type="password"
          name="password"
          placeholder="Mot de passe"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="current-password"
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
            disabled={isLoading || attemptCount >= 5}
          >
            {isLoading ? 'Connexion en cours...' : 'Se connecter'}
          </FormButton>
        </div>
      </form>

      {/* Footer Links */}
      <div className="form-footer">
        <p>
          Pas encore de compte ?{' '}
          <button
            type="button"
            className="form-link"
            onClick={onSwitchToRegister}
            disabled={isLoading}
          >
            Créer un compte
          </button>
        </p>
      </div>

      {/* Security Info */}
      <div className="security-info">
        <p>
          <span className="security-icon" aria-hidden="true">🔒</span>
          Connexion sécurisée SSL
        </p>
      </div>
    </div>
  );
});

LoginForm.displayName = 'LoginForm';

export default LoginForm;
