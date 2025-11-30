import React, { useState, useCallback, memo } from 'react';
import './ProfileSection.css';
import { useUserProfile } from 'hooks/useUserProfile';
import twoFactorService from 'services/twoFactorService';
import { useAuthStore } from 'store/authStore';
import EditAccountModal from './EditAccountModal';

type TabType = 'overview' | 'account' | 'security' | 'preferences';

interface ProfileStatsProps {
  nbWin: number;
  nbLose: number;
  nbBtl: number;
}

const ProfileStats = memo<ProfileStatsProps>(({ nbWin, nbLose, nbBtl }) => {
  const totalGames = nbWin + nbLose;
  const winRate = totalGames > 0 ? ((nbWin / totalGames) * 100).toFixed(1) : '0.0';

  return (
    <div className="profile-stats-grid">
      <div className="stat-card balance">
        <div className="stat-label">Solde BTL</div>
        <div className="stat-value">{nbBtl.toFixed(2)}</div>
        <div className="stat-sublabel">BetLeague Coins</div>
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
}

const SecuritySettings = memo<SecuritySettingsProps>(({ onLogout }) => {
  const { user, updateUser } = useAuthStore();
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(!!user?.twoFactorEnabled);
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
        <div className="security-option">
          <div className="option-info">
            <h4>Authentification à deux facteurs</h4>
            <p>Ajoutez une couche de sécurité supplémentaire à votre compte</p>
            {enabled && (
              <p style={{ color: 'var(--success-color)', fontWeight: 600, marginTop: '0.5rem' }}>2FA activée</p>
            )}
          </div>
          <div className="option-action">
            {!enabled ? (
              <button className="btn btn-primary" onClick={startEnable} disabled={enabling}>
                {enabling ? 'Activation...' : 'Activer 2FA'}
              </button>
            ) : (
              <button className="btn btn-secondary" disabled>
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

interface PreferencesProps {
  onLogout?: () => void;
}

const Preferences = memo<PreferencesProps>(() => {
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [defaultStake, setDefaultStake] = useState(10);

  return (
    <div className="settings-section">
      <h3>Préférences</h3>
      <div className="preferences-groups">
        <div className="preference-group">
          <h4>Notifications</h4>
          <div className="preference-option">
            <label className="toggle-label">
              <span>Notifications par email</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={emailNotif}
                  onChange={() => setEmailNotif(!emailNotif)}
                />
                <span className="slider"></span>
              </label>
            </label>
          </div>
          <div className="preference-option">
            <label className="toggle-label">
              <span>Notifications push</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={pushNotif}
                  onChange={() => setPushNotif(!pushNotif)}
                />
                <span className="slider"></span>
              </label>
            </label>
          </div>
        </div>

        <div className="preference-group">
          <h4>Paris</h4>
          <div className="preference-option">
            <label>
              <span>Mise par défaut (€)</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={defaultStake}
                onChange={(e) => setDefaultStake(parseInt(e.target.value) || 1)}
                className="number-input"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});

Preferences.displayName = 'Preferences';

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

  const { profile, loading, error, refetch } = useUserProfile();

  const handleEditProfile = useCallback(() => {
    setActiveTab('account');
  }, []);

  const handleLogout = useCallback(() => {
    if (onLogout) {
      onLogout();
    }
  }, [onLogout]);

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
        <button
          className={`tab-button ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          Préférences
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
                <span className="info-value" style={{ color: 'var(--primary-color)', fontWeight: '700' }}>
                  {profile.nb_btl.toFixed(2)} BTL
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <AccountInfo pseudo={profile.pseudo} email={profile.email} onRefresh={refetch} />
        )}

        {activeTab === 'security' && (
          <SecuritySettings onLogout={handleLogout} />
        )}

        {activeTab === 'preferences' && (
          <Preferences />
        )}
      </div>
    </div>
  );
});

ProfileSection.displayName = 'ProfileSection';

export default ProfileSection;
