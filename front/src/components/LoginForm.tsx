/**
 * LoginForm Component - Modern TypeScript React Login Form
 * Optimized for sports betting theme with enhanced UX and mobile-first design
 */

import React, { useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnhancedAuth } from 'hooks/useAuth.enhanced';
import { AuthError } from 'services/authService.enhanced';
import type { User } from 'types';
import { useAuthStore } from 'store/authStore';
import useTotpTimer from 'hooks/useTotpTimer';

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

interface TwoFAState {
  required: boolean;
  code: string;
  verifying: boolean;
  error?: string;
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
  const { login } = useEnhancedAuth({
    autoRefresh: true,
    onAuthChange: (isAuthenticated) => {
      if (isAuthenticated) {
        navigate('/matches', { replace: true });
      }
    }
  });
  const authStore = useAuthStore();
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [twoFA, setTwoFA] = useState<TwoFAState>({ required: false, code: '', verifying: false });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const totp = useTotpTimer(30);

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

    if (twoFA.required) {
      if (!twoFA.code || twoFA.code.trim().length < 6) {
        setTwoFA(prev => ({ ...prev, error: 'Code 2FA invalide (6 chiffres requis)' }));
        return;
      }
      try {
        setTwoFA(prev => ({ ...prev, verifying: true, error: undefined }));
        const user = await login({
          email: formData.email,
          password: formData.password,
          code: twoFA.code.trim(),
        });
        onLogin && onLogin({ user });
        setAttemptCount(0);
      } catch (err: any) {
        const msg = err?.getDisplayMessage?.() || err?.message || 'Code 2FA incorrect';
        setTwoFA(prev => ({ ...prev, error: msg }));
        return;
      } finally {
        setTwoFA(prev => ({ ...prev, verifying: false }));
      }
      return;
    }

    if (attemptCount >= 5) {
      setErrors({ general: 'Trop de tentatives de connexion. Veuillez attendre quelques minutes avant de réessayer.' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await login({ email: formData.email, password: formData.password });
      setAttemptCount(0);
      if (result && onLogin) onLogin({ user: result });
    } catch (error) {
      // Ne pas incrémenter attemptCount si c'est juste le challenge 2FA
      if (error instanceof AuthError && (error as any).code === 'TWO_FACTOR_REQUIRED') {
        // Stocker le challenge (email + password) et rediriger vers la page dédiée
        authStore.setTwoFactorChallenge(formData.email, formData.password);
        navigate('/2fa', { replace: true });
        setTwoFA({ required: true, code: '', verifying: false });
        setErrors({});
        return;
      }
      if (error instanceof AuthError && (error as any).code === 'INVALID_2FA_CODE' && !twoFA.required) {
        authStore.setTwoFactorChallenge(formData.email, formData.password);
        navigate('/2fa', { replace: true });
        setTwoFA({ required: true, code: '', verifying: false, error: undefined });
        setErrors({});
        return;
      }
      setAttemptCount(prev => prev + 1);
      let message = 'Une erreur inattendue s\'est produite. Veuillez réessayer.';
      if (error instanceof AuthError) {
        if (error.isUnauthorized()) message = 'Email ou mot de passe incorrect. Vérifiez vos informations.';
        else if (error.isTooManyRequests()) message = 'Trop de tentatives de connexion. Réessayez dans quelques minutes.';
        else if (error.isNetworkError()) message = 'Problème de connexion. Vérifiez votre connexion internet.';
        else message = error.getDisplayMessage() || message;
      }
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  }, [formData, login, validateForm, attemptCount, onLogin, twoFA]);

  const handleBackClick = useCallback(() => {
    // Reset form state when going back
    setFormData({ email: '', password: '' });
    setTwoFA({ required: false, code: '', verifying: false });
    setErrors({});
    setAttemptCount(0);
    onBack();
  }, [onBack]);

  return (
    <div className="auth-form form-container">
      {/* Étapes visuelles */}
      <div className="steps-indicator" aria-hidden="false">
        {!twoFA.required ? (
          <div className="step-line">
            <span className="step active">1</span>
            <span className="step">2</span>
            <span className="step-label">Étape 1/2 : Identifiants</span>
          </div>
        ) : (
          <div className="step-line">
            <span className="step done">1</span>
            <span className="step active">2</span>
            <span className="step-label">Étape 2/2 : Code 2FA</span>
          </div>
        )}
      </div>
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
          {!twoFA.required ? 'Bon retour sur BetLeague ! Connectez-vous pour accéder à vos ligues.' : 'Saisissez votre code 2FA pour finaliser la connexion.'}
        </p>
      </div>
      {/* Bandeau information challenge 2FA */}
      {twoFA.required && !twoFA.error && (
        <div className="info-banner" role="status" aria-live="polite">
          <div className="info-content">
            <span className="info-icon" aria-hidden="true">🔐</span>
            <span className="info-text">Un deuxième facteur est requis. Ouvrez votre application d’authentification.</span>
          </div>
        </div>
      )}
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

        {/* Étape Identifiants */}
        {!twoFA.required && (
          <>
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
          </>
        )}

        {/* Étape 2FA */}
        {twoFA.required && (
          <div className="form-group">
            <label className="form-label" htmlFor="twofa-code">
              Code d'authentification à 2 facteurs
              <span className="required-asterisk" aria-label="requis">*</span>
            </label>
            <div className={`input-wrapper ${twoFA.error ? 'error' : ''}`}>
              <input
                id="twofa-code"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{6}"
                name="twofa-code"
                className="form-input"
                placeholder="000000"
                value={twoFA.code}
                onChange={(e) => setTwoFA(prev => ({ ...prev, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                autoComplete="one-time-code"
                maxLength={6}
                required
                disabled={twoFA.verifying}
                aria-invalid={twoFA.error ? 'true' : 'false'}
                aria-describedby={twoFA.error ? 'twofa-error' : undefined}
                autoFocus
              />
            </div>
            <div className="totp-progress" aria-hidden="false">
              <div className="totp-bar" style={{ width: `${totp.percent}%` }} />
            </div>
            <div className="helper-text" aria-live="polite">
              {totp.isExpiring ? 'Code bientôt expiré' : 'Code valide'} — {totp.secondsRemaining}s restants
            </div>
            {twoFA.error && (
              <div className="form-error" id="twofa-error" role="alert">
                <span className="error-icon">⚠️</span>
                {twoFA.error}
              </div>
            )}
            <p className="helper-text">Utilisez l’application (Google Authenticator, Authy…) pour récupérer le code.</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="form-actions">
          <FormButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading || twoFA.verifying}
            disabled={isLoading || twoFA.verifying || attemptCount >= 5 || (twoFA.required && twoFA.code.length < 6)}
          >
            {twoFA.required ? (twoFA.verifying ? 'Vérification...' : 'Vérifier le code') : (isLoading ? 'Connexion...' : 'Se connecter')}
          </FormButton>
        </div>
      </form>

      {/* Footer Links */}
      {!twoFA.required && (
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
      )}

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
