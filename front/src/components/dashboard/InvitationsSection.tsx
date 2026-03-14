import React, { memo, useCallback, useState } from 'react';
import './LeaguesSection.css';
import { updateInvitation } from '../../services/api/invitations';
import {
  useReceivedInvitationsQuery,
  useInvitationCountsQuery,
  useInvalidateInvitations,
  type InvitationStatusFilter,
} from '../../hooks/queries/useInvitationsQueries';
import type { InvitationReceivedReadModel } from '../../types/entities/invitation';
import { useGlobalToast } from '../../toast/ToastProvider';

/* ───── SVG Icons ───── */

const IconAll = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

const IconPending = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconAccepted = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconRefused = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

/* ───── Filter Bar ───── */

const InvitationFilterBar: React.FC<{
  active: InvitationStatusFilter | null;
  counts: { pending: number; accepted: number; refused: number };
  onChange: (f: InvitationStatusFilter | null) => void;
}> = memo(({ active, counts, onChange }) => (
  <div className="invitation-filter-bar" role="group" aria-label="Filtrer par statut">
    <button
      type="button"
      className={`filter-chip filter-chip--inv-all${active === null ? ' active' : ''}`}
      onClick={() => onChange(null)}
      aria-pressed={active === null}
    >
      <span className="filter-chip-icon" aria-hidden="true"><IconAll /></span>
      <span className="filter-chip-label">Toutes</span>
    </button>

    <button
      type="button"
      className={`filter-chip filter-chip--inv-pending${active === 'PENDING' ? ' active' : ''}`}
      onClick={() => onChange(active === 'PENDING' ? null : 'PENDING')}
      aria-pressed={active === 'PENDING'}
    >
      <span className="filter-chip-icon" aria-hidden="true"><IconPending /></span>
      <span className="filter-chip-label">En cours</span>
      {counts.pending > 0 && <span className="filter-chip-count">{counts.pending}</span>}
    </button>

    <button
      type="button"
      className={`filter-chip filter-chip--inv-accepted${active === 'ACCEPTED' ? ' active' : ''}`}
      onClick={() => onChange(active === 'ACCEPTED' ? null : 'ACCEPTED')}
      aria-pressed={active === 'ACCEPTED'}
    >
      <span className="filter-chip-icon" aria-hidden="true"><IconAccepted /></span>
      <span className="filter-chip-label">Acceptées</span>
      {counts.accepted > 0 && <span className="filter-chip-count">{counts.accepted}</span>}
    </button>

    <button
      type="button"
      className={`filter-chip filter-chip--inv-refused${active === 'REFUSED' ? ' active' : ''}`}
      onClick={() => onChange(active === 'REFUSED' ? null : 'REFUSED')}
      aria-pressed={active === 'REFUSED'}
    >
      <span className="filter-chip-icon" aria-hidden="true"><IconRefused /></span>
      <span className="filter-chip-label">Refusées</span>
      {counts.refused > 0 && <span className="filter-chip-count">{counts.refused}</span>}
    </button>
  </div>
));
InvitationFilterBar.displayName = 'InvitationFilterBar';

/* ───── Invitation Card ───── */

const statusBadge = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'ACCEPTED') return { cls: 'badge-success', label: 'Acceptée' };
  if (s === 'REFUSED') return { cls: 'badge-danger', label: 'Refusée' };
  return { cls: 'badge-warning', label: 'En cours' };
};

interface InvitationCardProps {
  invitation: InvitationReceivedReadModel;
  onAccept: (inv: InvitationReceivedReadModel) => void;
  onDecline: (inv: InvitationReceivedReadModel) => void;
}

const InvitationCard: React.FC<InvitationCardProps> = memo(({ invitation, onAccept, onDecline }) => {
  const badge = statusBadge(invitation.status);
  const isPending = invitation.status.toUpperCase() === 'PENDING';
  const league = invitation.league;

  const leagueName = league?.name || '';
  const inviterName = league?.user_creator?.pseudo || 'Inconnu';
  const members = (league?.max_players || 0) - (league?.nb_players_remaining || 0);
  const maxMembers = league?.max_players || 0;
  const inviteDate = league?.start_date
    ? new Date(league.start_date).toLocaleDateString('fr-FR')
    : '';

  return (
    <div className="invitation-card">
      <div className="invitation-info">
        <div className="invitation-card-header-row">
          <h4 className="league-name">{leagueName}</h4>
          <span className={`badge ${badge.cls}`}>{badge.label}</span>
        </div>
        <p className="invitation-text">
          <strong>{inviterName}</strong> vous invite à rejoindre cette ligue
        </p>
        <div className="invitation-meta">
          <span>{members}/{maxMembers} participants</span>
          <span>•</span>
          <span>{inviteDate}</span>
        </div>
      </div>
      {isPending && (
        <div className="invitation-actions">
          <button className="btn btn-primary btn-sm" onClick={() => onAccept(invitation)}>
            Accepter
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onDecline(invitation)}>
            Refuser
          </button>
        </div>
      )}
    </div>
  );
});
InvitationCard.displayName = 'InvitationCard';

/* ───── Main Section ───── */

const InvitationsSection: React.FC = memo(() => {
  const [activeFilter, setActiveFilter] = useState<InvitationStatusFilter | null>('PENDING');

  const { showSuccess, showError } = useGlobalToast();
  const invalidate = useInvalidateInvitations();

  // React Query: invitations filtrées par statut (server-side, like tickets)
  const invitationsQuery = useReceivedInvitationsQuery(
    { page: 1, pageSize: 20, filter: { status: activeFilter } },
    { refetchIntervalMs: 30_000 },
  );

  // React Query: compteurs par statut (1 seule requête SQL, like tickets meta)
  const countsQuery = useInvitationCountsQuery({ refetchIntervalMs: 60_000 });

  const invitations = invitationsQuery.data?.invitations ?? [];
  const loading = invitationsQuery.isLoading;
  const error = (invitationsQuery.error as any)?.message ?? null;
  const counts = countsQuery.data ?? { pending: 0, accepted: 0, refused: 0 };

  const handleAccept = useCallback(async (invitation: InvitationReceivedReadModel) => {
    try {
      const res = await updateInvitation(invitation.id, true);
      showSuccess('Invitation acceptée', res.message || 'Invitation acceptée avec succès');
      invalidate.invalidateAll();
    } catch (e: any) {
      showError('Erreur', e?.message || "Erreur lors de l'acceptation de l'invitation");
    }
  }, [invalidate, showSuccess, showError]);

  const handleDecline = useCallback(async (invitation: InvitationReceivedReadModel) => {
    try {
      const res = await updateInvitation(invitation.id, false);
      showSuccess('Invitation refusée', res.message || 'Invitation refusée');
      invalidate.invalidateAll();
    } catch (e: any) {
      showError('Erreur', e?.message || "Erreur lors du refus de l'invitation");
    }
  }, [invalidate, showSuccess, showError]);

  const filterLabel = activeFilter === 'PENDING' ? 'en cours'
    : activeFilter === 'ACCEPTED' ? 'acceptées'
    : activeFilter === 'REFUSED' ? 'refusées'
    : '';

  return (
    <div className="leagues-section" data-section="invitations">
      <div className="section-header">
        <h2>Mes Invitations</h2>
      </div>

      <InvitationFilterBar active={activeFilter} counts={counts} onChange={setActiveFilter} />

      <div className="tab-content">
        <div className="invitations-list">
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon">⏳</span>
              <h3>Chargement des invitations…</h3>
              <p>Merci de patienter</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <span className="empty-icon">⚠️</span>
              <h3>Erreur de chargement</h3>
              <p>{error}</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => invitationsQuery.refetch()}
                style={{ marginTop: '0.5rem' }}
              >
                Réessayer
              </button>
            </div>
          ) : invitations.length > 0 ? (
            invitations.map(inv => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            ))
          ) : (
            <div className="empty-state">
              <span className="empty-icon">📨</span>
              <h3>{activeFilter ? `Aucune invitation ${filterLabel}` : 'Aucune invitation'}</h3>
              <p>{activeFilter ? 'Essayez un autre filtre.' : 'Vos invitations apparaîtront ici'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

InvitationsSection.displayName = 'InvitationsSection';

export default InvitationsSection;
