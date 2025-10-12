import React, { useState, useCallback, memo, useMemo } from 'react';
import './TicketsSection.css';
import { useInProgressTickets } from '../../hooks/useInProgressTickets';
import type { TicketReadModel, MatchChoiceSummary } from '../../types/ticket';

type TabType = 'current' | 'history' | 'templates';

type StatusLabel = 'En cours' | 'Gagné' | 'Perdu' | 'Brouillon';

const statusToLabel = (status: string): StatusLabel => {
  switch (status) {
    case 'pending':
      return 'En cours';
    case 'correct':
      return 'Gagné';
    case 'wrong':
      return 'Perdu';
    default:
      return 'En cours';
  }
};

const ChoiceLabel: React.FC<{ choice: MatchChoiceSummary; className?: string }> = ({ choice, className }) => {
  const { match_summary, choice: c } = choice;
  const label = c === '1' ? match_summary.home_team : c === '2' ? match_summary.away_team : 'Match nul';
  return (
    <span className={`chip choice ${className || ''}`.trim()}>
      {match_summary.home_team} vs {match_summary.away_team} · <strong>{label}</strong>
    </span>
  );
};

interface InProgressTicketCardProps {
  ticket: TicketReadModel;
  onView: (id: number) => void;
}

const InProgressTicketCard = memo<InProgressTicketCardProps>(({ ticket, onView }) => {
  const leagueName = ticket.league_summary?.name || 'Ligues';
  const potentialGain = ticket.gain; // backend returns gain (potential when pending)

  return (
    <article className="ticket-card-modern" aria-label={`Ticket #${ticket.id}`}>
      <header className="ticket-card-header">
        <div className="left">
          <span className="badge badge-warning">{statusToLabel(ticket.status)}</span>
          <span className="ticket-league" title={leagueName}>{leagueName}</span>
        </div>
        <div className="right">
          <span className="ticket-id">#{ticket.id}</span>
        </div>
      </header>

      <div className="ticket-choices">
        {ticket.match_choice_summaries.slice(0, 3).map((mc) => (
          <ChoiceLabel key={mc.id} choice={mc} />
        ))}
        {ticket.match_choice_summaries.length > 3 && (
          <div className="more-bets">+{ticket.match_choice_summaries.length - 3} sélection(s)</div>
        )}
      </div>

      <div className="ticket-stats">
        <div className="stat">
          <span className="label">Mise</span>
          <span className="value">{ticket.mise}€</span>
        </div>
        <div className="divider" />
        <div className="stat primary">
          <span className="label">Gain potentiel</span>
          <span className="value">{potentialGain.toFixed(2)}€</span>
        </div>
      </div>

      <footer className="ticket-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onView(ticket.id)} aria-label={`Voir le ticket ${ticket.id}`}>
          Voir détail
        </button>
      </footer>
    </article>
  );
});
InProgressTicketCard.displayName = 'InProgressTicketCard';

const StatsPanelCurrent: React.FC<{ tickets: TicketReadModel[]; lastUpdated: number | null; onRefresh: () => void; loading: boolean }> = ({ tickets, lastUpdated, onRefresh, loading }) => {
  const stats = useMemo(() => {
    const total = tickets.length;
    const totalStake = tickets.reduce((sum, t) => sum + (t.mise || 0), 0);
    const totalPotential = tickets.reduce((sum, t) => sum + (t.gain || 0), 0);
    const avgStake = total > 0 ? totalStake / total : 0;
    return { total, totalStake, totalPotential, avgStake };
  }, [tickets]);

  return (
    <section className="stats-panel modern">
      <div className="stats-header">
        <h3>Tickets en cours</h3>
        <div className="tools">
          <button className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
            {loading ? 'Rafraîchissement…' : 'Rafraîchir'}
          </button>
          <span className="last-updated" aria-live="polite">
            {lastUpdated ? `Maj: ${new Date(lastUpdated).toLocaleTimeString('fr-FR')}` : ''}
          </span>
        </div>
      </div>
      <div className="stats-grid compact">
        <div className="stat-item">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Tickets</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.totalStake}€</span>
          <span className="stat-label">Mise totale</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.totalPotential.toFixed(2)}€</span>
          <span className="stat-label">Gain potentiel</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.avgStake.toFixed(1)}€</span>
          <span className="stat-label">Mise moyenne</span>
        </div>
      </div>
    </section>
  );
};

const SkeletonCard: React.FC = () => (
  <div className="ticket-card-modern skeleton" aria-hidden="true">
    <div className="skeleton-bar header" />
    <div className="skeleton-chip" />
    <div className="skeleton-chip" />
    <div className="skeleton-chip short" />
    <div className="skeleton-bar stats" />
    <div className="skeleton-button" />
  </div>
);

const TicketsSection: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState<TabType>('current');

  // Data for current (in-progress)
  const { tickets, loading, error, refetch, lastUpdated } = useInProgressTickets({ refreshIntervalMs: 30_000 });

  const handleViewTicket = useCallback((id: number) => {
    // TODO: implement navigation to ticket details when route exists
    console.log('navigate to ticket', id);
  }, []);

  return (
    <div className="tickets-section">
      <div className="section-header">
        <h2>Mes Tickets</h2>
        <div className="header-actions">
          <button className="btn btn-primary">Nouveau ticket</button>
        </div>
      </div>

      <div className="tickets-tabs">
        <button className={`tab-button ${activeTab === 'current' ? 'active' : ''}`} onClick={() => setActiveTab('current')}>
          En cours ({tickets.length})
        </button>
        <button className={`tab-button ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          Historique
        </button>
        <button className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
          Templates
        </button>
      </div>

      {activeTab === 'current' && (
        <>
          <StatsPanelCurrent tickets={tickets} lastUpdated={lastUpdated} onRefresh={refetch} loading={loading} />

          {error && (
            <div className="alert alert-danger" role="alert">
              <span>Impossible de charger les tickets en cours: {error}</span>
              <button className="btn btn-outline btn-sm" onClick={refetch}>Réessayer</button>
            </div>
          )}

          <div className="tickets-grid modern">
            {loading && tickets.length === 0 && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {!loading && tickets.length === 0 && !error && (
              <div className="empty-state">
                <span className="empty-icon">🎫</span>
                <h3>Aucun ticket en cours</h3>
                <p>Créez un ticket pour commencer à parier dans vos ligues.</p>
                <button className="btn btn-primary">Créer un ticket</button>
              </div>
            )}

            {tickets.map((t) => (
              <InProgressTicketCard key={t.id} ticket={t} onView={handleViewTicket} />
            ))}
          </div>
        </>
      )}

      {activeTab !== 'current' && (
        <div className="empty-state subtle">
          <span className="empty-icon">📚</span>
          <h3>Section en construction</h3>
          <p>Nous nous concentrons sur l’onglet « En cours ». L’historique et les templates arrivent bientôt.</p>
        </div>
      )}
    </div>
  );
});

TicketsSection.displayName = 'TicketsSection';

export default TicketsSection;
