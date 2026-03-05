import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import './CreateTicketModal.css';
import './TicketDetailSection.css';
import './TicketsSection.css';
import { useTicketDetail } from 'hooks/useTicketDetail';
import type { MatchChoiceSummary } from 'types/entities/ticket';
import { useMatchOddsByMatchIds } from 'hooks/useMatchOddsByMatchIds';
import type { ApiMatchOddReadModel } from 'types/api/matches';

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

const groupOddsByBetType = (odds: ApiMatchOddReadModel[]): Record<string, ApiMatchOddReadModel[]> => {
  const out: Record<string, ApiMatchOddReadModel[]> = {};
  for (const o of odds) {
    const key = String(o.bet_type || 'UNKNOWN');
    (out[key] ||= []).push(o);
  }
  return out;
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
  const teamChoice = legacyLabel || choice.choice;

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
        <span className="time">{new Date(choice.match_summary.time).toLocaleString('fr-FR')}</span>
      </div>
      <div className="selection">
        <span className={chipClass}>
          Sélection: <strong>{teamChoice}</strong>
        </span>
      </div>
    </li>
  );
};

const TicketDetailModal: React.FC<TicketDetailModalProps> = ({ isOpen, onClose, ticketId, onAskDelete }) => {
  const { ticket, loading, error, refetch, lastUpdated } = useTicketDetail(ticketId ?? '');

  const matchIds = useMemo(
    () => (ticket?.match_choice_summaries ?? []).map((mc) => mc.match_summary.id),
    [ticket]
  );
  const { oddsByMatchId } = useMatchOddsByMatchIds(matchIds);

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

              <section className="choices-section">
                <h3>Sélections</h3>
                <ul className="choices-list">
                  {ticket.match_choice_summaries.map((mc: MatchChoiceSummary) => (
                    <ChoiceRow key={mc.id} choice={mc} />
                  ))}
                </ul>
              </section>

              <section className="choices-section">
                <h3>Types de paris & autres cotes</h3>
                <div className="choices-list" style={{ display: 'grid', gap: '0.75rem' }}>
                  {(ticket.match_choice_summaries ?? []).map((mc: MatchChoiceSummary) => {
                    const odds = oddsByMatchId[mc.match_summary.id] || [];
                    if (odds.length === 0) return null;

                    // On essaye d'identifier le market correspondant  e0 la selection via value.
                    const selected = odds.find((o) => o.value === mc.choice);
                    const betType = selected?.bet_type ?? 'UNKNOWN';
                    const betName = selected?.bet_name ?? 'Pari';
                    const grouped = groupOddsByBetType(odds);
                    const sameMarket = grouped[betType] ?? [];

                    return (
                      <div key={`market-${mc.id}`} className="choice-row" style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{mc.match_summary.home_team} vs {mc.match_summary.away_team}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{betName} ({betType})</div>
                          </div>
                          <div className="chip choice" style={{ alignSelf: 'flex-start' }}>
                            Choisie: <strong>{mc.choice}</strong>
                          </div>
                        </div>

                        {sameMarket.length > 0 && (
                          <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.4rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Autres cotes disponibles</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {sameMarket.map((o) => (
                                <span
                                  key={o.id}
                                  className="chip"
                                  style={{
                                    borderColor: o.id === selected?.id ? 'var(--primary-color)' : undefined,
                                    background: o.id === selected?.id ? 'rgba(0, 210, 255, 0.12)' : undefined,
                                  }}
                                >
                                  {o.value} <strong style={{ marginLeft: 6 }}>{Number(o.odd).toFixed(2)}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
          {ticket && onAskDelete && (
            <button className="btn btn-danger" onClick={() => onAskDelete(ticket.id)}>
              Supprimer le ticket
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketDetailModal;

