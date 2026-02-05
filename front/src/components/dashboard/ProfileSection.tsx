import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ProfileSection.css';
import { useProfileMeQuery } from '../../hooks/queries/useProfileQuery';
import { useEnableTwoFactorMutation, useVerifyTwoFactorMutation } from '../../hooks/queries/useProfileMutations';
import { useAuthStore } from 'store/authStore';
import EditAccountModal from './EditAccountModal';
import BTLPurchaseModal from './BTLPurchaseModal';
import { useGlobalToast } from '../../toast/ToastProvider';
import type { TwoFactorSetup } from '../../types/entities/twoFactor';
import PushNotificationToggle from '../notifications/PushNotificationToggle';

type TabType = 'overview' | 'account' | 'security' | 'preferences';

interface ProfileStatsProps {
  nbWin: number;
  nbLose: number;
  nbBtl: number;
}

interface ProfileStatsPropsExtended extends ProfileStatsProps {
  onBuyBTL: () => void;
}

const ProfileStats = memo<ProfileStatsPropsExtended>(({ nbWin, nbLose, nbBtl, onBuyBTL }) => {
  const totalGames = nbWin + nbLose;
  const winRate = totalGames > 0 ? ((nbWin / totalGames) * 100).toFixed(1) : '0.0';

  return (
    <div className="profile-stats-grid">
      <div className="stat-card balance">
        <div className="stat-label">Solde BTL</div>
        <div className="stat-value">{nbBtl.toFixed(2)}</div>
        <div className="stat-sublabel">BetLeague Coins</div>
        <button
          className="btn btn-sm btn-primary buy-btl-btn"
          onClick={onBuyBTL}
          aria-label="Acheter des BTL"
        >
          + Acheter BTL
        </button>
      </div>

      <div className="stat-card wins">
        <div className="stat-label">Victoires</div>
        <div className="stat-value">{nbWin}</div>
        <div className="stat-sublabel">Tickets gagnés</div>
      </div>

      <div className="stat-card losses">
        <div className="stat-label">Défaites</div>
        <div className="stat-value">{nbLose}</div>
        <div className="stat-sublabel">Tickets perdus</div>
      </div>

      <div className="stat-card ratio">
        <div className="stat-label">Taux de réussite</div>
        <div className="stat-value">{winRate}%</div>
        <div className="stat-sublabel">{totalGames} tickets</div>
      </div>
    </div>
  );
});

ProfileStats.displayName = 'ProfileStats';

interface ProfileHeaderProps {
  pseudo: string;
  email: string;
  onEditProfile: () => void;
}

const ProfileHeader = memo<ProfileHeaderProps>(({ pseudo, email, onEditProfile }) => (
  <div className="profile-header">
    <div className="profile-header-content">
      <div className="profile-avatar-section">
        <div className="profile-avatar">
          <span className="avatar-placeholder">
            {pseudo.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      <div className="profile-info">
        <div className="profile-name">
          <h2>{pseudo}</h2>
        </div>
        <p className="profile-email">{email}</p>
      </div>

      <button className="btn btn-primary" onClick={onEditProfile}>
        Modifier le profil
      </button>
    </div>
  </div>
));

ProfileHeader.displayName = 'ProfileHeader';

interface AccountInfoProps {
  pseudo: string;
  email: string;
  onRefresh: () => void;
}

const AccountInfo = memo<AccountInfoProps>(({ pseudo, email, onRefresh }) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsEditModalOpen(false);
  }, []);

  const handleSuccess = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <div className="settings-section">
      <h3>Informations du compte</h3>
      <div className="account-info">
        <div className="info-row">
          <span className="info-label">Pseudo</span>
          <span className="info-value">{pseudo}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Email</span>
          <span className="info-value">{email}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Identifiant</span>
          <span className="info-value">#{pseudo}</span>
        </div>
        <button className="btn btn-secondary" onClick={handleOpenModal}>
          Modifier les informations
        </button>
      </div>

      {isEditModalOpen && (
        <EditAccountModal
          pseudo={pseudo}
          email={email}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
});

AccountInfo.displayName = 'AccountInfo';

interface SecuritySettingsProps {
  onLogout: () => void;
  isTwoFactorEnabled?: boolean;
}

const SecuritySettings = memo<SecuritySettingsProps>(({ onLogout, isTwoFactorEnabled }) => {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const enable2faMutation = useEnableTwoFactorMutation();
  const verify2faMutation = useVerifyTwoFactorMutation();
  const toast = useGlobalToast();

  const [enabled, setEnabled] = useState<boolean>(isTwoFactorEnabled || !!user?.twoFactorEnabled);
  const [setupVisible, setSetupVisible] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const startEnable = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setShowSecret(false);
    try {
      const data = await enable2faMutation.mutateAsync();
      setSetupData(data);
      setSetupVisible(true);
      toast.showSuccess('2FA', 'Scannez le QR code puis saisissez le code à 6 chiffres.');
    } catch (e: any) {
      const msg = e?.message || "Impossible d'activer la 2FA pour le moment";
      setError(msg);
      toast.showError('2FA', msg);
    }
  }, [enable2faMutation, toast]);

  const verify = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const clean = (code || '').trim();
    if (!/^\d{6}$/.test(clean)) {
      const msg = 'Entrez un code valide à 6 chiffres';
      setError(msg);
      toast.showWarning('2FA', msg);
      return;
    }

    try {
      const res = await verify2faMutation.mutateAsync({ code: clean });
      if (res.enabled) {
        setEnabled(true);
        updateUser({ twoFactorEnabled: true });
        const msg = res.message || 'Authentification à deux facteurs activée avec succès';
        setSuccess(msg);
        toast.showSuccess('2FA activée', msg);
        setSetupVisible(false);
        setCode('');
        setShowSecret(false);
      } else {
        const msg = 'Vérification échouée';
        setError(msg);
        toast.showError('2FA', msg);
      }
    } catch (e: any) {
      const msg = e?.message || 'Code incorrect';
      setError(msg);
      toast.showError('2FA', msg);
    }
  }, [code, updateUser, verify2faMutation, toast]);

  const handleCopySecret = useCallback(async () => {
    const secret = setupData?.secret;
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(secret);
      toast.showSuccess('Clé copiée', 'La clé secrète a été copiée dans le presse-papier.');
    } catch {
      // Fallback legacy
      try {
        const el = document.createElement('textarea');
        el.value = secret;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.showSuccess('Clé copiée', 'La clé secrète a été copiée dans le presse-papier.');
      } catch {
        toast.showError('Copie impossible', 'Votre navigateur a bloqué la copie automatique.');
      }
    }
  }, [setupData?.secret, toast]);

  const enabling = enable2faMutation.isPending;
  const verifying = verify2faMutation.isPending;
  const isBusy = enabling || verifying;

  return (
    <div className="settings-section">
      <h3>Sécurité</h3>
      <div className="security-options">
        <div className={`security-option ${enabled ? 'security-option-active' : ''}`}>
          <div className="option-info">
            <div className="option-header">
              <h4>Authentification à deux facteurs</h4>
              {enabled && (
                <div className="status-badge status-active">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Activée</span>
                </div>
              )}
            </div>
            <p>
              {enabled
                ? 'Votre compte est protégé par l\'authentification à deux facteurs'
                : 'Ajoutez une couche de sécurité supplémentaire à votre compte'
              }
            </p>
          </div>
          <div className="option-action">
            {!enabled ? (
              <button className="btn btn-primary" onClick={startEnable} disabled={isBusy}>
                {enabling ? 'Activation...' : 'Activer 2FA'}
              </button>
            ) : (
              <button className="btn btn-success" disabled style={{ cursor: 'not-allowed', opacity: 0.7 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Activée
              </button>
            )}
          </div>
        </div>

        {setupVisible && (
          <div className="twofa-setup">
            <div className="twofa-setup-header">Configuration 2FA</div>

            {/* Fallback accessibilité uniquement (les toasts gèrent l’affichage) */}
            <div className="sr-only" role="alert" aria-live="polite">
              {error || success || ''}
            </div>

            <div className="twofa-setup-body">
              {setupData?.qrCodeDataUrl ? (
                <img src={setupData.qrCodeDataUrl} alt="QR Code 2FA" className="twofa-qr" />
              ) : setupData?.otpauthUrl ? (
                <a href={setupData.otpauthUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ marginBottom: '0.75rem' }}>
                  Ouvrir dans l'application d'authentification
                </a>
              ) : null}

              {setupData?.secret && (
                <div className="twofa-secret">
                  <div className="secret-label">Clé secrète</div>

                  <div className="secret-row">
                    <div
                      className={`secret-value ${showSecret ? 'is-visible' : 'is-hidden'}`}
                      aria-label={showSecret ? 'Clé secrète' : 'Clé secrète masquée'}
                    >
                      {showSecret ? setupData.secret : (setupData.secretMasked || '••••••••')}
                    </div>

                    <div className="secret-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setShowSecret((v) => !v)}
                        disabled={isBusy}
                        aria-pressed={showSecret}
                      >
                        {showSecret ? 'Masquer' : 'Afficher'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={handleCopySecret}
                        disabled={isBusy}
                      >
                        Copier
                      </button>
                    </div>
                  </div>

                  <div className="secret-hint">
                    Gardez cette clé privée. Évitez les captures d’écran.
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" htmlFor="twofa-verify">Saisissez le code à 6 chiffres</label>
                <input
                  id="twofa-verify"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  className="form-input"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  disabled={verifying}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'twofa-verify-error' : undefined}
                />
                {error && (
                  <div className="sr-only" id="twofa-verify-error" role="alert">
                    {error}
                  </div>
                )}
              </div>

              <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="btn btn-primary" onClick={verify} disabled={isBusy || !code || code.length < 6}>
                  {verifying ? 'Vérification...' : 'Vérifier et activer'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setSetupVisible(false); setError(null); setSuccess(null); setCode(''); setShowSecret(false); }}
                  disabled={isBusy}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="security-option">
          <div className="option-info">
            <h4>Mot de passe</h4>
            <p>Modifiez votre mot de passe régulièrement pour plus de sécurité</p>
          </div>
          <div className="option-action">
            <button className="btn btn-secondary">Changer le mot de passe</button>
          </div>
        </div>

        <div className="security-option">
          <div className="option-info">
            <h4>Déconnexion</h4>
            <p>Se déconnecter de tous les appareils</p>
          </div>
          <div className="option-action">
            <button className="btn btn-outline danger" onClick={onLogout}>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

SecuritySettings.displayName = 'SecuritySettings';

const LoadingSkeleton: React.FC = () => (
  <div className="profile-skeleton">
    <div className="skeleton skeleton-header" />
    <div className="skeleton skeleton-stats" />
    <div className="skeleton skeleton-section" />
  </div>
);

interface ProfileSectionProps {
  onLogout?: () => void;
}

const ProfileSection = memo<ProfileSectionProps>(({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isBTLPurchaseModalOpen, setIsBTLPurchaseModalOpen] = useState(false);
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const paymentStatus = useMemo(() => searchParams.get('payment'), [searchParams]);
  const subscriptionStatus = useMemo(() => searchParams.get('subscription'), [searchParams]);

  const { data: profile, isLoading: loading, isError: error, refetch } = useProfileMeQuery();

  // Detect payment success/cancelled from URL params
  useEffect(() => {
    if (!paymentStatus && !subscriptionStatus) return;

    if (paymentStatus === 'success') {
      setShowPaymentSuccessModal(true);
      // Refresh profile to get updated BTL balance
      refetch();
      // Clean URL by removing the payment parameter (clone to avoid mutating the same instance)
      const next = new URLSearchParams(searchParams);
      next.delete('payment');
      setSearchParams(next, { replace: true });
      return;
    }

    if (paymentStatus === 'cancelled') {
      const next = new URLSearchParams(searchParams);
      next.delete('payment');
      setSearchParams(next, { replace: true });
      return;
    }

    // Handle subscription success/cancelled
    if (subscriptionStatus === 'success') {
      refetch();
      navigate('/shop?subscription=success', { replace: true });
      return;
    }

    if (subscriptionStatus === 'cancelled') {
      navigate('/shop', { replace: true });
    }
  }, [paymentStatus, subscriptionStatus, searchParams, setSearchParams, refetch, navigate]);

  const handleEditProfile = useCallback(() => {
    setActiveTab('account');
  }, []);

  const handleLogout = useCallback(() => {
    if (onLogout) {
      onLogout();
    }
  }, [onLogout]);

  const handleOpenBTLPurchase = useCallback(() => {
    setIsBTLPurchaseModalOpen(true);
  }, []);

  const handleCloseBTLPurchase = useCallback(() => {
    setIsBTLPurchaseModalOpen(false);
  }, []);

  const handlePurchaseComplete = useCallback(() => {
    setIsBTLPurchaseModalOpen(false);
    refetch();
  }, [refetch]);

  if (loading && !profile) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="profile-section">
        <div className="settings-section">
          <h3>Erreur</h3>
          <p style={{ color: 'var(--danger-color)', textAlign: 'center', padding: '2rem' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-section">
        <div className="settings-section">
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            Profil non disponible
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-section">
      <ProfileHeader
        pseudo={profile.pseudo}
        email={profile.email}
        onEditProfile={handleEditProfile}
      />

      {activeTab === 'overview' && (
        <ProfileStats
          nbWin={profile.nb_win}
          nbLose={profile.nb_lose}
          nbBtl={profile.nb_btl}
          onBuyBTL={handleOpenBTLPurchase}
        />
      )}

      <div className="profile-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Vue d'ensemble
        </button>
        <button
          className={`tab-button ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          Compte
        </button>
        <button
          className={`tab-button ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          Préférences
        </button>
        <button
          className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Sécurité
        </button>

      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="settings-section">
            <h3>Statistiques de paris</h3>
            <div className="account-info">
              <div className="info-row">
                <span className="info-label">Total de tickets</span>
                <span className="info-value">{profile.nb_win + profile.nb_lose}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Tickets gagnés</span>
                <span className="info-value" style={{ color: 'var(--success-color)' }}>
                  {profile.nb_win}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Tickets perdus</span>
                <span className="info-value" style={{ color: 'var(--danger-color)' }}>
                  {profile.nb_lose}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Solde BTL</span>
                <div className="info-value-with-action">
                  <span className="info-value" style={{ color: 'var(--primary-color)', fontWeight: '700' }}>
                    {profile.nb_btl.toFixed(2)} BTL
                  </span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleOpenBTLPurchase}
                    style={{ marginLeft: '0.75rem' }}
                  >
                    Acheter BTL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <AccountInfo pseudo={profile.pseudo} email={profile.email} onRefresh={refetch} />
        )}

        {activeTab === 'preferences' && (
          <div className="settings-section">
            <h3>Préférences</h3>
            <div className="account-info">
              <div className="info-row" style={{ alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="info-label">Notifications</div>
                  <div className="info-value" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                    Reçois des alertes pour les invitations, résultats et activité importante de tes ligues.
                  </div>
                </div>

                <PushNotificationToggle variant="profile" compact />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <SecuritySettings onLogout={handleLogout} isTwoFactorEnabled={profile.is_two_factor_enabled} />
        )}
      </div>

      {isBTLPurchaseModalOpen && (
        <BTLPurchaseModal
          onClose={handleCloseBTLPurchase}
          onPurchaseComplete={handlePurchaseComplete}
        />
      )}

      {showPaymentSuccessModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentSuccessModal(false)}>
          <div className="modal-content payment-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="success-icon-large">✓</div>
              <h2>Paiement réussi !</h2>
              <button
                className="modal-close"
                onClick={() => setShowPaymentSuccessModal(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="success-message">
                Votre paiement a bien été pris en compte. Vos BTL ont été crédités sur votre compte.
              </p>
              <div className="payment-success-info">
                <div className="info-badge">
                  <span className="badge-label">Nouveau solde</span>
                  <span className="badge-value">{profile?.nb_btl.toFixed(2)} BTL</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => setShowPaymentSuccessModal(false)}
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ProfileSection.displayName = 'ProfileSection';

export default ProfileSection;
