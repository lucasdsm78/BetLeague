import React, { useState, useCallback, memo, useMemo } from 'react';
import './TicketsSection.css';
import { useInProgressTicketsQuery, useFinishedTicketsQuery, useInvalidateTickets } from '../../hooks/queries/useTicketsQueries';
import type { TicketReadModel, MatchChoiceSummary } from '../../types/entities/ticket';
import TicketDetailModal from './TicketDetailModal';
import DeleteTicketModal from './DeleteTicketModal';
import { deleteTicket as apiDeleteTicket } from 'services/api/tickets';
import { useGlobalToast } from '../../toast/ToastProvider';
import { useProfileMeQuery } from '../../hooks/queries/useProfileQuery';

type TabType = 'current' | 'finished';

type StatusLabel = 'En cours' | 'Gagné' | 'Perdu' | 'Brouillon';

const normalizeStatus = (status?: string | null): string => (status || '').toLowerCase();

const statusToLabel = (status: string): StatusLabel => {
  switch (normalizeStatus(status)) {
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
  onDelete: (id: number) => void;
}

const InProgressTicketCard = memo<InProgressTicketCardProps>(({ ticket, onView, onDelete }) => {
  const leagueName = ticket.league_summary?.name || 'Ligues';
  const potentialGain = Number(ticket.gain ?? 0); // backend returns gain (potential when pending)

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
        {ticket.match_choice_summaries.slice(0, 3).map((mc: MatchChoiceSummary) => (
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
        <button className="btn btn-outline btn-sm" onClick={() => onDelete(ticket.id)} aria-label={`Supprimer le ticket ${ticket.id}`}>
          Supprimer
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => onView(ticket.id)} aria-label={`Voir le ticket ${ticket.id}`}>
          Voir détail
        </button>
      </footer>
    </article>
  );
});
InProgressTicketCard.displayName = 'InProgressTicketCard';

interface FinishedTicketCardProps {
  ticket: TicketReadModel;
  onView: (id: number) => void;
}

const FinishedTicketCard = memo<FinishedTicketCardProps>(({ ticket, onView }) => {
  const leagueName = ticket.league_summary?.name || 'Ligues';
  const normalizedStatus = normalizeStatus(ticket.status);
  const isWin = normalizedStatus === 'correct';
  const badgeClass = isWin ? 'badge-success' : 'badge-danger';
  const resultLabel = isWin ? 'Gagné' : 'Perdu';

  return (
    <article className="ticket-card-modern" aria-label={`Ticket #${ticket.id}`}>
      <header className="ticket-card-header">
        <div className="left">
          <span className={`badge ${badgeClass}`}>{resultLabel}</span>
          <span className="ticket-league" title={leagueName}>{leagueName}</span>
        </div>
        <div className="right">
          <span className="ticket-id">#{ticket.id}</span>
        </div>
      </header>

      <div className="ticket-choices">
        {ticket.match_choice_summaries.slice(0, 3).map((mc: MatchChoiceSummary) => (
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
          <span className="label">Gain</span>
          <span className="value">{Number(ticket.gain || 0).toFixed(2)}€</span>
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
FinishedTicketCard.displayName = 'FinishedTicketCard';

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

const StatsPanelFinished: React.FC<{ tickets: TicketReadModel[]; lastUpdated: number | null; onRefresh: () => void; loading: boolean }> = ({ tickets, lastUpdated, onRefresh, loading }) => {
  const stats = useMemo(() => {
    const total = tickets.length;
    const totalStake = tickets.reduce((sum, t) => sum + (t.mise || 0), 0);
    const totalGain = tickets.reduce((sum, t) => sum + (t.gain || 0), 0);
    const won = tickets.filter((t) => normalizeStatus(t.status) === 'correct').length;
    const lost = tickets.filter((t) => normalizeStatus(t.status) === 'wrong').length;
    const winRate = total > 0 ? (won / total) * 100 : 0;
    return { total, totalStake, totalGain, won, lost, winRate };
  }, [tickets]);

  return (
    <section className="stats-panel modern">
      <div className="stats-header">
        <h3>Tickets terminés</h3>
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
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item success">
          <span className="stat-value">{stats.won}</span>
          <span className="stat-label">Gagnés</span>
        </div>
        <div className="stat-item danger">
          <span className="stat-value">{stats.lost}</span>
          <span className="stat-label">Perdus</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.winRate.toFixed(0)}%</span>
          <span className="stat-label">Win rate</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.totalStake.toFixed(2)}€</span>
          <span className="stat-label">Mise totale</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.totalGain.toFixed(2)}€</span>
          <span className="stat-label">Gain total</span>
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

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTicketId, setDeleteTicketId] = useState<number | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [deleteSource, setDeleteSource] = useState<'list' | 'detail' | null>(null);
  const [localUpdatedAt, setLocalUpdatedAt] = useState<number | null>(null);

  const { showSuccess, showError } = useGlobalToast();
  const profileQuery = useProfileMeQuery({ enabled: true });
  const refetchProfile = useCallback(() => profileQuery.refetch(), [profileQuery]);
  const invalidateTickets = useInvalidateTickets();

  // Data for current (in-progress)
  const inProgressQuery = useInProgressTicketsQuery({ refetchIntervalMs: 30_000 });
  const tickets = inProgressQuery.data ?? [];
  const loading = inProgressQuery.isLoading;
  const error = inProgressQuery.error?.message ?? null;
  const lastUpdated = inProgressQuery.dataUpdatedAt || null;

  const filteredTickets = useMemo(() => tickets.filter(t => !deletedIds.has(t.id)), [tickets, deletedIds]);

  // Data for finished tickets (manual refresh)
  const finishedQuery = useFinishedTicketsQuery();
  const finishedTickets = finishedQuery.data ?? [];
  const loadingFinished = finishedQuery.isLoading;
  const errorFinished = finishedQuery.error?.message ?? null;
  const lastUpdatedFinished = finishedQuery.dataUpdatedAt || null;

  const refetch = useCallback(async () => {
    await inProgressQuery.refetch();
  }, [inProgressQuery]);

  const refetchFinished = useCallback(async () => {
    await finishedQuery.refetch();
  }, [finishedQuery]);

  const handleViewTicket = useCallback((id: number) => {
    setSelectedTicketId(id);
    setIsDetailOpen(true);
  }, []);

  const handleDeleteAskFromList = useCallback((id: number) => {
    setDeleteSource('list');
    setDeleteTicketId(id);
    setIsDeleteOpen(true);
  }, []);

  const handleDeleteAskFromDetail = useCallback((id: number) => {
    setDeleteSource('detail');
    setDeleteTicketId(id);
    setIsDeleteOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async (id: number) => {
    try {
      // Masquage optimiste immédiat + horodatage local
      setDeletedIds(prev => new Set(prev).add(id));
      setLocalUpdatedAt(Date.now());

      await apiDeleteTicket(id);
      showSuccess('Ticket supprimé', `Ticket #${id} supprimé avec succès. Votre mise a été recréditée.`);

      // Rafraîchir via React Query
      invalidateTickets.invalidateAll();
      refetchProfile();

      // Fermeture des modales
      setIsDeleteOpen(false);
      setDeleteTicketId(null);
      if (deleteSource === 'detail') {
        setIsDetailOpen(false);
        setSelectedTicketId(null);
      }
    } catch (e: any) {
      // Revert en cas d’erreur
      setDeletedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showError('Erreur', e?.message || 'Suppression du ticket échouée');
      throw e; // pour affichage éventuel dans la modale
    }
  }, [refetch, refetchProfile, showSuccess, showError, deleteSource]);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setIsDeleteOpen(false);
  }, []);

  return (
    <div className="tickets-section">

      {/* Modales */}
      <TicketDetailModal
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        ticketId={selectedTicketId}
        onAskDelete={handleDeleteAskFromDetail}
      />
      <DeleteTicketModal isOpen={isDeleteOpen} onClose={handleCloseDelete} ticketId={deleteTicketId} onConfirm={handleDeleteConfirm} />

      <div className="section-header">
        <h2>Mes Tickets</h2>
      </div>

      <div className="tickets-tabs" role="tablist" aria-label="Filtres tickets">
        <button
          type="button"
          className={`tab-button ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
          aria-label="Tickets en cours"
          aria-selected={activeTab === 'current'}
          role="tab"
        >
          <span className="tab-content-wrapper">
            <span className="tab-title">En cours</span>
            <span className="tab-badge">{filteredTickets.length}</span>
          </span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'finished' ? 'active' : ''}`}
          onClick={() => setActiveTab('finished')}
          aria-label="Tickets terminés"
          aria-selected={activeTab === 'finished'}
          role="tab"
        >
          <span className="tab-content-wrapper">
            <span className="tab-title">Terminés</span>
            <span className="tab-badge">{finishedTickets.length}</span>
          </span>
        </button>
      </div>

      {activeTab === 'current' && (
        <>
          <StatsPanelCurrent tickets={filteredTickets} lastUpdated={localUpdatedAt || lastUpdated} onRefresh={refetch} loading={loading} />

          {error && (
            <div className="alert alert-danger" role="alert">
              <span>Impossible de charger les tickets en cours: {error}</span>
              <button className="btn btn-outline btn-sm" onClick={refetch}>Réessayer</button>
            </div>
          )}

          <div className="tickets-grid modern">
            {loading && filteredTickets.length === 0 && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {!loading && filteredTickets.length === 0 && !error && (
              <div className="empty-state">
                <span className="empty-icon">🎫</span>
                <h3>Aucun ticket en cours</h3>
                <p>Créez un ticket pour commencer à parier dans vos ligues.</p>
              </div>
            )}

            {filteredTickets.map((t) => (
              <InProgressTicketCard key={t.id} ticket={t} onView={handleViewTicket} onDelete={handleDeleteAskFromList} />
            ))}
          </div>
        </>
      )}

      {activeTab === 'finished' && (
        <>
          <StatsPanelFinished tickets={finishedTickets} lastUpdated={lastUpdatedFinished} onRefresh={refetchFinished} loading={loadingFinished} />

          {errorFinished && (
            <div className="alert alert-danger" role="alert">
              <span>Impossible de charger les tickets terminés: {errorFinished}</span>
              <button className="btn btn-outline btn-sm" onClick={refetchFinished}>Réessayer</button>
            </div>
          )}

          <div className="tickets-grid modern">
            {loadingFinished && finishedTickets.length === 0 && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {!loadingFinished && finishedTickets.length === 0 && !errorFinished && (
              <div className="empty-state subtle">
                <span className="empty-icon">✅</span>
                <h3>Aucun ticket terminé</h3>
                <p>Vous verrez ici vos tickets gagnés et perdus.</p>
              </div>
            )}

            {finishedTickets.map((t) => (
              <FinishedTicketCard key={t.id} ticket={t} onView={handleViewTicket} />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

TicketsSection.displayName = 'TicketsSection';

export default TicketsSection;
