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

const IconTrophy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

const IconMail = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const IconSend = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </svg>
);

/* ───── Helpers ───── */

function formatDate(raw?: string | number): string {
  if (!raw) return '\u2014';
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  const normalized = Number.isFinite(numeric)
    ? (numeric > 10_000_000_000 ? numeric : numeric * 1000)
    : raw;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitial(name?: string): string {
  return (name ?? '?').charAt(0).toUpperCase();
}

function getStatusLabel(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'ACCEPTED': return 'Accept\u00e9e';
    case 'REFUSED': return 'Refus\u00e9e';
    default: return 'En attente';
  }
}

function isPendingStatus(status: string): boolean {
  return (status || '').trim().toUpperCase() === 'PENDING';
}

function getStatusBadgeClass(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'ACCEPTED': return 'inv-badge inv-badge--accepted';
    case 'REFUSED': return 'inv-badge inv-badge--refused';
    default: return 'inv-badge inv-badge--pending';
  }
}

function getPlayerPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

/* ───── Skeleton Card ───── */

const InvitationSkeleton: React.FC = memo(() => (
  <div className="inv-card skeleton">
    <div className="inv-card-inner">
      <div className="inv-skeleton-bar header" />
      <div className="inv-skeleton-bar sub" />
      <div className="inv-skeleton-bar stats" />
      <div className="inv-skeleton-bar actions" />
    </div>
  </div>
));
InvitationSkeleton.displayName = 'InvitationSkeleton';

/* ───── Invitation Card (Received) ───── */

interface InvitationCardProps {
  invitation: InvitationReceivedReadModel;
  onAccept: (inv: InvitationReceivedReadModel) => void;
  onDecline: (inv: InvitationReceivedReadModel) => void;
  loading?: boolean;
}

const InvitationCard: React.FC<InvitationCardProps> = memo(({ invitation, onAccept, onDecline, loading }) => {
  const [confirmAction, setConfirmAction] = useState<'accept' | 'decline' | null>(null);

  const isLeague = invitation.type === 'league' && !!invitation.league;
  const league = invitation.league;
  const tournament = invitation.tournament;
  const title = isLeague ? league?.name : tournament?.name;
  const inviterName = isLeague
    ? league?.user_creator?.pseudo || 'Inconnu'
    : tournament?.user_creator?.pseudo || 'Inconnu';
  const members = isLeague
    ? (league?.max_players || 0) - (league?.nb_players_remaining || 0)
    : tournament?.current_players || 0;
  const maxMembers = isLeague ? league?.max_players || 0 : tournament?.max_players || 0;
  const startDate = isLeague ? league?.start_date : tournament?.start_date;

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'accept') onAccept(invitation);
    else if (confirmAction === 'decline') onDecline(invitation);
    setConfirmAction(null);
  }, [confirmAction, invitation, onAccept, onDecline]);

  return (
    <div className="inv-card inv-card--pending">
      <div className="inv-card-inner">
        {/* Confirmation overlay */}
        {confirmAction && !loading && (
          <div className="inv-card-confirm">
            <p>
              {confirmAction === 'accept'
                ? `Rejoindre ${isLeague ? 'la ligue' : 'le tournoi'} "${title}" ?`
                : `Refuser l'invitation pour "${title}" ?`}
            </p>
            <div className="inv-card-confirm-actions">
              <button
                type="button"
                className={`inv-btn ${confirmAction === 'accept' ? 'inv-btn--accept' : 'inv-btn--decline'}`}
                onClick={handleConfirm}
              >
                Confirmer
              </button>
              <button
                type="button"
                className="inv-btn inv-btn--decline"
                onClick={() => setConfirmAction(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="inv-card-header">
          <div className="left">
            <div className="inv-card-title-row">
              <span className={`inv-card-type-icon ${isLeague ? 'league' : 'tournament'}`}>
                {isLeague ? <IconShield /> : <IconTrophy />}
              </span>
              <h4 className="inv-card-league-name">{title || '\u2014'}</h4>
            </div>
            <span className={`inv-resource-badge ${isLeague ? 'league' : 'tournament'}`}>
              {isLeague ? 'Ligue' : 'Tournoi'}
            </span>
          </div>
          <span className={getStatusBadgeClass(invitation.status)}>
            {getStatusLabel(invitation.status)}
          </span>
        </div>

        <div className="inv-card-body">
          <div className="inv-card-inviter">
            <span className="inv-card-inviter-avatar">{getInitial(inviterName)}</span>
            <span>Invit&eacute; par <strong>{inviterName}</strong></span>
          </div>
        </div>

        <div className="inv-card-progress">
          <div className="inv-card-progress-bar">
            <div
              className="inv-card-progress-fill"
              style={{ width: `${getPlayerPercent(members, maxMembers)}%` }}
            />
          </div>
          <span className="inv-card-progress-label">{members}/{maxMembers}</span>
        </div>

        <div className="inv-card-stats">
          <div className="inv-card-stat primary">
            <span className="label">D&eacute;but</span>
            <span className="value">{formatDate(startDate)}</span>
          </div>
          <span className="divider" />
          <div className="inv-card-stat">
            <span className="label">Joueurs</span>
            <span className="value">{members}/{maxMembers}</span>
          </div>
        </div>

        <div className="inv-card-actions">
          <button
            type="button"
            className="inv-btn inv-btn--accept"
            onClick={() => setConfirmAction('accept')}
            disabled={loading}
          >
            {loading ? 'Chargement\u2026' : <><IconCheck /> Accepter</>}
          </button>
          <button
            type="button"
            className="inv-btn inv-btn--decline"
            onClick={() => setConfirmAction('decline')}
            disabled={loading}
          >
            <IconX /> Refuser
          </button>
        </div>
      </div>
    </div>
  );
});
InvitationCard.displayName = 'InvitationCard';

/* ───── Sent Invitation Card ───── */

interface SentInvitationCardProps {
  invitation: InvitationSentReadModel;
  onDelete: (invitation: InvitationSentReadModel) => void;
  loading?: boolean;
}

const SentInvitationCard: React.FC<SentInvitationCardProps> = memo(({ invitation, onDelete, loading }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const isLeague = invitation.type === 'league' && !!invitation.league;
  const league = invitation.league;
  const tournament = invitation.tournament;
  const title = isLeague ? league?.name : tournament?.name;
  const members = isLeague
    ? (league?.max_players || 0) - (league?.nb_players_remaining || 0)
    : tournament?.current_players || 0;
  const maxMembers = isLeague ? league?.max_players || 0 : tournament?.max_players || 0;
  const startDate = isLeague ? league?.start_date : tournament?.start_date;
  const canDelete = isPendingStatus(invitation.status);

  const handleConfirmDelete = useCallback(() => {
    onDelete(invitation);
    setShowConfirm(false);
  }, [invitation, onDelete]);

  return (
    <div className={`inv-card ${canDelete ? 'inv-card--pending' : 'inv-card--neutral'}`}>
      <div className="inv-card-inner">
        {/* Confirmation overlay */}
        {showConfirm && !loading && (
          <div className="inv-card-confirm">
            <p>Retirer l&apos;invitation envoy&eacute;e &agrave; {invitation.user.pseudo || 'cet utilisateur'} ?</p>
            <div className="inv-card-confirm-actions">
              <button
                type="button"
                className="inv-btn inv-btn--decline"
                onClick={handleConfirmDelete}
              >
                Retirer
              </button>
              <button
                type="button"
                className="inv-btn inv-btn--decline"
                onClick={() => setShowConfirm(false)}
                style={{ borderColor: 'transparent' }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="inv-card-header">
          <div className="left">
            <div className="inv-card-title-row">
              <span className={`inv-card-type-icon ${isLeague ? 'league' : 'tournament'}`}>
                {isLeague ? <IconShield /> : <IconTrophy />}
              </span>
              <h4 className="inv-card-league-name">{title || '\u2014'}</h4>
            </div>
            <span className={`inv-resource-badge ${isLeague ? 'league' : 'tournament'}`}>
              {isLeague ? 'Ligue' : 'Tournoi'}
            </span>
          </div>
          <span className={getStatusBadgeClass(invitation.status)}>
            {getStatusLabel(invitation.status)}
          </span>
        </div>

        <div className="inv-card-body">
          <div className="inv-card-inviter">
            <span className="inv-card-inviter-avatar">{getInitial(invitation.user.pseudo)}</span>
            <span>Envoy&eacute;e &agrave; <strong>{invitation.user.pseudo || 'Inconnu'}</strong></span>
          </div>
          {invitation.user.email && (
            <div className="inv-card-recipient-email">{invitation.user.email}</div>
          )}
        </div>

        <div className="inv-card-progress">
          <div className="inv-card-progress-bar">
            <div
              className="inv-card-progress-fill"
              style={{ width: `${getPlayerPercent(members, maxMembers)}%` }}
            />
          </div>
          <span className="inv-card-progress-label">{members}/{maxMembers}</span>
        </div>

        <div className="inv-card-stats">
          <div className="inv-card-stat primary">
            <span className="label">Envoy&eacute;e</span>
            <span className="value">{formatDate(invitation.created_at)}</span>
          </div>
          <span className="divider" />
          <div className="inv-card-stat">
            <span className="label">D&eacute;but</span>
            <span className="value">{formatDate(startDate)}</span>
          </div>
        </div>

        <div className="inv-card-actions inv-card-actions--single">
          <button
            type="button"
            className="inv-btn inv-btn--decline"
            onClick={() => setShowConfirm(true)}
            disabled={loading || !canDelete}
          >
            <IconX /> {loading ? 'Retrait\u2026' : 'Retirer'}
          </button>
        </div>

        {!canDelete && (
          <div className="inv-card-note">
            Cette invitation a d&eacute;j&agrave; &eacute;t&eacute; trait&eacute;e et ne peut plus &ecirc;tre retir&eacute;e.
          </div>
        )}
      </div>
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
  const error = (invitationsQuery.error as Error | null)?.message ?? null;
  const sentLoading = sentInvitationsQuery.isLoading;
  const sentError = (sentInvitationsQuery.error as Error | null)?.message ?? null;

  const handleAccept = useCallback(async (invitation: InvitationReceivedReadModel) => {
    setLoadingId(invitation.id);
    try {
      const res = invitation.type === 'league'
        ? await updateInvitation(invitation.id, true)
        : await updateTournamentInvitation(invitation.id, true);
      showSuccess(
        'Invitation accept\u00e9e',
        res.message || (invitation.type === 'league' ? 'Vous avez rejoint la ligue !' : 'Vous avez rejoint le tournoi !'),
      );
      invalidate.invalidateAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'acceptation de l'invitation";
      showError('Erreur', msg);
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
      showSuccess('Invitation refus\u00e9e', res.message || 'Invitation refus\u00e9e');
      invalidate.invalidateAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors du refus de l'invitation";
      showError('Erreur', msg);
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

      showSuccess('Invitation retir\u00e9e', res.message || 'Invitation retir\u00e9e avec succ\u00e8s.');
      invalidate.invalidateAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors du retrait de l'invitation";
      showError('Erreur', msg);
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
            <span className="tab-title">Re&ccedil;ues</span>
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
            <span className="tab-title">Envoy&eacute;es</span>
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
              <span className="inv-empty-icon"><IconMail /></span>
              <h3>Erreur de chargement</h3>
              <p>{error}</p>
              <button
                className="inv-btn inv-btn--accept"
                onClick={() => invitationsQuery.refetch()}
                type="button"
                style={{ marginTop: '0.5rem', flex: 'none', padding: '0.5rem 1.5rem' }}
              >
                R&eacute;essayer
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
              <span className="inv-empty-icon"><IconMail /></span>
              <h3>Aucune invitation en attente</h3>
              <p>Vos invitations re&ccedil;ues apparaîtront ici.</p>
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
              <span className="inv-empty-icon"><IconSend /></span>
              <h3>Erreur de chargement</h3>
              <p>{sentError}</p>
              <button
                className="inv-btn inv-btn--accept"
                onClick={() => sentInvitationsQuery.refetch()}
                type="button"
                style={{ marginTop: '0.5rem', flex: 'none', padding: '0.5rem 1.5rem' }}
              >
                R&eacute;essayer
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
              <span className="inv-empty-icon"><IconSend /></span>
              <h3>Aucune invitation envoy&eacute;e</h3>
              <p>Vos invitations envoy&eacute;es apparaîtront ici.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
});

InvitationsSection.displayName = 'InvitationsSection';

export default InvitationsSection;
