import React, { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteMyAccountMutation } from '../../hooks/queries/useProfileMutations';
import { useAuthStore } from '../../store/authStore';
import { useGlobalToast } from '../../toast/ToastProvider';

import './DeleteAccountCard.css';

type Props = {
  isTwoFactorEnabled: boolean;
};

function parseRetryAfterSeconds(err: unknown): number | null {
  const anyErr: any = err;
  const header = anyErr?.headers?.['retry-after'] ?? anyErr?.response?.headers?.['retry-after'];
  if (header == null) return null;
  const n = Number(header);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getErrorMessage(err: unknown): string {
  const anyErr: any = err;

  const status = Number(anyErr?.status ?? anyErr?.response?.status ?? 0);
  const detail = anyErr?.details ?? anyErr?.response?.data ?? anyErr?.data;

  if (status === 429) {
    const retry = parseRetryAfterSeconds(err);
    return retry ? `Trop de tentatives. Réessayez dans ${retry}s.` : 'Trop de tentatives. Réessayez plus tard.';
  }

  if (status === 401) return 'Mot de passe incorrect ou session expirée.';
  if (status === 403) return 'Code 2FA invalide.';

  const msg = detail?.detail?.message || detail?.detail || detail?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;

  if (anyErr?.message) return String(anyErr.message);
  return 'Une erreur est survenue. Veuillez réessayer.';
}

const DeleteAccountCard: React.FC<Props> = memo(({ isTwoFactorEnabled }) => {
  const navigate = useNavigate();
  const toast = useGlobalToast();
  const user = useAuthStore((s) => s.user);

  const mutation = useDeleteMyAccountMutation();

  const [step, setStep] = useState<'idle' | 'confirm' | 'form'>('idle');
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [twoFa, setTwoFa] = useState('');

  const busy = mutation.isPending;

  const confirmPhrase = useMemo(() => {
    const pseudo = user?.pseudo || 'mon-compte';
    return `SUPPRIMER ${pseudo.toUpperCase()}`;
  }, [user?.pseudo]);

  const canProceedConfirm = useMemo(
    () => confirmText.trim().toUpperCase() === confirmPhrase,
    [confirmText, confirmPhrase]
  );

  const canSubmit = useMemo(() => {
    if (password.trim().length < 8) return false;
    if (isTwoFactorEnabled && !/^\d{6}$/.test(twoFa.trim())) return false;
    return true;
  }, [password, twoFa, isTwoFactorEnabled]);

  const resetState = useCallback(() => {
    setStep('idle');
    setConfirmText('');
    setPassword('');
    setTwoFa('');
  }, []);

  const onStart = useCallback(() => {
    setStep('confirm');
  }, []);

  const onConfirmPhrase = useCallback(() => {
    if (!canProceedConfirm) return;
    setStep('form');
  }, [canProceedConfirm]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit || busy) return;

    try {
      const res = await mutation.mutateAsync({
        current_password: password,
        two_fa_code: isTwoFactorEnabled ? twoFa.trim() : undefined,
      });

      toast.showSuccess('Compte supprimé', res.message || 'Votre compte a été supprimé.');
      resetState();
      navigate('/', { replace: true });
    } catch (err) {
      toast.showError('Suppression impossible', getErrorMessage(err));
    }
  }, [busy, canSubmit, isTwoFactorEnabled, mutation, navigate, password, resetState, toast, twoFa]);

  return (
    <div className="deleteAccount">
      <div className="security-option">
        <div className="option-info">
          <h4>Supprimer mon compte</h4>
          <p>
            Supprimer votre compte est <strong>irréversible</strong>
          </p>
        </div>

        <div className="option-action">
          {step === 'idle' ? (
            <button type="button" className="btn btn-outline danger" onClick={onStart}>
              Supprimer mon compte
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={resetState} disabled={busy}>
              Annuler
            </button>
          )}
        </div>
      </div>

      {step === 'confirm' && (
        <div className="deleteAccount__panel">
          <div className="deleteAccount__callout" role="alert">
            Pour continuer, tapez : <code>{confirmPhrase}</code>
          </div>

          <label className="deleteAccount__label">
            Confirmation
            <input
              className="deleteAccount__input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder={confirmPhrase}
              inputMode="text"
              aria-label="Tapez la phrase de confirmation"
            />
          </label>

          <div className="deleteAccount__actions">
            <button type="button" className="btn btn-danger" onClick={onConfirmPhrase} disabled={!canProceedConfirm || busy}>
              Continuer
            </button>
          </div>
        </div>
      )}

      {step === 'form' && (
        <div className="deleteAccount__panel">
          <label className="deleteAccount__label">
            Mot de passe actuel
            <input
              className="deleteAccount__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Votre mot de passe"
              aria-label="Mot de passe actuel"
            />
          </label>

          {isTwoFactorEnabled && (
            <label className="deleteAccount__label">
              Code 2FA
              <input
                className="deleteAccount__input"
                value={twoFa}
                onChange={(e) => setTwoFa(e.target.value.replace(/\s+/g, ''))}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="\d{6}"
                placeholder="000000"
                aria-label="Code 2FA à 6 chiffres"
                maxLength={6}
              />
              <span className="deleteAccount__hint">Saisissez le code à 6 chiffres de votre application d’authentification.</span>
            </label>
          )}

          <div className="deleteAccount__actions">
            <button type="button" className="btn btn-danger" onClick={onSubmit} disabled={!canSubmit || busy}>
              {busy ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

DeleteAccountCard.displayName = 'DeleteAccountCard';

export default DeleteAccountCard;

