import React, { useState, useCallback, memo, useMemo } from 'react';
import './TicketsSection.css';

// Types
interface User {
    id: string;
    email: string;
    pseudo?: string;
    username?: string;
}

interface Bet {
    match: string;
    selection: string;
    odds: number;
}

interface Ticket {
    id: number;
    status: 'pending' | 'won' | 'lost' | 'draft';
    createdAt: string;
    totalOdds: number;
    stake: number;
    potentialWin: number;
    actualWin?: number;
    bets: Bet[];
}

interface Template {
    id: number;
    name: string;
    description: string;
    usageCount: number;
}

interface Stats {
    total: number;
    won: number;
    lost: number;
    pending: number;
    totalStake: number;
    totalWinnings: number;
    roi: number;
    winRate: number;
}

const MOCK_TICKETS: Ticket[] = [
    {
        id: 1,
        status: 'pending',
        createdAt: '2024-01-18T14:30:00Z',
        totalOdds: 4.85,
        stake: 50,
        potentialWin: 242.50,
        bets: [
            { match: 'PSG vs OM', selection: 'PSG gagne', odds: 1.85 },
            { match: 'Real vs Barca', selection: 'Plus de 2.5 buts', odds: 1.75 },
            { match: 'Man U vs Liverpool', selection: 'Match nul', odds: 1.50 }
        ]
    },
    {
        id: 2,
        status: 'won',
        createdAt: '2024-01-15T20:15:00Z',
        totalOdds: 2.40,
        stake: 25,
        potentialWin: 60,
        actualWin: 60,
        bets: [
            { match: 'Bayern vs Dortmund', selection: 'Bayern gagne', odds: 2.40 }
        ]
    },
    {
        id: 3,
        status: 'lost',
        createdAt: '2024-01-14T16:45:00Z',
        totalOdds: 6.20,
        stake: 20,
        potentialWin: 124,
        bets: [
            { match: 'Arsenal vs Chelsea', selection: 'Arsenal gagne', odds: 2.20 },
            { match: 'Inter vs Milan', selection: 'Plus de 3.5 buts', odds: 2.80 }
        ]
    }
];

const MOCK_TEMPLATES: Template[] = [
    {
        id: 1,
        name: 'Favori du week-end',
        description: 'Paris sur les équipes favorites',
        usageCount: 5
    },
    {
        id: 2,
        name: 'Over/Under Goals',
        description: 'Focus sur le nombre de buts',
        usageCount: 3
    }
];

interface TicketCardProps {
    ticket: Ticket;
    onView: (ticket: Ticket) => void;
    onEdit: (ticket: Ticket) => void;
    onDelete: (ticket: Ticket) => void;
}

const TicketCard = memo<TicketCardProps>(({ ticket, onView, onEdit, onDelete }) => {
    const getStatusIcon = (status: Ticket['status']): string => {
        switch (status) {
            case 'pending': return '⏳';
            case 'won': return '✅';
            case 'lost': return '❌';
            case 'draft': return '📝';
            default: return '❓';
        }
    };

    const getStatusLabel = (status: Ticket['status']): string => {
        switch (status) {
            case 'pending': return 'En cours';
            case 'won': return 'Gagné';
            case 'lost': return 'Perdu';
            case 'draft': return 'Brouillon';
            default: return status;
        }
    };

    const getStatusColor = (status: Ticket['status']): string => {
        switch (status) {
            case 'pending': return 'var(--warning-color)';
            case 'won': return 'var(--success-color)';
            case 'lost': return 'var(--danger-color)';
            case 'draft': return 'var(--text-secondary)';
            default: return 'var(--text-secondary)';
        }
    };

    return (
        <div className={`ticket-card ${ticket.status}`}>
            <div className="ticket-header">
                <div className="ticket-info">
                    <div className="ticket-status">
                        <span className="status-icon">{getStatusIcon(ticket.status)}</span>
                        <span
                            className="status-label"
                            style={{ color: getStatusColor(ticket.status) }}
                        >
                            {getStatusLabel(ticket.status)}
                        </span>
                    </div>
                    <span className="ticket-date">
                        {new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>
                <span className="ticket-id">#{ticket.id}</span>
            </div>

            <div className="ticket-bets">
                {ticket.bets.slice(0, 2).map((bet, index) => (
                    <div key={index} className="bet-item">
                        <span className="bet-match">{bet.match}</span>
                        <span className="bet-selection">{bet.selection}</span>
                        <span className="bet-odds">@{bet.odds}</span>
                    </div>
                ))}
                {ticket.bets.length > 2 && (
                    <div className="more-bets">
                        +{ticket.bets.length - 2} autre(s) pari(s)
                    </div>
                )}
            </div>

            <div className="ticket-summary">
                <div className="summary-row">
                    <span className="summary-label">Mise:</span>
                    <span className="summary-value">{ticket.stake}€</span>
                </div>
                <div className="summary-row">
                    <span className="summary-label">Cote totale:</span>
                    <span className="summary-value">{ticket.totalOdds}</span>
                </div>
                <div className="summary-row primary">
                    <span className="summary-label">
                        {ticket.status === 'won' ? 'Gain:' : 'Gain potentiel:'}
                    </span>
                    <span className="summary-value">
                        {ticket.actualWin || ticket.potentialWin}€
                    </span>
                </div>
            </div>

            <div className="ticket-actions">
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onView(ticket)}
                >
                    Voir détail
                </button>
                {ticket.status === 'draft' && (
                    <>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onEdit(ticket)}
                        >
                            Modifier
                        </button>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => onDelete(ticket)}
                        >
                            Supprimer
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});

TicketCard.displayName = 'TicketCard';

interface TemplateCardProps {
    template: Template;
    onUse: (template: Template) => void;
    onEdit: (template: Template) => void;
    onDelete: (template: Template) => void;
}

const TemplateCard = memo<TemplateCardProps>(({ template, onUse, onEdit, onDelete }) => (
    <div className="template-card">
        <div className="template-header">
            <h4 className="template-name">{template.name}</h4>
            <span className="usage-count">{template.usageCount} utilisations</span>
        </div>

        <p className="template-description">{template.description}</p>

        <div className="template-actions">
            <button
                className="btn btn-primary btn-sm"
                onClick={() => onUse(template)}
            >
                Utiliser
            </button>
            <button
                className="btn btn-secondary btn-sm"
                onClick={() => onEdit(template)}
            >
                Modifier
            </button>
            <button
                className="btn btn-outline btn-sm"
                onClick={() => onDelete(template)}
            >
                Supprimer
            </button>
        </div>
    </div>
));

TemplateCard.displayName = 'TemplateCard';

interface StatsPanelProps {
    tickets: Ticket[];
}

const StatsPanel = memo<StatsPanelProps>(({ tickets }) => {
    const stats = useMemo((): Stats => {
        const won = tickets.filter(t => t.status === 'won');
        const lost = tickets.filter(t => t.status === 'lost');
        const pending = tickets.filter(t => t.status === 'pending');

        const totalStake = tickets.reduce((sum, t) => sum + (t.stake || 0), 0);
        const totalWinnings = won.reduce((sum, t) => sum + (t.actualWin || 0), 0);
        const roi = totalStake > 0 ? ((totalWinnings - totalStake) / totalStake * 100) : 0;

        return {
            total: tickets.length,
            won: won.length,
            lost: lost.length,
            pending: pending.length,
            totalStake,
            totalWinnings,
            roi,
            winRate: tickets.length > 0 ? (won.length / (won.length + lost.length) * 100) : 0
        };
    }, [tickets]);

    return (
        <div className="stats-panel">
            <h3>Statistiques</h3>
            <div className="stats-grid">
                <div className="stat-item">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Tickets totaux</span>
                </div>
                <div className="stat-item success">
                    <span className="stat-value">{stats.won}</span>
                    <span className="stat-label">Gagnés</span>
                </div>
                <div className="stat-item danger">
                    <span className="stat-value">{stats.lost}</span>
                    <span className="stat-label">Perdus</span>
                </div>
                <div className="stat-item warning">
                    <span className="stat-value">{stats.pending}</span>
                    <span className="stat-label">En cours</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value">{stats.totalStake}€</span>
                    <span className="stat-label">Mise totale</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value">{stats.totalWinnings}€</span>
                    <span className="stat-label">Gains totaux</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value">{stats.winRate.toFixed(1)}%</span>
                    <span className="stat-label">Taux de réussite</span>
                </div>
                <div className={`stat-item ${stats.roi >= 0 ? 'success' : 'danger'}`}>
                    <span className="stat-value">{stats.roi.toFixed(1)}%</span>
                    <span className="stat-label">ROI</span>
                </div>
            </div>
        </div>
    );
});

StatsPanel.displayName = 'StatsPanel';

type TabType = 'current' | 'history' | 'templates';
type StatusFilter = 'all' | 'pending' | 'draft' | 'won' | 'lost';

interface TicketsSectionProps {
    user?: User;
}

const TicketsSection = memo<TicketsSectionProps>(({ user }) => {
    const [activeTab, setActiveTab] = useState<TabType>('current');
    const [tickets] = useState<Ticket[]>(MOCK_TICKETS);
    const [templates] = useState<Template[]>(MOCK_TEMPLATES);
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');

    const filteredTickets = useMemo(() => {
        let filtered = tickets;

        if (activeTab === 'current') {
            filtered = filtered.filter(t => ['pending', 'draft'].includes(t.status));
        } else if (activeTab === 'history') {
            filtered = filtered.filter(t => ['won', 'lost'].includes(t.status));
        }

        if (filterStatus !== 'all') {
            filtered = filtered.filter(t => t.status === filterStatus);
        }

        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [tickets, activeTab, filterStatus]);

    const handleViewTicket = useCallback((ticket: Ticket) => {
        console.log('Voir ticket:', ticket);
        // Ici, navigation vers le détail du ticket
    }, []);

    const handleEditTicket = useCallback((ticket: Ticket) => {
        console.log('Modifier ticket:', ticket);
        // Ici, navigation vers l'édition du ticket
    }, []);

    const handleDeleteTicket = useCallback((ticket: Ticket) => {
        console.log('Supprimer ticket:', ticket);
        // Ici, suppression du ticket
    }, []);

    const handleUseTemplate = useCallback((template: Template) => {
        console.log('Utiliser template:', template);
        // Ici, création d'un nouveau ticket avec le template
    }, []);

    const handleEditTemplate = useCallback((template: Template) => {
        console.log('Modifier template:', template);
        // Ici, édition du template
    }, []);

    const handleDeleteTemplate = useCallback((template: Template) => {
        console.log('Supprimer template:', template);
        // Ici, suppression du template
    }, []);

    return (
        <div className="tickets-section">
            <div className="section-header">
                <h2>Mes Tickets</h2>
                <div className="header-actions">
                    <button className="btn btn-primary">
                        Nouveau ticket
                    </button>
                </div>
            </div>

            <StatsPanel tickets={tickets} />

            <div className="tickets-tabs">
                <button
                    className={`tab-button ${activeTab === 'current' ? 'active' : ''}`}
                    onClick={() => setActiveTab('current')}
                >
                    En cours ({tickets.filter(t => ['pending', 'draft'].includes(t.status)).length})
                </button>
                <button
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    Historique ({tickets.filter(t => ['won', 'lost'].includes(t.status)).length})
                </button>
                <button
                    className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
                    onClick={() => setActiveTab('templates')}
                >
                    Templates ({templates.length})
                </button>
            </div>

            {(activeTab === 'current' || activeTab === 'history') && (
                <div className="tickets-filters">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                        className="status-filter"
                    >
                        <option value="all">Tous les statuts</option>
                        {activeTab === 'current' && (
                            <>
                                <option value="pending">En cours</option>
                                <option value="draft">Brouillons</option>
                            </>
                        )}
                        {activeTab === 'history' && (
                            <>
                                <option value="won">Gagnés</option>
                                <option value="lost">Perdus</option>
                            </>
                        )}
                    </select>
                </div>
            )}

            <div className="tab-content">
                {(activeTab === 'current' || activeTab === 'history') && (
                    <div className="tickets-grid">
                        {filteredTickets.length > 0 ? (
                            filteredTickets.map(ticket => (
                                <TicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    onView={handleViewTicket}
                                    onEdit={handleEditTicket}
                                    onDelete={handleDeleteTicket}
                                />
                            ))
                        ) : (
                            <div className="empty-state">
                                <span className="empty-icon">🎫</span>
                                <h3>Aucun ticket trouvé</h3>
                                <p>
                                    {activeTab === 'current'
                                        ? "Vous n'avez pas de tickets en cours"
                                        : "Votre historique est vide"
                                    }
                                </p>
                                <button className="btn btn-primary">
                                    Créer un ticket
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'templates' && (
                    <div className="templates-section">
                        <div className="templates-header">
                            <p>Créez et réutilisez vos combinaisons favorites</p>
                            <button className="btn btn-primary">
                                Nouveau template
                            </button>
                        </div>

                        <div className="templates-grid">
                            {templates.length > 0 ? (
                                templates.map(template => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        onUse={handleUseTemplate}
                                        onEdit={handleEditTemplate}
                                        onDelete={handleDeleteTemplate}
                                    />
                                ))
                            ) : (
                                <div className="empty-state">
                                    <span className="empty-icon">📋</span>
                                    <h3>Aucun template</h3>
                                    <p>Créez vos premiers templates pour gagner du temps</p>
                                    <button className="btn btn-primary">
                                        Créer un template
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

TicketsSection.displayName = 'TicketsSection';

export default TicketsSection;