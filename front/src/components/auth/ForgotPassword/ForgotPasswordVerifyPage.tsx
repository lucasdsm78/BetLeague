import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import { forgotPasswordRequest, forgotPasswordVerify } from 'services/forgotPasswordService';
import { useJourneySessionStorage } from 'hooks/useJourneySessionStorage';
import TotpCodeInput from './TotpCodeInput';

const STORAGE_KEY = 'bl.forgotPassword.request';
const VERIFY_KEY = 'bl.forgotPassword.verify';
const MIN_CHALLENGE_ID_LENGTH = 10;
const RESEND_COOLDOWN_S = 30;
const JOURNEY_TTL_MS = 15 * 60 * 1000;

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

type ResetTokenJourney = {
  readonly email: string;
  readonly challenge_id: string;
  readonly reset_token: string;
  readonly expiresAt: number;
};

function isValidResetTokenJourney(v: unknown): v is ResetTokenJourney {
  if (!v || typeof v !== 'object') return false;
  const o = v as any;
  if (typeof o.expiresAt !== 'number') return false;
  if (typeof o.email !== 'string') return false;
  if (typeof o.challenge_id !== 'string') return false;
  if (typeof o.reset_token !== 'string') return false;
  return true;
}

type State = {
  code: string;
  loading: boolean;
  resendLoading: boolean;
  resendCooldownUntil?: number;
  error?: string;
  info?: string;
};

function validateCode(code: string): string | undefined {
  const v = code.trim();
  if (v.length !== 6) return 'Le code doit contenir 6 chiffres';
  if (!/^[0-9]{6}$/.test(v)) return 'Code invalide';
  return undefined;
}

export default function ForgotPasswordVerifyPage() {
  const navigate = useNavigate();

  const journey = useJourneySessionStorage<ForgotPasswordRequestJourney>({
    key: STORAGE_KEY,
    isValid: isValidJourney,
  });

  const resetJourney = useJourneySessionStorage<ResetTokenJourney>({
    key: VERIFY_KEY,
    isValid: isValidResetTokenJourney,
  });

  const now = journey.now;
  const email = (journey.data?.email ?? '').trim();
  const challengeId = (journey.data?.challenge_id ?? '').trim();

  const [state, setState] = React.useState<State>({
    code: '',
    loading: false,
    resendLoading: false,
  });

  React.useEffect(() => {
    if (!email || journey.expired) {
      journey.clear();
      navigate('/forgot-password', { replace: true });
      return;
    }
  }, [email, journey.expired, journey, navigate]);

  const resendSecondsRemaining = state.resendCooldownUntil
    ? Math.max(0, Math.ceil((state.resendCooldownUntil - now) / 1000))
    : 0;

  const resendDisabled = state.resendLoading || resendSecondsRemaining > 0;

  const onResend = async () => {
    if (resendDisabled) return;

    setState(prev => ({ ...prev, resendLoading: true, error: undefined, info: undefined }));
    try {
      const res = await forgotPasswordRequest(email);
      const nextChallengeId = (res.challenge_id ?? '').trim();

      const expiresAt = Date.now() + JOURNEY_TTL_MS;
      if (nextChallengeId.length >= MIN_CHALLENGE_ID_LENGTH) {
        journey.write({ email, challenge_id: nextChallengeId, expiresAt });
      } else {
        // on refresh quand même le TTL
        journey.write({ email, expiresAt });
      }

      setState(prev => ({
        ...prev,
        resendLoading: false,
        resendCooldownUntil: Date.now() + RESEND_COOLDOWN_S * 1000,
        info: 'Si le compte existe, tu peux rentrer un nouveau code TOTP.',
      }));
    } catch (err: any) {
      const status = err?.statusCode || err?.status;
      if (status === 429) {
        setState(prev => ({ ...prev, resendLoading: false, error: 'Trop de tentatives. Réessaie dans une minute.' }));
      } else {
        setState(prev => ({
          ...prev,
          resendLoading: false,
          resendCooldownUntil: Date.now() + RESEND_COOLDOWN_S * 1000,
          info: 'Si le compte existe, tu peux rentrer un nouveau code TOTP.',
        }));
      }
    }
  };

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

    setState(prev => ({ ...prev, loading: true, error: undefined, info: undefined }));
    try {
      const res = await forgotPasswordVerify({
        email,
        challenge_id: challengeId,
        code: state.code.trim(),
      });

      // Refresh du TTL journey request pour éviter un back/forward "stale" si l'utilisateur traîne.
      if (journey.data) {
        journey.write({
          ...journey.data,
          expiresAt: Date.now() + JOURNEY_TTL_MS,
        });
      }

      // Stocke le reset_token dans un storage TTLé dédié
      resetJourney.write({
        email,
        challenge_id: challengeId,
        reset_token: res.reset_token,
        expiresAt: Date.now() + res.expires_in_seconds * 1000,
      });

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
        {state.info && <div className={styles.success}>{state.info}</div>}

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
              <button
                className={styles.secondaryBtn}
                type="button"
                onClick={onResend}
                disabled={resendDisabled}
                aria-disabled={resendDisabled}
              >
                {state.resendLoading
                  ? 'Renvoi…'
                  : resendSecondsRemaining > 0
                    ? `Renvoyer (${resendSecondsRemaining}s)`
                    : 'Renvoyer un code'}
              </button>
              <Link className={styles.link} to="/forgot-password">Modifier l’email</Link>
            </div>

            <div className={styles.row}>
              <Link className={styles.link} to="/login">Retour connexion</Link>
              <span />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
