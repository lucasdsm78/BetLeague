import React, { useState, useCallback, memo } from 'react';
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

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
        setFormData({
            name: '',
            type: 'private',
            maxMembers: 10,
            entryFee: 20,
            description: ''
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Créer une nouvelle ligue</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                
                <form onSubmit={handleSubmit} className="create-league-form">
                    <div className="form-group">
                        <label>Nom de la ligue</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Ex: Ligue des amis 2024"
                            required
                        />
                    </div>
                    
                    <div className="form-row">
                        <div className="form-group">
                            <label>Type</label>
                            <select name="type" value={formData.type} onChange={handleChange}>
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
                                max="100"
                            />
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>Mise d'entrée (€)</label>
                        <input
                            type="number"
                            name="entryFee"
                            value={formData.entryFee}
                            onChange={handleChange}
                            min="0"
                            step="5"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Description (optionnel)</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Règles, prix, informations..."
                            rows="3"
                        />
                    </div>
                    
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Annuler
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Créer la ligue
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
    const [leagues] = useState(MOCK_LEAGUES);
    const [invitations] = useState(MOCK_INVITATIONS);

    const handleCreateLeague = useCallback((leagueData) => {
        console.log('Création de ligue:', leagueData);
        setIsCreateModalOpen(false);
        // Ici, appel API pour créer la ligue
    }, []);

    const handleJoinLeague = useCallback((leagueCode) => {
        console.log('Rejoindre ligue:', leagueCode);
        // Ici, appel API pour rejoindre la ligue
    }, []);

    const handleAcceptInvitation = useCallback((invitation) => {
        console.log('Accepter invitation:', invitation);
        // Ici, appel API pour accepter l'invitation
    }, []);

    const handleDeclineInvitation = useCallback((invitation) => {
        console.log('Refuser invitation:', invitation);
        // Ici, appel API pour refuser l'invitation
    }, []);

    return (
        <div className="leagues-section">
            <div className="section-header">
                <h2>Mes Ligues</h2>
                <div className="header-actions">
                    <button 
                        className="btn btn-primary"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        Créer une ligue
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
                        {leagues.length > 0 ? (
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