import React, { memo, useCallback, useState } from 'react';
import './InvitationsSection.css';
import { updateInvitation } from '../../services/api/invitations';
import {
  useReceivedInvitationsQuery,
  useInvalidateInvitations,
} from '../../hooks/queries/useInvitationsQueries';
import type { InvitationReceivedReadModel } from '../../types/entities/invitation';
import { useGlobalToast } from '../../toast/ToastProvider';

/* ───── SVG Icons ───── */

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ───── Skeleton Card ───── */

const InvitationSkeleton: React.FC = memo(() => (
  <div className="inv-card skeleton">
    <div className="inv-skeleton-bar header" />
    <div className="inv-skeleton-bar sub" />
    <div className="inv-skeleton-bar stats" />
    <div className="inv-skeleton-bar actions" />
  </div>
));
InvitationSkeleton.displayName = 'InvitationSkeleton';

/* ───── Invitation Card ───── */

function formatDate(raw?: string | number): string {
  if (!raw) return '—';
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  const normalized = Number.isFinite(numeric)
    ? (numeric > 10_000_000_000 ? numeric : numeric * 1000)
    : raw;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitial(name?: string): string {
  return (name ?? '?').charAt(0).toUpperCase();
}

function getStatusLabel(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'ACCEPTED':
      return 'Acceptée';
    case 'REFUSED':
      return 'Refusée';
    default:
      return 'En attente';
  }
}

interface InvitationCardProps {
  invitation: InvitationReceivedReadModel;
  onAccept: (inv: InvitationReceivedReadModel) => void;
  onDecline: (inv: InvitationReceivedReadModel) => void;
  loading?: boolean;
}

const InvitationCard: React.FC<InvitationCardProps> = memo(({ invitation, onAccept, onDecline, loading }) => {
  const isLeagueInvitation = invitation.type === 'league' && !!invitation.league;
  const league = invitation.league;
  const tournament = invitation.tournament;
  const title = isLeagueInvitation ? league?.name : tournament?.name;
  const inviterName = isLeagueInvitation
    ? league?.user_creator?.pseudo || 'Inconnu'
    : tournament?.user_creator?.pseudo || 'Inconnu';
  const members = isLeagueInvitation
    ? (league?.max_players || 0) - (league?.nb_players_remaining || 0)
    : tournament?.current_players || 0;
  const maxMembers = isLeagueInvitation ? league?.max_players || 0 : tournament?.max_players || 0;
  const startDate = isLeagueInvitation ? league?.start_date : tournament?.start_date;

  return (
    <div className="inv-card inv-card--pending">
      <div className="inv-card-header">
        <div className="left">
          <h4 className="inv-card-league-name">{title || '—'}</h4>
          <span className={`inv-resource-badge ${isLeagueInvitation ? 'league' : 'tournament'}`}>
            {isLeagueInvitation ? 'Ligue' : 'Tournoi'}
          </span>
        </div>
        <span className="inv-badge inv-badge--pending">{getStatusLabel(invitation.status)}</span>
      </div>

      <div className="inv-card-body">
        <div className="inv-card-inviter">
          <span className="inv-card-inviter-avatar">{getInitial(inviterName)}</span>
          <span>Invité par <strong>{inviterName}</strong></span>
        </div>
      </div>

      <div className="inv-card-stats">
        <div className="inv-card-stat">
          <span className="label">Joueurs</span>
          <span className="value">{members}/{maxMembers}</span>
        </div>
        <span className="divider" />
        <div className="inv-card-stat primary">
          <span className="label">Début</span>
          <span className="value">{formatDate(startDate)}</span>
        </div>
      </div>

      {isLeagueInvitation ? (
        <div className="inv-card-actions">
          <button
            type="button"
            className="inv-btn inv-btn--accept"
            onClick={() => onAccept(invitation)}
            disabled={loading}
          >
            <IconCheck /> Accepter
          </button>
          <button
            type="button"
            className="inv-btn inv-btn--decline"
            onClick={() => onDecline(invitation)}
            disabled={loading}
          >
            <IconX /> Refuser
          </button>
        </div>
      ) : (
        <div className="inv-card-note">
          Invitation tournoi reçue. La réponse depuis cet écran arrive bientôt.
        </div>
      )}
    </div>
  );
});
InvitationCard.displayName = 'InvitationCard';

/* ───── Main Section ───── */

const InvitationsSection: React.FC = memo(() => {
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { showSuccess, showError, showInfo } = useGlobalToast();
  const invalidate = useInvalidateInvitations();

  const invitationsQuery = useReceivedInvitationsQuery(
    { page: 1, pageSize: 20, filter: { status: 'PENDING' } },
    { refetchIntervalMs: 30_000, enabled: true },
  );

  const invitations = invitationsQuery.data?.invitations ?? [];
  const pendingCount = invitationsQuery.data?.total ?? invitations.length;
  const loading = invitationsQuery.isLoading;
  const error = (invitationsQuery.error as any)?.message ?? null;

  const handleAccept = useCallback(async (invitation: InvitationReceivedReadModel) => {
    if (invitation.type !== 'league') {
      showInfo('Invitation tournoi', 'La réponse aux invitations tournoi sera disponible très bientôt.');
      return;
    }

    setLoadingId(invitation.id);
    try {
      const res = await updateInvitation(invitation.id, true);
      showSuccess('Invitation acceptée', res.message || 'Vous avez rejoint la ligue !');
      invalidate.invalidateAll();
    } catch (e: any) {
      showError('Erreur', e?.message || "Erreur lors de l'acceptation de l'invitation");
    } finally {
      setLoadingId(null);
    }
  }, [invalidate, showSuccess, showError, showInfo]);

  const handleDecline = useCallback(async (invitation: InvitationReceivedReadModel) => {
    if (invitation.type !== 'league') {
      showInfo('Invitation tournoi', 'La réponse aux invitations tournoi sera disponible très bientôt.');
      return;
    }

    setLoadingId(invitation.id);
    try {
      const res = await updateInvitation(invitation.id, false);
      showSuccess('Invitation refusée', res.message || 'Invitation refusée');
      invalidate.invalidateAll();
    } catch (e: any) {
      showError('Erreur', e?.message || "Erreur lors du refus de l'invitation");
    } finally {
      setLoadingId(null);
    }
  }, [invalidate, showSuccess, showError, showInfo]);

  return (
    <div className="invitations-section" data-section="invitations">
      <div className="section-header">
        <h2>Invitations</h2>
      </div>

      <div className="invitations-tabs" role="tablist" aria-label="Invitations">
        <button
          type="button"
          className="tab-button active"
          role="tab"
          aria-selected={true}
          aria-controls="invitations-panel-received"
          id="invitations-tab-received"
        >
          <span className="tab-content-wrapper">
            <span className="tab-title">Reçues</span>
            <span className="tab-badge">{pendingCount}</span>
          </span>
        </button>
      </div>

      <section
        id="invitations-panel-received"
        role="tabpanel"
        aria-labelledby="invitations-tab-received"
        className="invitations-panel"
      >
        {loading ? (
          <div className="inv-grid">
            <InvitationSkeleton />
            <InvitationSkeleton />
            <InvitationSkeleton />
          </div>
        ) : error ? (
          <div className="inv-empty">
            <span className="inv-empty-icon">⚠️</span>
            <h3>Erreur de chargement</h3>
            <p>{error}</p>
            <button
              className="inv-btn inv-btn--accept"
              onClick={() => invitationsQuery.refetch()}
              style={{ marginTop: '0.5rem', flex: 'none', padding: '0.5rem 1.5rem' }}
            >
              Réessayer
            </button>
          </div>
        ) : invitations.length > 0 ? (
          <div className="inv-grid">
            {invitations.map(inv => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                onAccept={handleAccept}
                onDecline={handleDecline}
                loading={loadingId === inv.id}
              />
            ))}
          </div>
        ) : (
          <div className="inv-empty">
            <span className="inv-empty-icon">📨</span>
            <h3>Aucune invitation en attente</h3>
            <p>Vos invitations reçues apparaîtront ici.</p>
          </div>
        )}
      </section>
    </div>
  );
});

InvitationsSection.displayName = 'InvitationsSection';

export default InvitationsSection;
