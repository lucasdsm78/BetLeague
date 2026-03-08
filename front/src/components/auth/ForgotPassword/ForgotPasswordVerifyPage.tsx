import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import { forgotPasswordVerify } from 'services/forgotPasswordService';
import TotpCodeInput from './TotpCodeInput';

const STORAGE_KEY = 'bl.forgotPassword.request';
const VERIFY_KEY = 'bl.forgotPassword.verify';
const MIN_CHALLENGE_ID_LENGTH = 10;

type Cached = { email?: string; challenge_id?: string };

type State = {
  code: string;
  loading: boolean;
  error?: string;
};

function validateCode(code: string): string | undefined {
  const v = code.trim();
  if (v.length !== 6) return 'Le code doit contenir 6 chiffres';
  if (!/^[0-9]{6}$/.test(v)) return 'Code invalide';
  return undefined;
}

export default function ForgotPasswordVerifyPage() {
  const navigate = useNavigate();
  const cached: Cached = React.useMemo(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, []);

  const email = (cached.email ?? '').trim();
  const challengeId = (cached.challenge_id ?? '').trim();

  const [state, setState] = React.useState<State>({ code: '', loading: false });

  React.useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true });
      return;
    }
  }, [email, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (challengeId.length < MIN_CHALLENGE_ID_LENGTH) {
      setState(prev => ({
        ...prev,
        error: 'La demande a expiré ou est incomplète. Recommence la procédure.',
      }));
      return;
    }

    const err = validateCode(state.code);
    if (err) {
      setState(prev => ({ ...prev, error: err }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await forgotPasswordVerify({
        email,
        challenge_id: challengeId,
        code: state.code.trim(),
      });

      sessionStorage.setItem(VERIFY_KEY, JSON.stringify({
        email,
        challenge_id: challengeId,
        reset_token: res.reset_token,
        expires_in_seconds: res.expires_in_seconds,
        verified_at: Date.now(),
      }));

      navigate('/forgot-password/confirm');
    } catch (err: any) {
      const status = err?.statusCode || err?.status;
      if (status === 429) {
        setState(prev => ({ ...prev, loading: false, error: 'Trop de tentatives. Réessaie dans une minute.' }));
      } else {
        setState(prev => ({ ...prev, loading: false, error: 'Code invalide ou expiré.' }));
      }
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.title}>Vérification 2FA</div>
          <div className={styles.subtitle}>
            Ouvre ton application d’authentification et saisis le code TOTP (6 chiffres).
          </div>
        </header>

        {state.error && (
          <div className={styles.banner} role="alert">
            {state.error}
          </div>
        )}

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <TotpCodeInput
              value={state.code}
              onChange={(next) => setState(prev => ({ ...prev, code: next, error: undefined }))}
              disabled={state.loading || challengeId.length < MIN_CHALLENGE_ID_LENGTH}
              autoFocus
              label="Code 2FA (TOTP)"
              error={state.error}
              name="totp"
            />
            <div className={styles.help}>Astuce: colle le code (iOS/Android friendly).</div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primaryBtn}
              type="submit"
              disabled={state.loading || challengeId.length < MIN_CHALLENGE_ID_LENGTH}
            >
              {state.loading ? 'Vérification…' : 'Vérifier'}
            </button>

            <div className={styles.row}>
              <Link className={styles.link} to="/forgot-password">Modifier l’email</Link>
              <Link className={styles.link} to="/login">Retour connexion</Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
