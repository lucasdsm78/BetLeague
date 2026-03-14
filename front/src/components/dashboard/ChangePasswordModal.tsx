import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ChangePasswordModal.css';
import { useChangeMyPasswordMutation } from '../../hooks/queries/useProfileMutations';
import { useGlobalToast } from '../../toast/ToastProvider';
import { ApiClientError } from '../../services/secureApiClient';

interface ChangePasswordModalProps {
  isTwoFactorEnabled: boolean;
  onClose: () => void;
}

type FieldErrors = {
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
  two_fa_code?: string;
  general?: string;
};

type ApiDetail = any;

function getDetailFromError(err: unknown): ApiDetail | undefined {
  if (err instanceof ApiClientError) {
    return err.details as any;
  }
  return (err as any)?.details;
}

function parseRetryAfterSeconds(err: unknown): number | null {
  if (err instanceof ApiClientError) {
    const v = err.headers?.['retry-after'];
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function normalizeErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 429) {
      const retry = parseRetryAfterSeconds(err);
      return retry ? `Trop de tentatives. Réessayez dans ${retry}s.` : 'Trop de tentatives. Réessayez plus tard.';
    }

    const detail = getDetailFromError(err);
    const msg = detail?.detail?.message || detail?.detail || detail?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    return err.message || 'Une erreur est survenue. Veuillez réessayer.';
  }

  const anyErr: any = err;
  return anyErr?.message || 'Une erreur est survenue. Veuillez réessayer.';
}

function validatePassword(pw: string): string | undefined {
  const v = pw;
  if (!v) return 'Mot de passe requis';
  if (v.length < 8) return 'Minimum 8 caractères';
  if (v.length > 255) return 'Mot de passe trop long';
  return undefined;
}

function validateTwoFa(code: string): string | undefined {
  const v = code.trim();
  if (!v) return 'Code requis';
  if (!/^\d{6}$/.test(v)) return 'Code à 6 chiffres';
  return undefined;
}

const ChangePasswordModal = memo<ChangePasswordModalProps>(({ isTwoFactorEnabled, onClose }) => {
  const toast = useGlobalToast();
  const mutation = useChangeMyPasswordMutation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFa, setTwoFa] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const busy = mutation.isPending;
  const titleId = 'change-password-title';
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    if (validatePassword(currentPassword)) return false;
    if (validatePassword(newPassword)) return false;
    if (newPassword !== confirmPassword) return false;
    if (currentPassword === newPassword) return false;
    if (isTwoFactorEnabled && validateTwoFa(twoFa)) return false;
    return true;
  }, [confirmPassword, currentPassword, isTwoFactorEnabled, newPassword, twoFa]);

  const closeIfAllowed = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  // ESC + focus management + body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeIfAllowed();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeIfAllowed]);

  useEffect(() => {
    // autofocus
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  const validateAll = useCallback((): FieldErrors => {
    const next: FieldErrors = {};

    const curErr = validatePassword(currentPassword);
    if (curErr) next.current_password = curErr;

    const newErr = validatePassword(newPassword);
    if (newErr) next.new_password = newErr;

    if (!confirmPassword) next.confirm_password = 'Confirmation requise';
    else if (newPassword !== confirmPassword) next.confirm_password = 'Les mots de passe ne correspondent pas';

    if (currentPassword && newPassword && currentPassword === newPassword) {
      next.new_password = 'Le nouveau mot de passe doit être différent';
    }

    if (isTwoFactorEnabled) {
      const twoErr = validateTwoFa(twoFa);
      if (twoErr) next.two_fa_code = twoErr;
    }

    return next;
  }, [confirmPassword, currentPassword, isTwoFactorEnabled, newPassword, twoFa]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const nextErrors = validateAll();
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      setErrors({});

      try {
        const res = await mutation.mutateAsync({
          current_password: currentPassword,
          new_password: newPassword,
          two_fa_code: isTwoFactorEnabled ? twoFa.trim() : undefined,
        });

        toast.showSuccess('Mot de passe mis à jour', res.message || 'Votre mot de passe a été modifié.');
        // Le backend révoque les tokens => l'app peut rediriger vers login via logout global.
        closeIfAllowed();
      } catch (err) {
        const detail = getDetailFromError(err);
        const code = (err instanceof ApiClientError ? err.code : undefined) || detail?.detail?.code || detail?.code;

        const msg = normalizeErrorMessage(err);

        // mapping champs
        if (code === 'INVALID_CREDENTIALS') {
          setErrors({ current_password: 'Mot de passe actuel incorrect', general: msg });
        } else if (code === 'TWO_FACTOR_REQUIRED') {
          setErrors({ two_fa_code: 'Code 2FA requis', general: msg });
        } else if (code === 'INVALID_2FA_CODE') {
          setErrors({ two_fa_code: 'Code 2FA invalide', general: msg });
        } else if (code === 'INVALID_PASSWORD') {
          setErrors({ new_password: 'Mot de passe invalide', general: msg });
        } else {
          setErrors({ general: msg });
        }

        toast.showError('Changement impossible', msg);
      }
    },
    [closeIfAllowed, currentPassword, isTwoFactorEnabled, mutation, newPassword, toast, twoFa, validateAll]
  );

  return (
    <div className="cpModalOverlay" onClick={(e) => e.target === e.currentTarget && closeIfAllowed()}>
      <div className="cpModal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cpHeader">
          <div>
            <h2 id={titleId} className="cpTitle">Changer le mot de passe</h2>
            <p className="cpSubtitle">Sécurise ton compte BetLeague avec un mot de passe solide.</p>
          </div>
          <button className="cpClose" onClick={closeIfAllowed} disabled={busy} aria-label="Fermer">
            ✕
          </button>
        </div>

        {errors.general && (
          <div className="cpBanner" role="alert" aria-live="polite">
            {errors.general}
          </div>
        )}

        <form className="cpBody" onSubmit={onSubmit}>
          <div className="cpField">
            <label className="cpLabel" htmlFor="cp-current">Mot de passe actuel</label>
            <input
              id="cp-current"
              ref={firstInputRef}
              className={`cpInput ${errors.current_password ? 'cpInputError' : ''}`}
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={busy}
              aria-invalid={!!errors.current_password}
            />
            {errors.current_password && <div className="cpError">{errors.current_password}</div>}
          </div>

          <div className="cpField">
            <label className="cpLabel" htmlFor="cp-new">Nouveau mot de passe</label>
            <input
              id="cp-new"
              className={`cpInput ${errors.new_password ? 'cpInputError' : ''}`}
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={busy}
              aria-invalid={!!errors.new_password}
            />
            {errors.new_password && <div className="cpError">{errors.new_password}</div>}
            <div className="cpHint">Minimum 8 caractères. Évite les infos personnelles.</div>
          </div>

          <div className="cpField">
            <label className="cpLabel" htmlFor="cp-confirm">Confirmer</label>
            <input
              id="cp-confirm"
              className={`cpInput ${errors.confirm_password ? 'cpInputError' : ''}`}
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              aria-invalid={!!errors.confirm_password}
            />
            {errors.confirm_password && <div className="cpError">{errors.confirm_password}</div>}
          </div>

          {isTwoFactorEnabled && (
            <div className="cpField">
              <label className="cpLabel" htmlFor="cp-2fa">Code 2FA</label>
              <input
                id="cp-2fa"
                className={`cpInput ${errors.two_fa_code ? 'cpInputError' : ''}`}
                inputMode="numeric"
                pattern="\d{6}"
                autoComplete="one-time-code"
                value={twoFa}
                onChange={(e) => setTwoFa(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy}
                aria-invalid={!!errors.two_fa_code}
                placeholder="000000"
              />
              {errors.two_fa_code && <div className="cpError">{errors.two_fa_code}</div>}
            </div>
          )}

          <div className="cpFooter">
            <button type="button" className="btn btn-secondary" onClick={() => setShowPw((v) => !v)} disabled={busy}>
              {showPw ? 'Masquer' : 'Afficher'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit || busy}>
              {busy ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
          </div>

          <div className="cpFinePrint">
            Après validation, tu seras déconnecté pour des raisons de sécurité.
          </div>
        </form>
      </div>
    </div>
  );
});

ChangePasswordModal.displayName = 'ChangePasswordModal';

export default ChangePasswordModal;

