import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import { forgotPasswordConfirm } from 'services/forgotPasswordService';
import { useExpiringSessionStorageToken } from 'hooks/useExpiringSessionStorageToken';
import { evaluatePassword } from './passwordStrength';

const VERIFY_KEY = 'bl.forgotPassword.verify';

type CachedVerify = {
  email?: string;
  challenge_id?: string;
  reset_token?: string;
  expires_in_seconds?: number;
  verified_at?: number;
  expiresAt?: number;
};

type State = {
  password: string;
  confirm: string;
  loading: boolean;
  error?: string;
  success?: string;
  showPassword: boolean;
};

function validatePassword(pw: string): string | undefined {
  if (!pw) return 'Nouveau mot de passe requis';
  if (pw.length < 8) return 'Minimum 8 caractères';
  if (pw.length > 256) return 'Mot de passe trop long';

  const strength = evaluatePassword(pw);
  if (!strength.valid) return strength.reasons[0];

  return undefined;
}

export default function ForgotPasswordConfirmPage() {
  const navigate = useNavigate();

  const verify = useExpiringSessionStorageToken<CachedVerify>(VERIFY_KEY);
  const cached = verify.data ?? {};

  const email = (cached.email ?? '').trim();
  const challengeId = (cached.challenge_id ?? '').trim();
  const resetToken = (cached.reset_token ?? '').trim();

  React.useEffect(() => {
    // Migration: si expiresAt absent mais expires_in_seconds présent
    if (verify.data && !verify.data.expiresAt && verify.data.expires_in_seconds && verify.data.verified_at) {
      verify.write({
        ...verify.data,
        expiresAt: verify.data.verified_at + verify.data.expires_in_seconds * 1000,
      });
    }
  }, [verify]);

  React.useEffect(() => {
    if (!email || !challengeId || !resetToken) {
      navigate('/forgot-password', { replace: true });
    }
  }, [email, challengeId, resetToken, navigate]);

  React.useEffect(() => {
    if (verify.expired) {
      verify.clear();
      navigate('/forgot-password/verify', { replace: true });
    }
  }, [verify.expired, verify, navigate]);

  const [state, setState] = React.useState<State>({
    password: '',
    confirm: '',
    loading: false,
    showPassword: false,
  });

  const strength = React.useMemo(() => evaluatePassword(state.password), [state.password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validatePassword(state.password);
    if (err) return setState(prev => ({ ...prev, error: err }));
    if (state.password !== state.confirm) return setState(prev => ({ ...prev, error: 'Les mots de passe ne correspondent pas' }));

    setState(prev => ({ ...prev, loading: true, error: undefined, success: undefined }));
    try {
      await forgotPasswordConfirm({
        email,
        challenge_id: challengeId,
        reset_token: resetToken,
        new_password: state.password,
      });

      // Nettoyage pour éviter la réutilisation côté client
      sessionStorage.removeItem(VERIFY_KEY);

      setState(prev => ({ ...prev, loading: false, success: 'Mot de passe mis à jour. Tu peux te reconnecter.' }));

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 600);
    } catch (err: any) {
      const status = err?.statusCode || err?.status;
      if (status === 429) {
        setState(prev => ({ ...prev, loading: false, error: 'Trop de tentatives. Réessaie dans une minute.' }));
      } else {
        setState(prev => ({ ...prev, loading: false, error: 'Lien/jeton invalide ou expiré. Recommence la procédure.' }));
      }
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.title}>Nouveau mot de passe</div>
          <div className={styles.subtitle}>
            Choisis un mot de passe solide. Tu seras redirigé vers la connexion.
          </div>
        </header>

        {verify.data?.expiresAt && !state.success && (
          <div className={styles.help}>
            Jeton valable encore <strong>{verify.secondsRemaining}s</strong>.
          </div>
        )}

        {state.error && (
          <div className={styles.banner} role="alert">
            {state.error}
          </div>
        )}
        {state.success && <div className={styles.success}>{state.success}</div>}

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Nouveau mot de passe</label>
            <div className={styles.inputRow}>
              <input
                id="password"
                className={styles.input}
                type={state.showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={state.password}
                onChange={(e) => setState(prev => ({ ...prev, password: e.target.value, error: undefined }))}
                placeholder="••••••••"
                required
              />
            </div>

            <div style={{ marginTop: '0.35rem' }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  overflow: 'hidden',
                }}
                aria-hidden
              >
                <div
                  style={{
                    width: `${(strength.level / 5) * 100}%`,
                    height: '100%',
                    background: strength.color,
                    transition: 'width 180ms ease',
                  }}
                />
              </div>
              <div className={styles.help}>
                Force: <strong style={{ color: strength.color }}>{strength.label}</strong>
                {strength.reasons.length > 0 ? ` — ${strength.reasons[0]}` : ''}
              </div>
            </div>

            <div className={styles.help}>Minimum 8 caractères, et au moins 3 catégories.</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">Confirmer</label>
            <input
              id="confirm"
              className={styles.input}
              type={state.showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={state.confirm}
              onChange={(e) => setState(prev => ({ ...prev, confirm: e.target.value, error: undefined }))}
              placeholder="••••••••"
              required
            />
          </div>

          <div className={styles.row}>
            <button
              className={styles.secondaryBtn}
              type="button"
              onClick={() => setState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
            >
              {state.showPassword ? 'Masquer' : 'Afficher'}
            </button>
            <Link className={styles.link} to="/login">Retour connexion</Link>
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryBtn} type="submit" disabled={state.loading}>
              {state.loading ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
