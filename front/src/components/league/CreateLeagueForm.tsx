/**
 * CreateLeagueForm – Modal de création de ligue
 * Mobile-first, sécurisé, performant
 */

import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { useEnhancedAuth } from '../../hooks/useAuth.enhanced';
import { useUserProfile } from '../../hooks/useUserProfile';
import { createLeague } from '../../services/api/leagues';
import type { ApiLeagueCreateRequest, ApiLeagueMessageResponse } from '../../types/api/leagues';
import { validateLeagueName } from '../../utils/leagueValidation';
import InsufficientBTLModal from '../InsufficientBTLModal';
import './CreateLeagueForm.css';

/* ───── Constants ───── */

const LEAGUE_DURATION_DAYS = 7;
const DAY_MS = 86_400_000;

const LIMITS = {
  NAME_MAX: 50,
  MEMBERS_MIN: 2,
  MEMBERS_MAX: 200,
  FEE_MIN: 0,
  FEE_MAX: 10_000,
  DESC_MAX: 500,
} as const;

const FEE_PRESETS = [10, 25, 50, 100] as const;

/* ───── Helpers ───── */

const pad2 = (n: number) => String(n).padStart(2, '0');

const toLocalDatetime = (ms?: number): string => {
  if (!ms || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const parseLocalDatetime = (v: string): number | undefined => {
  const s = (v ?? '').trim();
  if (!s) return undefined;
  const ts = new Date(s).getTime();
  return Number.isFinite(ts) ? ts : undefined;
};

/* ───── SVG Icons ───── */

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconGlobe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
  </svg>
);

const IconUsers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4" /><path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
  </svg>
);

const IconCoin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

const IconTrophy = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

/* ───── Types ───── */

interface FormErrors {
  name?: string;
  type?: string;
  maxMembers?: string;
  minMembers?: string;
  entryFee?: string;
  startDate?: string;
  description?: string;
  general?: string;
}

interface CreateLeagueFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (league: ApiLeagueMessageResponse, message: string) => void;
  className?: string;
}

interface FormData {
  name: string;
  type: 'private' | 'public';
  maxMembers: number;
  minMembers: number | '';
  entryFee: number;
  startDate: string;
  description: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  type: 'private',
  maxMembers: 10,
  minMembers: '',
  entryFee: 0,
  startDate: '',
  description: '',
};

/* ───── Main Component ───── */

const CreateLeagueForm = memo<CreateLeagueFormProps>(({ isOpen, onClose, onSuccess, className = '' }) => {
  const { user } = useEnhancedAuth();
  const { profile } = useUserProfile();
  const btl = profile?.nb_btl ?? user?.btlBalance ?? 0;

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showBTLModal, setShowBTLModal] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  // --- Init dates on open ---
  useEffect(() => {
    if (isOpen && !form.startDate) {
      setForm(prev => ({ ...prev, startDate: toLocalDatetime(Date.now()) }));
    }
  }, [isOpen, form.startDate]);

  // --- Focus first input ---
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // --- Reset on close ---
  useEffect(() => {
    if (!isOpen) {
      setForm(INITIAL_FORM);
      setErrors({});
      setSubmitting(false);
    }
  }, [isOpen]);

  // --- Field change ---
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setErrors(prev => ({ ...prev, [name]: undefined, general: undefined }));

    let processed: string | number = value;
    if (type === 'number') {
      processed = value === '' ? 0 : parseInt(value, 10);
      if (isNaN(processed as number)) processed = 0;
    }
    setForm(prev => ({ ...prev, [name]: processed }));
  }, []);

  // --- Field-level validation on blur ---
  const handleBlur = useCallback((field: keyof FormErrors) => {
    let error: string | undefined;
    switch (field) {
      case 'name': {
        const r = validateLeagueName(form.name);
        if (!r.isValid) error = r.error;
        break;
      }
      case 'maxMembers':
        if (!Number.isInteger(form.maxMembers) || form.maxMembers < LIMITS.MEMBERS_MIN)
          error = `Minimum ${LIMITS.MEMBERS_MIN} participants`;
        else if (form.maxMembers > LIMITS.MEMBERS_MAX)
          error = `Maximum ${LIMITS.MEMBERS_MAX} participants`;
        break;
      case 'minMembers':
        if (!Number.isInteger(form.minMembers) || Number(form.minMembers) < LIMITS.MEMBERS_MIN)
          error = 'Choisissez un minimum de joueurs';
        else if (Number(form.minMembers) > form.maxMembers)
          error = 'Le minimum de joueurs doit être inférieur ou égal au maximum';
        break;
      case 'entryFee':
        if (!Number.isInteger(form.entryFee) || form.entryFee < 0)
          error = 'La mise ne peut pas être négative';
        else if (form.entryFee > LIMITS.FEE_MAX)
          error = `Maximum ${LIMITS.FEE_MAX} BTL`;
        else if (form.entryFee > 0 && form.entryFee > btl)
          error = `Solde insuffisant (${btl} BTL disponibles)`;
        break;
      case 'description':
        if ((form.description?.length ?? 0) > LIMITS.DESC_MAX)
          error = `Maximum ${LIMITS.DESC_MAX} caractères`;
        break;
      case 'startDate':
        if (!parseLocalDatetime(form.startDate))
          error = 'Date de début requise';
        break;
    }
    if (error) setErrors(prev => ({ ...prev, [field]: error }));
  }, [form, btl]);

  // --- Full validation ---
  const validate = useCallback((): boolean => {
    const e: FormErrors = {};
    const nameResult = validateLeagueName(form.name);
    if (!nameResult.isValid) e.name = nameResult.error;
    if (!Number.isInteger(form.maxMembers) || form.maxMembers < LIMITS.MEMBERS_MIN)
      e.maxMembers = `Minimum ${LIMITS.MEMBERS_MIN} participants`;
    else if (form.maxMembers > LIMITS.MEMBERS_MAX)
      e.maxMembers = `Maximum ${LIMITS.MEMBERS_MAX} participants`;
    if (!Number.isInteger(form.minMembers) || Number(form.minMembers) < LIMITS.MEMBERS_MIN)
      e.minMembers = 'Choisissez un minimum de joueurs';
    else if (Number(form.minMembers) > form.maxMembers)
      e.minMembers = 'Le minimum de joueurs doit être inférieur ou égal au maximum';
    if (form.entryFee < 0) e.entryFee = 'La mise ne peut pas être négative';
    else if (form.entryFee > LIMITS.FEE_MAX) e.entryFee = `Maximum ${LIMITS.FEE_MAX} BTL`;
    if ((form.description?.length ?? 0) > LIMITS.DESC_MAX) e.description = `Maximum ${LIMITS.DESC_MAX} caractères`;
    if (!parseLocalDatetime(form.startDate)) e.startDate = 'Date de début requise';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  // --- Submit ---
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (form.entryFee > 0 && form.entryFee > btl) {
      setShowBTLModal(true);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const payload: ApiLeagueCreateRequest = {
        name: form.name.trim(),
        max_players: form.maxMembers,
        min_players: Number(form.minMembers),
        is_private: form.type === 'private',
        is_free: form.entryFee === 0,
        nb_btl: form.entryFee > 0 ? form.entryFee : undefined,
        start_date: parseLocalDatetime(form.startDate),
      };
      const res: ApiLeagueMessageResponse = await createLeague(payload);
      onSuccess(res, res.message || 'Ligue créée avec succès !');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (/btl|insufficient|solde/i.test(msg)) {
        setErrors({ entryFee: `Solde BTL insuffisant. Vous avez ${btl} BTL mais cette ligue nécessite ${form.entryFee} BTL.` });
      } else {
        setErrors({ general: 'Une erreur inattendue s\'est produite. Veuillez réessayer.' });
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, btl, validate, onSuccess, onClose]);

  // --- Keyboard ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !submitting) onClose();
  }, [onClose, submitting]);

  // --- Reset start date ---
  const resetDate = useCallback(() => {
    setForm(prev => ({ ...prev, startDate: toLocalDatetime(Date.now()) }));
    setErrors(prev => ({ ...prev, startDate: undefined }));
  }, []);

  if (!isOpen) return null;

  const estimatedPot = form.entryFee > 0 ? form.maxMembers * form.entryFee : 0;
  const startMs = parseLocalDatetime(form.startDate);
  const endDateValue = startMs ? toLocalDatetime(startMs + LEAGUE_DURATION_DAYS * DAY_MS) : '';
  const canSubmit = !submitting && form.name.trim().length >= 3 && !errors.name && !errors.maxMembers && !errors.minMembers && !errors.entryFee && !errors.description && Number.isInteger(form.minMembers) && Number(form.minMembers) >= LIMITS.MEMBERS_MIN;

  return (
    <div
      className="clf-overlay"
      onClick={() => { if (!submitting) onClose(); }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clf-title"
    >
      <div className={`clf-modal ${className}`} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="clf-header">
          <div className="clf-header-icon">
            <IconShield />
          </div>
          <div>
            <h2 id="clf-title" className="clf-title">Créer une ligue</h2>
            <p className="clf-subtitle">Configurez votre ligue de paris</p>
          </div>
          <button type="button" className="clf-close" onClick={onClose} disabled={submitting} aria-label="Fermer">
            <IconX />
          </button>
        </div>

        {/* ── Error banner ── */}
        {errors.general && (
          <div className="clf-error-banner" role="alert">
            <IconAlert />
            <span>{errors.general}</span>
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="clf-body" noValidate>

          {/* Section: Identité */}
          <fieldset className="clf-section">
            <legend className="clf-section-label">Identité de la ligue</legend>

            <div className="clf-field">
              <label htmlFor="clf-name" className="clf-label">
                Nom de la ligue <span className="clf-req">*</span>
              </label>
              <input
                ref={firstInputRef}
                id="clf-name"
                type="text"
                name="name"
                className={`clf-input ${errors.name ? 'clf-input--error' : ''}`}
                value={form.name}
                onChange={handleChange}
                onBlur={() => handleBlur('name')}
                placeholder="Ex : Ligue Champions 2026"
                maxLength={LIMITS.NAME_MAX}
                required
                disabled={submitting}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'clf-name-err' : undefined}
              />
              {errors.name && <p id="clf-name-err" className="clf-field-error" role="alert">{errors.name}</p>}
            </div>

            {/* Visibility toggle cards */}
            <div className="clf-field">
              <span className="clf-label">Visibilité <span className="clf-req">*</span></span>
              <div className="clf-visibility-cards" role="radiogroup" aria-label="Visibilité de la ligue">
                <button
                  type="button"
                  className={`clf-vis-card ${form.type === 'private' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, type: 'private' }))}
                  role="radio"
                  aria-checked={form.type === 'private'}
                  disabled={submitting}
                >
                  <span className="clf-vis-icon"><IconLock /></span>
                  <span className="clf-vis-text">
                    <strong>Privée</strong>
                    <small>Sur invitation uniquement</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={`clf-vis-card ${form.type === 'public' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, type: 'public' }))}
                  role="radio"
                  aria-checked={form.type === 'public'}
                  disabled={submitting}
                >
                  <span className="clf-vis-icon"><IconGlobe /></span>
                  <span className="clf-vis-text">
                    <strong>Publique</strong>
                    <small>Visible par tous</small>
                  </span>
                </button>
              </div>
            </div>
          </fieldset>

          {/* Section: Configuration */}
          <fieldset className="clf-section">
            <legend className="clf-section-label">
              <IconUsers /> Configuration
            </legend>

            <div className="clf-row">
              <div className="clf-field">
                <label htmlFor="clf-members" className="clf-label">
                  Joueurs maximum <span className="clf-req">*</span>
                </label>
                <input
                  id="clf-members"
                  type="number"
                  name="maxMembers"
                  className={`clf-input ${errors.maxMembers ? 'clf-input--error' : ''}`}
                  value={form.maxMembers}
                  onChange={handleChange}
                  onBlur={() => handleBlur('maxMembers')}
                  min={LIMITS.MEMBERS_MIN}
                  max={LIMITS.MEMBERS_MAX}
                  required
                  disabled={submitting}
                  inputMode="numeric"
                  aria-invalid={!!errors.maxMembers}
                  aria-describedby={errors.maxMembers ? 'clf-members-err' : undefined}
                />
                {errors.maxMembers && <p id="clf-members-err" className="clf-field-error" role="alert">{errors.maxMembers}</p>}
              </div>

              <div className="clf-field">
                <label htmlFor="clf-min-members" className="clf-label">
                  Joueurs minimum <span className="clf-req">*</span>
                </label>
                <input
                  id="clf-min-members"
                  type="number"
                  name="minMembers"
                  className={`clf-input ${errors.minMembers ? 'clf-input--error' : ''}`}
                  value={form.minMembers}
                  onChange={handleChange}
                  onBlur={() => handleBlur('minMembers')}
                  min={LIMITS.MEMBERS_MIN}
                  max={form.maxMembers}
                  required
                  disabled={submitting}
                  inputMode="numeric"
                  placeholder="Choisissez un minimum"
                  aria-invalid={!!errors.minMembers}
                  aria-describedby={errors.minMembers ? 'clf-min-members-err' : undefined}
                />
                {errors.minMembers && <p id="clf-min-members-err" className="clf-field-error" role="alert">{errors.minMembers}</p>}
              </div>

              <div className="clf-field">
                <label htmlFor="clf-desc" className="clf-label">
                  Description
                  <span className="clf-char-count">{(form.description ?? '').length}/{LIMITS.DESC_MAX}</span>
                </label>
                <textarea
                  id="clf-desc"
                  name="description"
                  className={`clf-input clf-textarea ${errors.description ? 'clf-input--error' : ''}`}
                  value={form.description}
                  onChange={handleChange}
                  onBlur={() => handleBlur('description')}
                  placeholder="Règles, infos sur les prix..."
                  maxLength={LIMITS.DESC_MAX}
                  rows={2}
                  disabled={submitting}
                  aria-invalid={!!errors.description}
                />
                {errors.description && <p className="clf-field-error" role="alert">{errors.description}</p>}
              </div>
            </div>
          </fieldset>

          {/* Section: Dates */}
          <fieldset className="clf-section">
            <legend className="clf-section-label">
              <IconCalendar /> Planning
            </legend>

            <div className="clf-row">
              <div className="clf-field">
                <div className="clf-label-row">
                  <label htmlFor="clf-start" className="clf-label">
                    Date de début <span className="clf-req">*</span>
                  </label>
                  <button type="button" className="clf-btn-mini" onClick={resetDate} disabled={submitting}>
                    Aujourd'hui
                  </button>
                </div>
                <input
                  id="clf-start"
                  type="datetime-local"
                  name="startDate"
                  className={`clf-input ${errors.startDate ? 'clf-input--error' : ''}`}
                  value={form.startDate}
                  onChange={handleChange}
                  onBlur={() => handleBlur('startDate')}
                  required
                  disabled={submitting}
                  aria-invalid={!!errors.startDate}
                />
                {errors.startDate && <p className="clf-field-error" role="alert">{errors.startDate}</p>}
                <p className="clf-help">Durée fixe : {LEAGUE_DURATION_DAYS} jours</p>
              </div>

              <div className="clf-field">
                <label htmlFor="clf-end" className="clf-label">
                  Date de fin
                  <span className="clf-auto-badge">Auto</span>
                </label>
                <input
                  id="clf-end"
                  type="datetime-local"
                  className="clf-input clf-input--readonly"
                  value={endDateValue}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                />
                <p className="clf-help">Calculée automatiquement</p>
              </div>
            </div>
          </fieldset>

          {/* Section: Mise d'entrée */}
          <fieldset className="clf-section">
            <legend className="clf-section-label">
              <IconCoin /> Mise d'entrée
            </legend>

            <div className="clf-fee-toggle" role="radiogroup" aria-label="Type de mise">
              <button
                type="button"
                className={`clf-fee-opt ${form.entryFee === 0 ? 'active' : ''}`}
                onClick={() => { setForm(prev => ({ ...prev, entryFee: 0 })); setErrors(prev => ({ ...prev, entryFee: undefined })); }}
                role="radio"
                aria-checked={form.entryFee === 0}
                disabled={submitting}
              >
                Gratuit
              </button>
              <button
                type="button"
                className={`clf-fee-opt ${form.entryFee > 0 ? 'active' : ''}`}
                onClick={() => { if (form.entryFee === 0) setForm(prev => ({ ...prev, entryFee: 10 })); }}
                role="radio"
                aria-checked={form.entryFee > 0}
                disabled={submitting}
              >
                Payant (BTL)
              </button>
            </div>

            {form.entryFee > 0 && (
              <>
                <div className="clf-field">
                  <label htmlFor="clf-fee" className="clf-label">Montant (BTL)</label>
                  <input
                    id="clf-fee"
                    type="number"
                    name="entryFee"
                    className={`clf-input ${errors.entryFee ? 'clf-input--error' : ''}`}
                    value={form.entryFee}
                    onChange={handleChange}
                    onBlur={() => handleBlur('entryFee')}
                    min={1}
                    max={LIMITS.FEE_MAX}
                    step={1}
                    disabled={submitting}
                    inputMode="numeric"
                    aria-invalid={!!errors.entryFee}
                  />
                  {errors.entryFee && <p className="clf-field-error" role="alert">{errors.entryFee}</p>}
                </div>

                <div className="clf-fee-presets" aria-label="Raccourcis mise">
                  {FEE_PRESETS.map(v => (
                    <button
                      key={v}
                      type="button"
                      className={`clf-chip ${form.entryFee === v ? 'active' : ''}`}
                      onClick={() => { setForm(prev => ({ ...prev, entryFee: v })); setErrors(prev => ({ ...prev, entryFee: undefined })); }}
                      disabled={submitting}
                    >
                      {v} BTL
                    </button>
                  ))}
                </div>

                {/* Balance display */}
                <div className="clf-balance">
                  <div className="clf-balance-row">
                    <span className="clf-balance-label">Votre solde</span>
                    <span className="clf-balance-value">{btl.toLocaleString()} BTL</span>
                  </div>
                  <div className={`clf-balance-status ${form.entryFee <= btl ? 'ok' : 'nok'}`}>
                    {form.entryFee <= btl
                      ? <><IconCheck /> Solde suffisant</>
                      : <><IconAlert /> Il manque {(form.entryFee - btl).toLocaleString()} BTL</>}
                  </div>
                </div>
              </>
            )}

            {form.entryFee === 0 && (
              <p className="clf-help">Ligue gratuite — aucune mise requise.</p>
            )}
          </fieldset>

          {/* Preview */}
          {estimatedPot > 0 && (
            <div className="clf-preview">
              <div className="clf-preview-header">
                <IconTrophy />
                <span>Aperçu de la ligue</span>
              </div>
              <div className="clf-preview-grid">
                <div className="clf-preview-item">
                  <span className="clf-preview-label">Cagnotte estimée</span>
                  <span className="clf-preview-val highlight">{estimatedPot.toLocaleString()} BTL</span>
                </div>
                <div className="clf-preview-item">
                  <span className="clf-preview-label">Mise / joueur</span>
                  <span className="clf-preview-val">{form.entryFee} BTL</span>
                </div>
                <div className="clf-preview-item">
                  <span className="clf-preview-label">Joueurs max</span>
                  <span className="clf-preview-val">{form.maxMembers}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="clf-actions">
            <button type="button" className="clf-btn clf-btn--secondary" onClick={onClose} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="clf-btn clf-btn--primary" disabled={!canSubmit}>
              {submitting
                ? <><span className="clf-spinner" /> Création…</>
                : 'Créer la ligue'}
            </button>
          </div>
        </form>
      </div>

      {showBTLModal && (
        <InsufficientBTLModal
          currentBalance={btl}
          requiredAmount={form.entryFee}
          action="créer cette ligue"
          onClose={() => setShowBTLModal(false)}
        />
      )}
    </div>
  );
});

CreateLeagueForm.displayName = 'CreateLeagueForm';

export default CreateLeagueForm;
