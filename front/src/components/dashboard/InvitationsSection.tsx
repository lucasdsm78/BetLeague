import React, { memo, useCallback, useState } from 'react';
import './InvitationsSection.css';
import { deleteLeagueInvitation, updateInvitation, updateTournamentInvitation } from '../../services/api/invitations';
import { deleteTournamentInvitation } from '../../services/api/tournament';
import {
  useReceivedInvitationsQuery,
  useSentInvitationsQuery,
  useInvalidateInvitations,
} from '../../hooks/queries/useInvitationsQueries';
import type { InvitationReceivedReadModel, InvitationSentReadModel } from '../../types/entities/invitation';
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

function isPendingStatus(status: string): boolean {
  return (status || '').trim().toUpperCase() === 'PENDING';
}

function getStatusBadgeClass(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'ACCEPTED':
      return 'inv-badge inv-badge--accepted';
    case 'REFUSED':
      return 'inv-badge inv-badge--refused';
    default:
      return 'inv-badge inv-badge--pending';
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
        <span className={getStatusBadgeClass(invitation.status)}>{getStatusLabel(invitation.status)}</span>
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
    </div>
  );
});
InvitationCard.displayName = 'InvitationCard';

interface SentInvitationCardProps {
  invitation: InvitationSentReadModel;
  onDelete: (invitation: InvitationSentReadModel) => void;
  loading?: boolean;
}

const SentInvitationCard: React.FC<SentInvitationCardProps> = memo(({ invitation, onDelete, loading }) => {
  const isLeagueInvitation = invitation.type === 'league' && !!invitation.league;
  const league = invitation.league;
  const tournament = invitation.tournament;
  const title = isLeagueInvitation ? league?.name : tournament?.name;
  const members = isLeagueInvitation
    ? (league?.max_players || 0) - (league?.nb_players_remaining || 0)
    : tournament?.current_players || 0;
  const maxMembers = isLeagueInvitation ? league?.max_players || 0 : tournament?.max_players || 0;
  const startDate = isLeagueInvitation ? league?.start_date : tournament?.start_date;
  const canDelete = isPendingStatus(invitation.status);

  return (
    <div className={`inv-card ${canDelete ? 'inv-card--pending' : 'inv-card--neutral'}`}>
      <div className="inv-card-header">
        <div className="left">
          <h4 className="inv-card-league-name">{title || '—'}</h4>
          <span className={`inv-resource-badge ${isLeagueInvitation ? 'league' : 'tournament'}`}>
            {isLeagueInvitation ? 'Ligue' : 'Tournoi'}
          </span>
        </div>
        <span className={getStatusBadgeClass(invitation.status)}>{getStatusLabel(invitation.status)}</span>
      </div>

      <div className="inv-card-body">
        <div className="inv-card-inviter">
          <span className="inv-card-inviter-avatar">{getInitial(invitation.user.pseudo)}</span>
          <span>Envoyée à <strong>{invitation.user.pseudo || 'Inconnu'}</strong></span>
        </div>
        <div className="inv-card-recipient-email">{invitation.user.email}</div>
      </div>

      <div className="inv-card-stats">
        <div className="inv-card-stat">
          <span className="label">Joueurs</span>
          <span className="value">{members}/{maxMembers}</span>
        </div>
        <span className="divider" />
        <div className="inv-card-stat primary">
          <span className="label">Envoyée</span>
          <span className="value">{formatDate(invitation.created_at)}</span>
        </div>
        <span className="divider" />
        <div className="inv-card-stat">
          <span className="label">Début</span>
          <span className="value">{formatDate(startDate)}</span>
        </div>
      </div>

      <div className="inv-card-actions inv-card-actions--single">
        <button
          type="button"
          className="inv-btn inv-btn--decline"
          onClick={() => onDelete(invitation)}
          disabled={loading || !canDelete}
        >
          <IconX /> {loading ? 'Retrait…' : 'Retirer'}
        </button>
      </div>

      {!canDelete && (
        <div className="inv-card-note">
          Cette invitation ne peut plus être retirée car elle a déjà été traitée.
        </div>
      )}
    </div>
  );
});
SentInvitationCard.displayName = 'SentInvitationCard';

/* ───── Main Section ───── */

type InvitationsTab = 'received' | 'sent';

const InvitationsSection: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState<InvitationsTab>('received');
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [deletingSentId, setDeletingSentId] = useState<number | null>(null);

  const { showSuccess, showError } = useGlobalToast();
  const invalidate = useInvalidateInvitations();

  const invitationsQuery = useReceivedInvitationsQuery(
    { page: 1, pageSize: 20, filter: { status: 'PENDING' } },
    { refetchIntervalMs: 30_000, enabled: true },
  );
  const sentInvitationsQuery = useSentInvitationsQuery(
    { page: 1, pageSize: 20 },
    { refetchIntervalMs: 30_000, enabled: true },
  );

  const invitations = invitationsQuery.data?.invitations ?? [];
  const sentInvitations = sentInvitationsQuery.data?.invitations ?? [];
  const pendingCount = invitationsQuery.data?.total ?? invitations.length;
  const sentCount = sentInvitationsQuery.data?.total ?? sentInvitations.length;
  const loading = invitationsQuery.isLoading;
  const error = (invitationsQuery.error as any)?.message ?? null;
  const sentLoading = sentInvitationsQuery.isLoading;
  const sentError = (sentInvitationsQuery.error as any)?.message ?? null;

  const handleAccept = useCallback(async (invitation: InvitationReceivedReadModel) => {
     setLoadingId(invitation.id);
     try {
      const res = invitation.type === 'league'
        ? await updateInvitation(invitation.id, true)
        : await updateTournamentInvitation(invitation.id, true);
      showSuccess(
        'Invitation acceptée',
        res.message || (invitation.type === 'league' ? 'Vous avez rejoint la ligue !' : 'Vous avez rejoint le tournoi !'),
      );
       invalidate.invalidateAll();
     } catch (e: any) {
       showError('Erreur', e?.message || "Erreur lors de l'acceptation de l'invitation");
     } finally {
       setLoadingId(null);
     }
  }, [invalidate, showSuccess, showError]);

  const handleDecline = useCallback(async (invitation: InvitationReceivedReadModel) => {
     setLoadingId(invitation.id);
     try {
      const res = invitation.type === 'league'
        ? await updateInvitation(invitation.id, false)
        : await updateTournamentInvitation(invitation.id, false);
       showSuccess('Invitation refusée', res.message || 'Invitation refusée');
       invalidate.invalidateAll();
     } catch (e: any) {
       showError('Erreur', e?.message || "Erreur lors du refus de l'invitation");
     } finally {
       setLoadingId(null);
     }
  }, [invalidate, showSuccess, showError]);

  const handleDeleteSent = useCallback(async (invitation: InvitationSentReadModel) => {
    if (deletingSentId !== null || !isPendingStatus(invitation.status)) return;

    setDeletingSentId(invitation.id);
    try {
      const res = invitation.type === 'league'
        ? await deleteLeagueInvitation(invitation.id)
        : await deleteTournamentInvitation(invitation.id);

      showSuccess('Invitation retirée', res.message || 'Invitation retirée avec succès.');
      invalidate.invalidateAll();
    } catch (e: any) {
      showError('Erreur', e?.message || "Erreur lors du retrait de l'invitation");
    } finally {
      setDeletingSentId(null);
    }
  }, [deletingSentId, invalidate, showError, showSuccess]);

  return (
    <div className="invitations-section" data-section="invitations">
      <div className="section-header">
        <h2>Invitations</h2>
      </div>

      <div className="invitations-tabs" role="tablist" aria-label="Invitations">
        <button
          type="button"
          className={`tab-button ${activeTab === 'received' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'received'}
          aria-controls="invitations-panel-received"
          id="invitations-tab-received"
          onClick={() => setActiveTab('received')}
        >
          <span className="tab-content-wrapper">
            <span className="tab-title">Reçues</span>
            <span className="tab-badge">{pendingCount}</span>
          </span>
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'sent' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'sent'}
          aria-controls="invitations-panel-sent"
          id="invitations-tab-sent"
          onClick={() => setActiveTab('sent')}
        >
          <span className="tab-content-wrapper">
            <span className="tab-title">Envoyées</span>
            <span className="tab-badge">{sentCount}</span>
          </span>
        </button>
      </div>

      {activeTab === 'received' ? (
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
      ) : (
        <section
          id="invitations-panel-sent"
          role="tabpanel"
          aria-labelledby="invitations-tab-sent"
          className="invitations-panel"
        >
          {sentLoading ? (
            <div className="inv-grid">
              <InvitationSkeleton />
              <InvitationSkeleton />
              <InvitationSkeleton />
            </div>
          ) : sentError ? (
            <div className="inv-empty">
              <span className="inv-empty-icon">⚠️</span>
              <h3>Erreur de chargement</h3>
              <p>{sentError}</p>
              <button
                className="inv-btn inv-btn--accept"
                onClick={() => sentInvitationsQuery.refetch()}
                style={{ marginTop: '0.5rem', flex: 'none', padding: '0.5rem 1.5rem' }}
              >
                Réessayer
              </button>
            </div>
          ) : sentInvitations.length > 0 ? (
            <div className="inv-grid">
              {sentInvitations.map((invitation) => (
                <SentInvitationCard
                  key={`${invitation.type}-${invitation.id}`}
                  invitation={invitation}
                  onDelete={handleDeleteSent}
                  loading={deletingSentId === invitation.id}
                />
              ))}
            </div>
          ) : (
            <div className="inv-empty">
              <span className="inv-empty-icon">📤</span>
              <h3>Aucune invitation envoyée</h3>
              <p>Vos invitations de ligues et de tournois envoyées apparaîtront ici.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
});

InvitationsSection.displayName = 'InvitationsSection';

export default InvitationsSection;
