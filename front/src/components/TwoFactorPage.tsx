import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnhancedAuth } from 'hooks/useAuth.enhanced';
import { useAuthStore } from 'store/authStore';
import { AuthError } from 'services/authService.enhanced';
import useTotpTimer from 'hooks/useTotpTimer';
import { useToast } from 'hooks/useToast';
import ToastContainer from 'components/ToastContainer';

const TwoFactorPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useEnhancedAuth({ debugMode: true });
  const { twoFactorChallenge, clearTwoFactorChallenge } = useAuthStore();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const totp = useTotpTimer(30);
  const { showSuccess, toasts, removeToast, pauseToast, resumeToast } = useToast({ maxToasts: 3 });

  // Si pas de challenge présent, revenir au login
  if (!twoFactorChallenge) {
    return (
      <div className="auth-form form-container">
        <div className="form-header">
          <h2>Challenge 2FA expiré</h2>
          <p>Veuillez recommencer la connexion.</p>
        </div>
        <div className="form-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/', { replace: true })}>Accueil</button>
          <button className="btn btn-primary" onClick={() => navigate('/login', { replace: true })}>Recommencer</button>
        </div>
      </div>
    );
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setLocalError('Code 2FA invalide (6 chiffres requis)');
      return;
    }
    try {
      setVerifying(true);
      setLocalError(null);
      await login({
        email: twoFactorChallenge.email,
        password: twoFactorChallenge.password,
        code: code.trim()
      });
      clearTwoFactorChallenge();
      showSuccess('2FA validée', 'Connexion sécurisée. Redirection...');
      setTimeout(() => navigate('/matches', { replace: true }), 1200);
    } catch (err: any) {
      if (err instanceof AuthError && err.code === 'INVALID_2FA_CODE') {
        setLocalError('Code 2FA incorrect');
      } else if (err instanceof AuthError && err.code === 'TWO_FACTOR_REQUIRED') {
        // Le backend continue de dire requis -> peut-être mauvais code formaté
        setLocalError('Code requis ou invalide');
      } else {
        setLocalError(err?.message || 'Erreur de vérification');
      }
    } finally {
      setVerifying(false);
    }
  }, [code, twoFactorChallenge, login, clearTwoFactorChallenge, navigate, showSuccess]);

  return (
    <div className="auth-form form-container">
      {/* Toasts */}
      <ToastContainer toasts={toasts} removeToast={removeToast} pauseToast={pauseToast} resumeToast={resumeToast} />
      <div className="steps-indicator" aria-hidden="false">
        <div className="step-line">
          <span className="step done">1</span>
          <span className="step active">2</span>
          <span className="step-label">Étape 2/2 : Code 2FA</span>
        </div>
      </div>
      <button
        className="back-button"
        type="button"
        aria-label="Annuler et revenir au login"
        onClick={() => { clearTwoFactorChallenge(); navigate('/login'); }}
      />
      <div className="form-header">
        <h2>Vérification 2FA</h2>
        <p>Saisissez votre code d'authentification à 2 facteurs pour finaliser la connexion.</p>
      </div>
      <div className="info-banner" role="status" aria-live="polite">
        <div className="info-content">
          <span className="info-icon" aria-hidden="true">🔐</span>
          <span className="info-text">Compte: {twoFactorChallenge.email}</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="error-banner" role="alert" aria-live="polite">
            <div className="error-content">
              <span className="error-icon" aria-hidden="true">🚨</span>
              <span className="error-text">{error}</span>
            </div>
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="twofa-code">
            Code 2FA
            <span className="required-asterisk" aria-label="requis">*</span>
          </label>
          <div className={`input-wrapper ${error ? 'error' : ''}`}>
            <input
              id="twofa-code"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]{6}"
              name="twofa-code"
              className="form-input"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0,6))}
              autoComplete="one-time-code"
              maxLength={6}
              required
              disabled={verifying}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? 'twofa-error' : undefined}
              autoFocus
            />
          </div>
          <div className="totp-progress" aria-hidden="false">
            <div className="totp-bar" style={{ width: `${totp.percent}%` }} />
          </div>
          <div className="helper-text" aria-live="polite">
            {totp.isExpiring ? 'Code bientôt expiré' : 'Code valide'} — {totp.secondsRemaining}s restants
          </div>
          {error && (
            <div className="form-error" id="twofa-error" role="alert">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
        </div>
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary btn-full-width"
            disabled={verifying || code.length < 6}
          >
            {verifying ? 'Vérification...' : 'Valider'}
          </button>
        </div>
      </form>
      <div className="security-info">
        <p><span className="security-icon" aria-hidden="true">🔒</span> Authentification multi-facteur activée</p>
      </div>
    </div>
  );
};

export default TwoFactorPage;
