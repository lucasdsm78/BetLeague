import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import { forgotPasswordRequest } from 'services/forgotPasswordService';
import { useJourneySessionStorage } from 'hooks/useJourneySessionStorage';
import {
  BACKEND_DEFAULT_CHALLENGE_TTL_SECONDS,
  FORGOT_PASSWORD_REQUEST_STORAGE_KEY,
  MIN_FORGOT_PASSWORD_CHALLENGE_ID_LENGTH,
  ttlSecondsToExpiresAt,
} from './forgotPasswordJourney';

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

const STORAGE_KEY = FORGOT_PASSWORD_REQUEST_STORAGE_KEY;
const MIN_CHALLENGE_ID_LENGTH = MIN_FORGOT_PASSWORD_CHALLENGE_ID_LENGTH;

type ForgotPasswordRequestJourney = {
  readonly email: string;
  readonly challenge_id?: string;
  readonly expiresAt: number;
};

function isValidJourney(v: unknown): v is ForgotPasswordRequestJourney {
  if (!v || typeof v !== 'object') return false;
  const o = v as any;
  if (typeof o.expiresAt !== 'number') return false;
  if (typeof o.email !== 'string') return false;
  if (o.challenge_id !== undefined && typeof o.challenge_id !== 'string') return false;
  return true;
}

export default function ForgotPasswordRequestPage() {
  const navigate = useNavigate();
  const journey = useJourneySessionStorage<ForgotPasswordRequestJourney>({
    key: STORAGE_KEY,
    isValid: isValidJourney,
  });

  const [state, setState] = React.useState<State>(() => {
    const cachedEmail = journey.data?.email ?? '';
    return { email: cachedEmail, loading: false };
  });

  React.useEffect(() => {
    // Si le journey est expiré, on réinitialise le champ email côté UI.
    if (journey.expired) {
      setState(prev => ({ ...prev, email: '' }));
    }
  }, [journey.expired]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(state.email);
    if (err) {
      setState(prev => ({ ...prev, error: err }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: undefined, success: undefined }));
    try {
      const email = state.email.trim();
      const res = await forgotPasswordRequest(email);

      const challengeId = (res.challenge_id ?? '').trim();
      const expiresAt = ttlSecondsToExpiresAt(res.expires_in_seconds);

      if (challengeId.length < MIN_CHALLENGE_ID_LENGTH) {
        setState(prev => ({
          ...prev,
          loading: false,
          success: 'Si le compte existe et que la 2FA est activée, réessaie dans quelques instants.',
          error: undefined,
        }));
        journey.write({ email, expiresAt });
        return;
      }

      journey.write({ email, challenge_id: challengeId, expiresAt });

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
        const email = state.email.trim();
        setState(prev => ({
          ...prev,
          loading: false,
          success: 'Si le compte existe et que la 2FA est activée, réessaie dans quelques instants.',
          error: undefined,
        }));
        if (email) {
          journey.write({
            email,
            expiresAt: ttlSecondsToExpiresAt(BACKEND_DEFAULT_CHALLENGE_TTL_SECONDS),
          });
        } else {
          journey.clear();
        }
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
                }}
                onBlur={(e) => {
                  const email = e.target.value.trim();
                  if (!email) {
                    journey.clear();
                    return;
                  }
                  journey.write({
                    email,
                    expiresAt: ttlSecondsToExpiresAt(BACKEND_DEFAULT_CHALLENGE_TTL_SECONDS),
                  });
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
