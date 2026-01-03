import React, { useState, useCallback, memo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ProfileSection.css';
import { useUserProfile } from 'hooks/useUserProfile';
import twoFactorService from 'services/twoFactorService';
import { useAuthStore } from 'store/authStore';
import EditAccountModal from './EditAccountModal';
import BTLPurchaseModal from './BTLPurchaseModal';

type TabType = 'overview' | 'account' | 'security';

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
  const { user, updateUser } = useAuthStore();
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(isTwoFactorEnabled || !!user?.twoFactorEnabled);
  const [setupVisible, setSetupVisible] = useState(false);
  const [setupData, setSetupData] = useState<{ qr_code?: string; secret?: string; otpauth_url?: string } | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startEnable = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setEnabling(true);
    try {
      const data = await twoFactorService.enableTwoFactor();
      setSetupData({ qr_code: data.qr_code, secret: data.secret, otpauth_url: data.otpauth_url });
      setSetupVisible(true);
    } catch (e: any) {
      setError(e?.message || "Impossible d'activer la 2FA pour le moment");
    } finally {
      setEnabling(false);
    }
  }, []);

  const verify = useCallback(async () => {
    setError(null);
    setSuccess(null);
    if (!code || code.trim().length < 4) {
      setError('Entrez un code valide');
      return;
    }
    setVerifying(true);
    try {
      const res = await twoFactorService.verifyTwoFactor(code.trim());
      if (res.enabled) {
        setEnabled(true);
        updateUser({ twoFactorEnabled: true });
        setSuccess('Authentification à deux facteurs activée avec succès');
        setSetupVisible(false);
        setCode('');
      } else {
        setError('Vérification échouée');
      }
    } catch (e: any) {
      setError(e?.message || 'Code incorrect');
    } finally {
      setVerifying(false);
    }
  }, [code, updateUser]);

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
              <button className="btn btn-primary" onClick={startEnable} disabled={enabling}>
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
            {error && (
              <div className="error-banner" role="alert" aria-live="polite" style={{ marginBottom: '0.75rem' }}>
                <div className="error-content">
                  <span className="error-icon" aria-hidden="true">🚨</span>
                  <span className="error-text">{error}</span>
                </div>
              </div>
            )}
            {success && (
              <div className="success-banner" role="status" aria-live="polite" style={{ marginBottom: '0.75rem' }}>
                <div className="success-content">
                  <span className="success-icon" aria-hidden="true">✅</span>
                  <span className="success-text">{success}</span>
                </div>
              </div>
            )}
            <div className="twofa-setup-body">
              {setupData?.qr_code ? (
                <img src={setupData.qr_code} alt="QR Code 2FA" className="twofa-qr" />
              ) : setupData?.otpauth_url ? (
                <a href={setupData.otpauth_url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ marginBottom: '0.75rem' }}>
                  Ouvrir dans l'application d'authentification
                </a>
              ) : null}

              {setupData?.secret && (
                <div className="twofa-secret">
                  <div className="secret-label">Clé secrète</div>
                  <div className="secret-value" style={{ userSelect: 'all' }}>{setupData.secret}</div>
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
                />
              </div>

              <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="btn btn-primary" onClick={verify} disabled={verifying || !code || code.length < 6}>
                  {verifying ? 'Vérification...' : 'Vérifier et activer'}
                </button>
                <button className="btn btn-secondary" onClick={() => { setSetupVisible(false); setError(null); setSuccess(null); setCode(''); }} disabled={verifying}>
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

  const { profile, loading, error, refetch } = useUserProfile();

  // Detect payment success/cancelled from URL params
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const subscriptionStatus = searchParams.get('subscription');

    if (paymentStatus === 'success') {
      setShowPaymentSuccessModal(true);
      // Refresh profile to get updated BTL balance
      refetch();
      // Clean URL by removing the payment parameter
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    } else if (paymentStatus === 'cancelled') {
      // Clean URL
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }

    // Handle subscription success/cancelled
    if (subscriptionStatus === 'success') {
      // Refresh profile to get updated subscription status
      refetch();
      // Redirect to shop to show success modal
      navigate('/shop?subscription=success', { replace: true });
    } else if (subscriptionStatus === 'cancelled') {
      // Redirect to shop
      navigate('/shop', { replace: true });
    }
  }, [searchParams, setSearchParams, refetch, navigate]);

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
