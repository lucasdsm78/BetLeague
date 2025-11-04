import React, { useState, useCallback, memo } from 'react';
import './ProfileSection.css';
import { useUserProfile } from 'hooks/useUserProfile';

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
}

const AccountInfo = memo<AccountInfoProps>(({ pseudo, email }) => (
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
      <button className="btn btn-secondary">Modifier les informations</button>
    </div>
  </div>
));

AccountInfo.displayName = 'AccountInfo';

interface SecuritySettingsProps {
  onLogout: () => void;
}

const SecuritySettings = memo<SecuritySettingsProps>(({ onLogout }) => (
  <div className="settings-section">
    <h3>Sécurité</h3>
    <div className="security-options">
      <div className="security-option">
        <div className="option-info">
          <h4>Authentification à deux facteurs</h4>
          <p>Ajoutez une couche de sécurité supplémentaire à votre compte</p>
        </div>
        <div className="option-action">
          <button className="btn btn-primary">Activer 2FA</button>
        </div>
      </div>

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
));

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

  const { profile, loading, error } = useUserProfile();

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
          <AccountInfo pseudo={profile.pseudo} email={profile.email} />
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
