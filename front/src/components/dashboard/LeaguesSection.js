import React, { useState, useCallback, memo, useEffect } from 'react';
import leagueApiService from '../../services/leagueApiService';
import './LeaguesSection.css';

const MOCK_LEAGUES = [
    {
        id: 1,
        name: 'Ligue des Champions 2024',
        type: 'public',
        members: 24,
        maxMembers: 50,
        myRank: 3,
        totalPot: 1200,
        endDate: '2024-06-15',
        status: 'active',
        admin: 'SportsMaster'
    },
    {
        id: 2,
        name: 'Entre Amis - Ligue 1',
        type: 'private',
        members: 8,
        maxMembers: 10,
        myRank: 1,
        totalPot: 400,
        endDate: '2024-05-30',
        status: 'active',
        admin: 'Moi'
    }
];

const MOCK_INVITATIONS = [
    {
        id: 1,
        leagueName: 'Bureau FC 2024',
        inviterName: 'JeanDupont',
        inviteDate: '2024-01-18',
        members: 15,
        maxMembers: 20
    }
];

const LeagueCard = memo(({ league, onJoin, onView, onManage }) => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'var(--success-color)';
            case 'ended': return 'var(--text-light)';
            case 'pending': return 'var(--warning-color)';
            default: return 'var(--text-secondary)';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'active': return 'Active';
            case 'ended': return 'Terminée';
            case 'pending': return 'En attente';
            default: return status;
        }
    };

    return (
        <div className={`league-card ${league.type}`}>
            <div className="league-header">
                <div className="league-info">
                    <h3 className="league-name">{league.name}</h3>
                    <div className="league-meta">
                        <span className="league-type">
                            {league.type === 'private' ? '🔒 Privée' : '🌍 Publique'}
                        </span>
                        <span 
                            className="league-status"
                            style={{ color: getStatusColor(league.status) }}
                        >
                            {getStatusLabel(league.status)}
                        </span>
                    </div>
                </div>
                <div className="league-rank">
                    <div className="rank-badge">
                        #{league.myRank}
                    </div>
                    <span className="rank-label">Ma position</span>
                </div>
            </div>

            <div className="league-stats">
                <div className="stat">
                    <span className="stat-value">{league.members}/{league.maxMembers}</span>
                    <span className="stat-label">Participants</span>
                </div>
                <div className="stat">
                    <span className="stat-value">{league.totalPot}€</span>
                    <span className="stat-label">Cagnotte</span>
                </div>
                <div className="stat">
                    <span className="stat-value">
                        {new Date(league.endDate).toLocaleDateString('fr-FR')}
                    </span>
                    <span className="stat-label">Fin</span>
                </div>
            </div>

            <div className="league-actions">
                <button 
                    className="btn btn-secondary"
                    onClick={() => onView(league)}
                >
                    Voir classement
                </button>
                {league.admin === 'Moi' && (
                    <button 
                        className="btn btn-outline"
                        onClick={() => onManage(league)}
                    >
                        Gérer
                    </button>
                )}
            </div>
        </div>
    );
});

LeagueCard.displayName = 'LeagueCard';

const InvitationCard = memo(({ invitation, onAccept, onDecline }) => (
    <div className="invitation-card">
        <div className="invitation-info">
            <h4 className="league-name">{invitation.leagueName}</h4>
            <p className="invitation-text">
                <strong>{invitation.inviterName}</strong> vous invite à rejoindre cette ligue
            </p>
            <div className="invitation-meta">
                <span>{invitation.members}/{invitation.maxMembers} participants</span>
                <span>•</span>
                <span>{new Date(invitation.inviteDate).toLocaleDateString('fr-FR')}</span>
            </div>
        </div>
        <div className="invitation-actions">
            <button 
                className="btn btn-primary btn-sm"
                onClick={() => onAccept(invitation)}
            >
                Accepter
            </button>
            <button 
                className="btn btn-outline btn-sm"
                onClick={() => onDecline(invitation)}
            >
                Refuser
            </button>
        </div>
    </div>
));

InvitationCard.displayName = 'InvitationCard';

const CreateLeagueModal = memo(({ isOpen, onClose, onSubmit }) => {
    const [formData, setFormData] = useState({
        name: '',
        type: 'private',
        maxMembers: 10,
        entryFee: 20,
        description: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [nameError, setNameError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            // Client-side validation
            const nameValidation = leagueApiService.validateLeagueName(formData.name);
            if (!nameValidation.isValid) {
                setNameError(nameValidation.error);
                return;
            }

            // Call API
            const result = await leagueApiService.createLeague(formData);
            
            if (result.success) {
                // Reset form
                setFormData({
                    name: '',
                    type: 'private',
                    maxMembers: 10,
                    entryFee: 20,
                    description: ''
                });
                setNameError('');
                onClose();
                
                // Call success callback
                if (onSubmit) {
                    onSubmit(result.data, result.message);
                }
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur inattendue lors de la création');
            console.error('League creation error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        // Clear errors when user types
        setError('');
        if (name === 'name') {
            setNameError('');
        }

        // Update form data with proper type conversion
        setFormData(prev => ({ 
            ...prev, 
            [name]: name === 'maxMembers' || name === 'entryFee' 
                ? (value === '' ? 0 : parseInt(value)) 
                : value 
        }));
    };

    // Real-time name validation
    const handleNameBlur = useCallback(() => {
        if (formData.name) {
            const validation = leagueApiService.validateLeagueName(formData.name);
            if (!validation.isValid) {
                setNameError(validation.error);
            }
        }
    }, [formData.name]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Créer une nouvelle ligue</h3>
                    <button 
                        className="modal-close" 
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        ✕
                    </button>
                </div>
                
                {/* Error Display */}
                {error && (
                    <div className="error-alert" style={{
                        background: 'var(--danger-color)',
                        color: 'white',
                        padding: '0.75rem 1rem',
                        margin: '1rem',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="create-league-form">
                    <div className="form-group">
                        <label>Nom de la ligue</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            onBlur={handleNameBlur}
                            placeholder="Ex: Ligue des amis 2024"
                            required
                            disabled={isSubmitting}
                            maxLength={50}
                            style={nameError ? { borderColor: 'var(--danger-color)' } : {}}
                        />
                        {nameError && (
                            <span style={{
                                color: 'var(--danger-color)',
                                fontSize: '0.75rem',
                                marginTop: '0.25rem',
                                display: 'block'
                            }}>
                                {nameError}
                            </span>
                        )}
                    </div>
                    
                    <div className="form-row">
                        <div className="form-group">
                            <label>Type</label>
                            <select 
                                name="type" 
                                value={formData.type} 
                                onChange={handleChange}
                                disabled={isSubmitting}
                            >
                                <option value="private">Privée (invitation)</option>
                                <option value="public">Publique</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Participants max</label>
                            <input
                                type="number"
                                name="maxMembers"
                                value={formData.maxMembers}
                                onChange={handleChange}
                                min="2"
                                max="200"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>Mise d'entrée (BTL)</label>
                        <input
                            type="number"
                            name="entryFee"
                            value={formData.entryFee}
                            onChange={handleChange}
                            min="0"
                            max="10000"
                            step="5"
                            disabled={isSubmitting}
                        />
                        <small style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            display: 'block',
                            marginTop: '0.25rem'
                        }}>
                            {formData.entryFee === 0 ? 'Ligue gratuite' : 'Mise d\'entrée en BTL'}
                        </small>
                    </div>
                    
                    <div className="form-group">
                        <label>Description (optionnel)</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Règles, prix, informations..."
                            rows="3"
                            disabled={isSubmitting}
                            maxLength={500}
                        />
                    </div>
                    
                    {/* Pot Preview */}
                    {formData.entryFee > 0 && formData.maxMembers > 0 && (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            padding: '0.75rem',
                            borderRadius: 'var(--border-radius-sm)',
                            marginBottom: '1rem',
                            border: '1px solid var(--border-color)'
                        }}>
                            <strong style={{ color: 'var(--success-color)' }}>
                                💰 Cagnotte totale estimée: {(formData.maxMembers * formData.entryFee).toLocaleString()} BTL
                            </strong>
                        </div>
                    )}
                    
                    <div className="modal-actions">
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Annuler
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={isSubmitting || !formData.name.trim() || nameError}
                        >
                            {isSubmitting ? (
                                <>
                                    <span style={{ marginRight: '0.5rem' }}>⏳</span>
                                    Création...
                                </>
                            ) : (
                                'Créer la ligue'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

CreateLeagueModal.displayName = 'CreateLeagueModal';

const LeaguesSection = memo(({ user }) => {
    const [activeTab, setActiveTab] = useState('myLeagues');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [leagues, setLeagues] = useState(MOCK_LEAGUES);
    const [invitations, setInvitations] = useState(MOCK_INVITATIONS);
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');

    // Load real data from API
    const loadLeagues = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await leagueApiService.getLeagues();
            if (result.success) {
                setLeagues(result.data.leagues || result.data || []);
            }
        } catch (err) {
            console.error('Failed to load leagues:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadInvitations = useCallback(async () => {
        try {
            const result = await leagueApiService.getInvitations(true);
            if (result.success) {
                setInvitations(result.data.invitations || result.data || []);
            }
        } catch (err) {
            console.error('Failed to load invitations:', err);
        }
    }, []);

    // Load data on component mount
    useEffect(() => {
        loadLeagues();
        loadInvitations();
    }, [loadLeagues, loadInvitations]);

    // Handle league creation success
    const handleCreateLeague = useCallback((leagueData, message) => {
        console.log('Ligue créée:', leagueData);
        setIsCreateModalOpen(false);
        
        // Show success message
        setSuccessMessage(message || 'Ligue créée avec succès !');
        setTimeout(() => setSuccessMessage(''), 5000);
        
        // Reload leagues
        loadLeagues();
    }, [loadLeagues]);

    const handleJoinLeague = useCallback(async (leagueCode) => {
        if (!leagueCode || leagueCode.trim() === '') {
            setError('Code de ligue requis');
            return;
        }

        try {
            // Parse league code to ID (assuming it's numeric for now)
            const leagueId = parseInt(leagueCode);
            if (isNaN(leagueId)) {
                setError('Code de ligue invalide');
                return;
            }

            const result = await leagueApiService.joinLeague(leagueId);
            if (result.success) {
                setSuccessMessage(result.message);
                setTimeout(() => setSuccessMessage(''), 5000);
                loadLeagues();
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors de la tentative de rejoindre la ligue');
            console.error('Join league error:', err);
        }
    }, [loadLeagues]);

    const handleAcceptInvitation = useCallback(async (invitation) => {
        try {
            const result = await leagueApiService.updateInvitation(invitation.id, true);
            if (result.success) {
                setSuccessMessage(result.message);
                setTimeout(() => setSuccessMessage(''), 5000);
                loadLeagues();
                loadInvitations();
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors de l\'acceptation de l\'invitation');
            console.error('Accept invitation error:', err);
        }
    }, [loadLeagues, loadInvitations]);

    const handleDeclineInvitation = useCallback(async (invitation) => {
        try {
            const result = await leagueApiService.updateInvitation(invitation.id, false);
            if (result.success) {
                setSuccessMessage(result.message);
                setTimeout(() => setSuccessMessage(''), 3000);
                loadInvitations();
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('Erreur lors du refus de l\'invitation');
            console.error('Decline invitation error:', err);
        }
    }, [loadInvitations]);

    return (
        <div className="leagues-section">
            {/* Success Message */}
            {successMessage && (
                <div style={{
                    background: 'var(--success-color)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>✅ {successMessage}</span>
                    <button 
                        onClick={() => setSuccessMessage('')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div style={{
                    background: 'var(--danger-color)',
                    color: 'white',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    borderRadius: 'var(--border-radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>⚠️ {error}</span>
                    <button 
                        onClick={() => setError('')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <div className="section-header">
                <h2>Mes Ligues</h2>
                <div className="header-actions">
                    <button 
                        className="btn btn-primary"
                        onClick={() => setIsCreateModalOpen(true)}
                        disabled={isLoading}
                    >
                        {isLoading ? '⏳ Chargement...' : 'Créer une ligue'}
                    </button>
                </div>
            </div>

            <div className="leagues-tabs">
                <button 
                    className={`tab-button ${activeTab === 'myLeagues' ? 'active' : ''}`}
                    onClick={() => setActiveTab('myLeagues')}
                >
                    Mes ligues ({leagues.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'invitations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invitations')}
                >
                    Invitations ({invitations.length})
                </button>
                <button 
                    className={`tab-button ${activeTab === 'join' ? 'active' : ''}`}
                    onClick={() => setActiveTab('join')}
                >
                    Rejoindre
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'myLeagues' && (
                    <div className="leagues-grid">
                        {isLoading ? (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '2rem',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    width: '2rem',
                                    height: '2rem',
                                    border: '3px solid var(--border-color)',
                                    borderTop: '3px solid var(--primary-color)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: '1rem'
                                }}></div>
                                <p style={{ color: 'var(--text-secondary)' }}>Chargement de vos ligues...</p>
                            </div>
                        ) : leagues.length > 0 ? (
                            leagues.map(league => (
                                <LeagueCard 
                                    key={league.id} 
                                    league={league}
                                    onView={(league) => console.log('Voir', league)}
                                    onManage={(league) => console.log('Gérer', league)}
                                />
                            ))
                        ) : (
                            <div className="empty-state">
                                <span className="empty-icon">🏆</span>
                                <h3>Aucune ligue active</h3>
                                <p>Créez votre première ligue ou rejoignez-en une existante</p>
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => setIsCreateModalOpen(true)}
                                    disabled={isLoading}
                                >
                                    Créer une ligue
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'invitations' && (
                    <div className="invitations-list">
                        {invitations.length > 0 ? (
                            invitations.map(invitation => (
                                <InvitationCard
                                    key={invitation.id}
                                    invitation={invitation}
                                    onAccept={handleAcceptInvitation}
                                    onDecline={handleDeclineInvitation}
                                />
                            ))
                        ) : (
                            <div className="empty-state">
                                <span className="empty-icon">📨</span>
                                <h3>Aucune invitation</h3>
                                <p>Vous n'avez pas d'invitations en attente</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'join' && (
                    <div className="join-league-section">
                        <div className="join-form">
                            <h3>Rejoindre une ligue</h3>
                            <p>Entrez le code de la ligue pour la rejoindre</p>
                            
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const code = e.target.code.value;
                                handleJoinLeague(code);
                            }}>
                                <div className="form-group">
                                    <input
                                        type="text"
                                        name="code"
                                        placeholder="Code de la ligue (ex: ABCD1234)"
                                        className="join-input"
                                        required
                                    />
                                    <button type="submit" className="btn btn-primary">
                                        Rejoindre
                                    </button>
                                </div>
                            </form>
                        </div>
                        
                        <div className="public-leagues">
                            <h4>Ligues publiques disponibles</h4>
                            <p>Explorez les ligues publiques que vous pouvez rejoindre</p>
                            <button className="btn btn-secondary">
                                Parcourir les ligues publiques
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <CreateLeagueModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreateLeague}
            />
        </div>
    );
});

LeaguesSection.displayName = 'LeaguesSection';

export default LeaguesSection;