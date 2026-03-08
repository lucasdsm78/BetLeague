import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import { forgotPasswordRequest, forgotPasswordVerify } from 'services/forgotPasswordService';
import TotpCodeInput from './TotpCodeInput';

const STORAGE_KEY = 'bl.forgotPassword.request';
const VERIFY_KEY = 'bl.forgotPassword.verify';
const MIN_CHALLENGE_ID_LENGTH = 10;
const RESEND_COOLDOWN_S = 30;

type Cached = { email?: string; challenge_id?: string };

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
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  const [state, setState] = React.useState<State>({
    code: '',
    loading: false,
    resendLoading: false,
  });

  React.useEffect(() => {
    if (!email) {
      navigate('/forgot-password', { replace: true });
      return;
    }
  }, [email, navigate]);

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

      // Anti-enum: même UX, mais si on a un challenge valide on le remplace.
      if (nextChallengeId.length >= MIN_CHALLENGE_ID_LENGTH) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email, challenge_id: nextChallengeId }));
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
