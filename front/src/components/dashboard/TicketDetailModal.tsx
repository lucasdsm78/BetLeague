import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CreateTicketModal.css';
import './TicketDetailSection.css';
import './TicketsSection.css';
import { useTicketDetail } from 'hooks/useTicketDetail';
import type { MatchChoiceSummary } from 'types/entities/ticket';
import { formatBetTypeLabel, formatChoiceLabelFr } from 'utils/oddsLabel';
import { formatMatchDateTime } from '../../utils/time';
import TicketShareSheet from './TicketShareSheet';

interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: number | string | null;
  onAskDelete?: (id: number) => void;
}

type NormalizedStatus = 'pending' | 'correct' | 'wrong';

const normalizeStatus = (status: string | null | undefined): NormalizedStatus => {
  const s = (status || '').toString().trim().toLowerCase();
  if (s === 'correct') return 'correct';
  if (s === 'wrong') return 'wrong';
  if (s === 'pending') return 'pending';
  return 'pending';
};

const statusToLabel = (status: string | null | undefined): string => {
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

const ChoiceRow: React.FC<{ choice: MatchChoiceSummary }> = ({ choice }) => {
  // Nouveau format (back): choice.choice est un libellé d'odd (ex: "Draw/Away", "Over 2.5").
  // Ancien format: '1'/'N'/'2'.
  const legacyLabel =
    choice.choice === '1'
      ? choice.match_summary.home_team
      : choice.choice === '2'
        ? choice.match_summary.away_team
        : choice.choice === 'N'
          ? 'Match nul'
          : '';

  const betTypeLabel = formatBetTypeLabel(choice.match_odd_summary ?? null);
  const translatedChoice = formatChoiceLabelFr({
    choice: choice.choice,
    betType: choice.match_odd_summary?.bet_type,
    teams: { home: choice.match_summary.home_team, away: choice.match_summary.away_team },
  });

  const teamChoice = translatedChoice || legacyLabel || choice.choice;
  // Le back peut renvoyer match_odd_summary (avec bet_name/bet_type) sur un match_choice.
  // Si absent, on fallback sur un label générique.

  const chipClass =
    normalizeStatus(choice.status) === 'correct'
      ? 'chip success'
      : normalizeStatus(choice.status) === 'wrong'
        ? 'chip danger'
        : 'chip';

  return (
    <li className="choice-row">
      <div className="teams">
        <span className="home">{choice.match_summary.home_team}</span>
        <span className="vs">vs</span>
        <span className="away">{choice.match_summary.away_team}</span>
      </div>
      <div className="meta">
        <span className="time">{formatMatchDateTime(choice.match_summary.time) || ''}</span>
      </div>
      <div className="selection">
        <span className={chipClass}>
          Sélection: <strong>{teamChoice}</strong>
          <span style={{ marginLeft: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>
            ({betTypeLabel})
          </span>
        </span>
      </div>
    </li>
  );
};

const TicketDetailModal: React.FC<TicketDetailModalProps> = ({ isOpen, onClose, ticketId, onAskDelete }) => {
  const { ticket, loading, error, refetch, lastUpdated } = useTicketDetail(ticketId ?? '');
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Lock scroll when modal is open (mobile-friendly)
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [isOpen]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  const leagueName = ticket?.league_summary?.name || 'Ligues';
  const isWin = ticket ? normalizeStatus(ticket.status) === 'correct' : false;
  const badgeClass =
    isWin
      ? 'badge badge-success'
      : normalizeStatus(ticket?.status) === 'wrong'
        ? 'badge badge-danger'
        : 'badge badge-warning';
  const statusLabel = statusToLabel(ticket?.status);
  const totalChoices = ticket?.match_choice_summaries?.length || 0;

  const summary = useMemo(() => {
    if (!ticket) return { mise: 0, gain: 0 };
    return { mise: ticket.mise || 0, gain: ticket.gain || 0 };
  }, [ticket]);

  if (!isOpen || ticketId == null) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-detail-title"
      onClick={handleOverlayClick}
    >
      <div ref={modalRef} className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div
          className="modal-header"
          style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-primary)' }}
        >
          <h3 id="ticket-detail-title">Détail du ticket</h3>
          <button ref={closeBtnRef} className="icon-btn" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="ticket-detail-section" style={{ paddingTop: 0 }}>
          <div className="section-header" style={{ marginBottom: '.5rem' }}>
            <div className="header-right">
              <button className="btn btn-outline btn-sm" onClick={refetch} disabled={loading}>
                {loading ? 'Rafraîchissement…' : 'Rafraîchir'}
              </button>
              {lastUpdated && (
                <span className="last-updated">Maj: {new Date(lastUpdated).toLocaleTimeString('fr-FR')}</span>
              )}
            </div>
          </div>

          {loading && !ticket && (
            <div className="detail-skeleton" aria-hidden="true">
              <div className="skeleton-bar title" />
              <div className="skeleton-card" />
              <div className="skeleton-list">
                <div className="skeleton-row" />
                <div className="skeleton-row" />
                <div className="skeleton-row" />
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-danger" role="alert">
              <span>Impossible de charger le ticket: {error}</span>
              <button className="btn btn-outline btn-sm" onClick={refetch}>
                Réessayer
              </button>
            </div>
          )}

          {ticket && (
            <>
              <header className="ticket-head">
                <div className="title">
                  <h2>Ticket #{ticket.id}</h2>
                  <span className="ticket-uuid">UUID: {ticket.uuid}</span>
                </div>
                <div className="status">
                  <span className={badgeClass}>{statusLabel}</span>
                  <span className="league">{leagueName}</span>
                </div>
              </header>

              <section className="ticket-summary-grid">
                <div className="summary-card">
                  <div className="label">Mise</div>
                  <div className="value">{summary.mise.toFixed(2)}€</div>
                </div>
                <div className="summary-card">
                  <div className="label">Gain {normalizeStatus(ticket.status) === 'pending' ? 'potentiel' : ''}</div>
                  <div className={`value ${normalizeStatus(ticket.status) === 'correct' ? 'win' : ''}`}>
                    {summary.gain.toFixed(2)}€
                  </div>
                </div>
                <div className="summary-card">
                  <div className="label">Sélections</div>
                  <div className="value">{totalChoices}</div>
                </div>
              </section>

              {isWin && (
                <section className="ticket-share-card">
                  <div className="ticket-share-copy">
                    <span className="ticket-share-badge">🏆 Ticket gagnant</span>
                    <h3>Partagez votre ticket</h3>
                    <p>Ouvrez le partage natif de votre mobile ou copiez le lien en un geste.</p>
                  </div>
                  <div className="ticket-share-actions">
                    <button className="btn btn-primary btn-share" onClick={() => setIsShareSheetOpen(true)}>
                      Partager ce ticket
                    </button>
                  </div>
                </section>
              )}

              <section className="choices-section">
                <h3>Sélections</h3>
                <ul className="choices-list">
                  {ticket.match_choice_summaries.map((mc: MatchChoiceSummary) => (
                    <ChoiceRow key={mc.id} choice={mc} />
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        <div
          className="modal-actions"
          style={{
            marginTop: '1rem',
            position: 'sticky',
            bottom: 0,
            background: 'var(--bg-primary)',
            padding: '1rem',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <button className="btn btn-outline" onClick={onClose}>
            Fermer
          </button>
          {ticket && isWin && (
            <button className="btn btn-secondary" onClick={() => setIsShareSheetOpen(true)}>
              Partager
            </button>
          )}
          {ticket && onAskDelete && (
            <button className="btn btn-danger" onClick={() => onAskDelete(ticket.id)}>
              Supprimer le ticket
            </button>
          )}
        </div>

        <TicketShareSheet
          isOpen={isShareSheetOpen}
          onClose={() => setIsShareSheetOpen(false)}
          ticket={ticket ? {
            uuid: ticket.uuid,
            gain: ticket.gain,
            leagueName: ticket.league_summary?.name,
            choices: ticket.match_choice_summaries.map((choice) => ({
              homeTeam: choice.match_summary.home_team,
              awayTeam: choice.match_summary.away_team,
              choice: choice.choice,
            })),
          } : null}
        />
      </div>
    </div>
  );
};

export default TicketDetailModal;

