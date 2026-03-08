import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import { forgotPasswordRequest } from 'services/forgotPasswordService';

type State = {
  email: string;
  loading: boolean;
  error?: string;
  success?: string;
};

function validateEmail(email: string): string | undefined {
  const v = email.trim();
  if (!v) return 'Email requis';
  if (v.length > 254) return 'Email trop long';
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)) return 'Email invalide';
  return undefined;
}

const STORAGE_KEY = 'bl.forgotPassword.request';
const MIN_CHALLENGE_ID_LENGTH = 10;

export default function ForgotPasswordRequestPage() {
  const navigate = useNavigate();
  const [state, setState] = React.useState<State>(() => {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { email: parsed.email ?? '', loading: false };
      } catch {
        // ignore
      }
    }
    return { email: '', loading: false };
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(state.email);
    if (err) {
      setState(prev => ({ ...prev, error: err }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: undefined, success: undefined }));
    try {
      const res = await forgotPasswordRequest(state.email.trim());

      const challengeId = (res.challenge_id ?? '').trim();
      if (challengeId.length < MIN_CHALLENGE_ID_LENGTH) {
        setState(prev => ({
          ...prev,
          loading: false,
          success: 'Si le compte existe et que la 2FA est activée, réessaie dans quelques instants.',
          error: undefined,
        }));
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email: state.email.trim() }));
        return;
      }

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email: state.email.trim(), challenge_id: challengeId }));

      setState(prev => ({
        ...prev,
        loading: false,
        success: 'Si le compte existe, tu peux continuer avec ton code 2FA (TOTP).',
      }));

      navigate('/forgot-password/verify');
    } catch (err: any) {
      const status = err?.statusCode || err?.status;
      if (status === 429) {
        setState(prev => ({ ...prev, loading: false, error: 'Trop de tentatives. Réessaie dans une minute.' }));
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          success: 'Si le compte existe et que la 2FA est activée, réessaie dans quelques instants.',
          error: undefined,
        }));
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email: state.email.trim() }));
      }
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.title}>Mot de passe oublié</div>
          <div className={styles.subtitle}>
            Saisis ton email. Si le compte existe et que la 2FA est activée, tu pourras valider avec ton code TOTP.
          </div>
        </header>

        {state.error && (
          <div className={styles.banner} role="alert">
            {state.error}
          </div>
        )}
        {state.success && <div className={styles.success}>{state.success}</div>}

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <div className={styles.inputRow}>
              <input
                id="email"
                className={styles.input}
                inputMode="email"
                autoComplete="email"
                value={state.email}
                onChange={(e) => {
                  const email = e.target.value;
                  setState(prev => ({ ...prev, email, error: undefined }));
                  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email }));
                }}
                placeholder="tonemail@exemple.com"
                aria-invalid={!!state.error}
                required
              />
            </div>
            <div className={styles.help}>On ne confirmera jamais si un compte existe.</div>
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryBtn} type="submit" disabled={state.loading}>
              {state.loading ? 'Envoi…' : 'Continuer'}
            </button>

            <div className={styles.row}>
              <Link className={styles.link} to="/login">Retour connexion</Link>
              <button
                className={styles.secondaryBtn}
                type="button"
                onClick={() => navigate(-1)}
              >
                Retour
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
