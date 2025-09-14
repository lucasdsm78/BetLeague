import React, { useState, useCallback, memo, FormEvent, ChangeEvent } from 'react';
import './ProfileSection.css';

// Types
interface User {
    id: string;
    email: string;
    pseudo?: string;
    username?: string;
}

interface NotificationPreferences {
    email: boolean;
    push: boolean;
    sms: boolean;
}

interface PrivacyPreferences {
    profilePublic: boolean;
    statsPublic: boolean;
    leaguesPublic: boolean;
}

interface BettingPreferences {
    defaultStake: number;
    maxStake: number;
    autoAcceptOddsChanges: boolean;
}

interface Preferences {
    notifications: NotificationPreferences;
    privacy: PrivacyPreferences;
    betting: BettingPreferences;
}

interface Profile {
    pseudo: string;
    email: string;
    phone?: string;
    joinDate: string;
    avatar?: string | null;
    isVerified: boolean;
    twoFactorEnabled: boolean;
    preferences: Preferences;
}

interface AccountFormData {
    pseudo: string;
    email: string;
    phone: string;
}

const MOCK_PROFILE: Profile = {
    pseudo: 'SportsBetter2024',
    email: 'user@example.com',
    phone: '+33 6 12 34 56 78',
    joinDate: '2024-01-01',
    avatar: null,
    isVerified: true,
    twoFactorEnabled: false,
    preferences: {
        notifications: {
            email: true,
            push: true,
            sms: false
        },
        privacy: {
            profilePublic: true,
            statsPublic: false,
            leaguesPublic: true
        },
        betting: {
            defaultStake: 10,
            maxStake: 100,
            autoAcceptOddsChanges: false
        }
    }
};

interface ProfileHeaderProps {
    profile: Profile;
    onEditProfile: () => void;
    onChangeAvatar: () => void;
}

const ProfileHeader = memo<ProfileHeaderProps>(({ profile, onEditProfile, onChangeAvatar }) => (
    <div className="profile-header">
        <div className="profile-avatar-section">
            <div className="profile-avatar">
                {profile.avatar ? (
                    <img src={profile.avatar} alt="Profile" />
                ) : (
                    <span className="avatar-placeholder">
                        {profile.pseudo.charAt(0).toUpperCase()}
                    </span>
                )}
                <button className="change-avatar-btn" onClick={onChangeAvatar}>
                    📷
                </button>
            </div>
        </div>

        <div className="profile-info">
            <div className="profile-name">
                <h2>{profile.pseudo}</h2>
                {profile.isVerified && (
                    <span className="verified-badge" title="Compte vérifié">✓</span>
                )}
            </div>
            <p className="profile-email">{profile.email}</p>
            <p className="join-date">
                Membre depuis {new Date(profile.joinDate).toLocaleDateString('fr-FR', {
                    month: 'long',
                    year: 'numeric'
                })}
            </p>
        </div>

        <button className="btn btn-primary" onClick={onEditProfile}>
            Modifier le profil
        </button>
    </div>
));

ProfileHeader.displayName = 'ProfileHeader';

interface AccountSettingsProps {
    profile: Profile;
    onUpdateProfile: (data: Partial<Profile>) => void;
}

const AccountSettings = memo<AccountSettingsProps>(({ profile, onUpdateProfile }) => {
    const [formData, setFormData] = useState<AccountFormData>({
        pseudo: profile.pseudo,
        email: profile.email,
        phone: profile.phone || ''
    });

    const [isEditing, setIsEditing] = useState<boolean>(false);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onUpdateProfile(formData);
        setIsEditing(false);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="settings-section">
            <h3>Informations du compte</h3>

            {isEditing ? (
                <form onSubmit={handleSubmit} className="account-form">
                    <div className="form-group">
                        <label>Pseudo</label>
                        <input
                            type="text"
                            name="pseudo"
                            value={formData.pseudo}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Téléphone (optionnel)</label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+33 6 12 34 56 78"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                            Annuler
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Enregistrer
                        </button>
                    </div>
                </form>
            ) : (
                <div className="account-info">
                    <div className="info-row">
                        <span className="info-label">Pseudo:</span>
                        <span className="info-value">{profile.pseudo}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Email:</span>
                        <span className="info-value">{profile.email}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Téléphone:</span>
                        <span className="info-value">{profile.phone || 'Non renseigné'}</span>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                        Modifier
                    </button>
                </div>
            )}
        </div>
    );
});

AccountSettings.displayName = 'AccountSettings';

interface SecuritySettingsProps {
    profile: Profile;
    onToggle2FA: (enabled: boolean) => void;
    onChangePassword: () => void;
    onLogout: () => void;
}

const SecuritySettings = memo<SecuritySettingsProps>(({ profile, onToggle2FA, onChangePassword, onLogout }) => (
    <div className="settings-section">
        <h3>Sécurité</h3>

        <div className="security-options">
            <div className="security-option">
                <div className="option-info">
                    <h4>Authentification à deux facteurs</h4>
                    <p>Ajoutez une couche de sécurité supplémentaire à votre compte</p>
                </div>
                <div className="option-action">
                    <button
                        className={`btn ${profile.twoFactorEnabled ? 'btn-outline' : 'btn-primary'}`}
                        onClick={() => onToggle2FA(!profile.twoFactorEnabled)}
                    >
                        {profile.twoFactorEnabled ? 'Désactiver 2FA' : 'Activer 2FA'}
                    </button>
                </div>
            </div>

            <div className="security-option">
                <div className="option-info">
                    <h4>Mot de passe</h4>
                    <p>Modifiez votre mot de passe régulièrement</p>
                </div>
                <div className="option-action">
                    <button className="btn btn-secondary" onClick={onChangePassword}>
                        Changer le mot de passe
                    </button>
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

interface PreferencesSettingsProps {
    preferences: Preferences;
    onUpdatePreferences: (preferences: Preferences) => void;
}

const PreferencesSettings = memo<PreferencesSettingsProps>(({ preferences, onUpdatePreferences }) => {
    const [prefs, setPrefs] = useState<Preferences>(preferences);

    const handleToggle = (section: keyof Preferences, key: string) => {
        const newPrefs = {
            ...prefs,
            [section]: {
                ...prefs[section],
                [key]: !prefs[section][key as keyof typeof prefs[typeof section]]
            }
        } as Preferences;
        setPrefs(newPrefs);
        onUpdatePreferences(newPrefs);
    };

    const handleChange = (section: keyof Preferences, key: string, value: number) => {
        const newPrefs = {
            ...prefs,
            [section]: {
                ...prefs[section],
                [key]: value
            }
        } as Preferences;
        setPrefs(newPrefs);
        onUpdatePreferences(newPrefs);
    };

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
                                    checked={prefs.notifications.email}
                                    onChange={() => handleToggle('notifications', 'email')}
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
                                    checked={prefs.notifications.push}
                                    onChange={() => handleToggle('notifications', 'push')}
                                />
                                <span className="slider"></span>
                            </label>
                        </label>
                    </div>

                    <div className="preference-option">
                        <label className="toggle-label">
                            <span>Notifications SMS</span>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={prefs.notifications.sms}
                                    onChange={() => handleToggle('notifications', 'sms')}
                                />
                                <span className="slider"></span>
                            </label>
                        </label>
                    </div>
                </div>

                <div className="preference-group">
                    <h4>Confidentialité</h4>

                    <div className="preference-option">
                        <label className="toggle-label">
                            <span>Profil public</span>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={prefs.privacy.profilePublic}
                                    onChange={() => handleToggle('privacy', 'profilePublic')}
                                />
                                <span className="slider"></span>
                            </label>
                        </label>
                    </div>

                    <div className="preference-option">
                        <label className="toggle-label">
                            <span>Statistiques publiques</span>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={prefs.privacy.statsPublic}
                                    onChange={() => handleToggle('privacy', 'statsPublic')}
                                />
                                <span className="slider"></span>
                            </label>
                        </label>
                    </div>

                    <div className="preference-option">
                        <label className="toggle-label">
                            <span>Ligues publiques</span>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={prefs.privacy.leaguesPublic}
                                    onChange={() => handleToggle('privacy', 'leaguesPublic')}
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
                                value={prefs.betting.defaultStake}
                                onChange={(e) => handleChange('betting', 'defaultStake', parseInt(e.target.value) || 1)}
                                className="number-input"
                            />
                        </label>
                    </div>

                    <div className="preference-option">
                        <label>
                            <span>Mise maximum (€)</span>
                            <input
                                type="number"
                                min="1"
                                max="10000"
                                value={prefs.betting.maxStake}
                                onChange={(e) => handleChange('betting', 'maxStake', parseInt(e.target.value) || 1)}
                                className="number-input"
                            />
                        </label>
                    </div>

                    <div className="preference-option">
                        <label className="toggle-label">
                            <span>Accepter automatiquement les changements de cotes</span>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={prefs.betting.autoAcceptOddsChanges}
                                    onChange={() => handleToggle('betting', 'autoAcceptOddsChanges')}
                                />
                                <span className="slider"></span>
                            </label>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
});

PreferencesSettings.displayName = 'PreferencesSettings';

type TabType = 'account' | 'security' | 'preferences';

interface ProfileSectionProps {
    user?: User;
    onLogout?: () => void;
}

const ProfileSection = memo<ProfileSectionProps>(({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState<TabType>('account');
    const [profile, setProfile] = useState<Profile>(MOCK_PROFILE);

    const handleUpdateProfile = useCallback((updatedData: Partial<Profile>) => {
        setProfile(prev => ({ ...prev, ...updatedData }));
        console.log('Profil mis à jour:', updatedData);
    }, []);

    const handleUpdatePreferences = useCallback((newPreferences: Preferences) => {
        setProfile(prev => ({ ...prev, preferences: newPreferences }));
        console.log('Préférences mises à jour:', newPreferences);
    }, []);

    const handleToggle2FA = useCallback((enabled: boolean) => {
        setProfile(prev => ({ ...prev, twoFactorEnabled: enabled }));
        console.log('2FA:', enabled ? 'activé' : 'désactivé');
    }, []);

    const handleChangePassword = useCallback(() => {
        console.log('Changement de mot de passe demandé');
        // Ici, redirection vers le formulaire de changement de mot de passe
    }, []);

    const handleChangeAvatar = useCallback(() => {
        console.log('Changement d\'avatar demandé');
        // Ici, ouverture du sélecteur de fichiers
    }, []);

    const handleEditProfile = useCallback(() => {
        setActiveTab('account');
    }, []);

    const handleLogout = useCallback(() => {
        if (onLogout) {
            onLogout();
        }
    }, [onLogout]);

    return (
        <div className="profile-section">
            <ProfileHeader
                profile={profile}
                onEditProfile={handleEditProfile}
                onChangeAvatar={handleChangeAvatar}
            />

            <div className="profile-tabs">
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
                {activeTab === 'account' && (
                    <AccountSettings
                        profile={profile}
                        onUpdateProfile={handleUpdateProfile}
                    />
                )}

                {activeTab === 'security' && (
                    <SecuritySettings
                        profile={profile}
                        onToggle2FA={handleToggle2FA}
                        onChangePassword={handleChangePassword}
                        onLogout={handleLogout}
                    />
                )}

                {activeTab === 'preferences' && (
                    <PreferencesSettings
                        preferences={profile.preferences}
                        onUpdatePreferences={handleUpdatePreferences}
                    />
                )}
            </div>
        </div>
    );
});

ProfileSection.displayName = 'ProfileSection';

export default ProfileSection;