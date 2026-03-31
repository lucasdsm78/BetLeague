import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import './TicketDetailSection.css';
import type { MatchChoiceSummary, SharedTicketReadModel } from '../../types/entities/ticket';
import { getSharedTicketDetail } from '../../services/api/tickets';
import { formatBetTypeLabel, formatChoiceLabelFr } from '../../utils/oddsLabel';
import { formatMatchDateTime } from '../../utils/time';
import { shareWinningTicket } from '../../utils/ticketShare';
import { useGlobalToast } from '../../toast/ToastProvider';

type NormalizedStatus = 'pending' | 'correct' | 'wrong';

const normalizeStatus = (status: string | null | undefined): NormalizedStatus => {
  const s = (status || '').toString().trim().toLowerCase();
  if (s === 'correct') return 'correct';
  if (s === 'wrong') return 'wrong';
  return 'pending';
};

const statusToLabel = (status: string | null | undefined): string => {
  switch (normalizeStatus(status)) {
    case 'correct':
      return 'Gagné';
    case 'wrong':
      return 'Perdu';
    default:
      return 'En cours';
  }
};

const SharedChoiceRow: React.FC<{ choice: MatchChoiceSummary }> = ({ choice }) => {
  const translatedChoice = formatChoiceLabelFr({
    choice: choice.choice,
    betType: choice.match_odd_summary?.bet_type,
    teams: { home: choice.match_summary.home_team, away: choice.match_summary.away_team },
  });
  const legacyLabel = choice.choice === '1'
    ? choice.match_summary.home_team
    : choice.choice === '2'
      ? choice.match_summary.away_team
      : choice.choice === 'N'
        ? 'Match nul'
        : '';
  const teamChoice = translatedChoice || legacyLabel || choice.choice;
  const betTypeLabel = formatBetTypeLabel(choice.match_odd_summary ?? null);
  const chipClass = normalizeStatus(choice.status) === 'correct'
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

const SharedTicketSection: React.FC = memo(() => {
  const { ticketUuid } = useParams();
  const [ticket, setTicket] = useState<SharedTicketReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { showSuccess, showError } = useGlobalToast();

  const fetchDetail = useCallback(async () => {
    if (!ticketUuid) return;
    setLoading(true);
    setError(null);

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const data = await getSharedTicketDetail(ticketUuid, { signal: abortRef.current.signal });
      setTicket(data);
      setLastUpdated(Date.now());
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'Erreur lors du chargement du ticket partagé');
    } finally {
      setLoading(false);
    }
  }, [ticketUuid]);

  useEffect(() => {
    fetchDetail();
    return () => abortRef.current?.abort();
  }, [fetchDetail]);

  const summary = useMemo(() => ({
    mise: ticket?.mise || 0,
    gain: ticket?.gain || 0,
  }), [ticket]);

  const leagueName = ticket?.league_summary?.name || 'Ticket BetLeague';
  const badgeClass = normalizeStatus(ticket?.status) === 'correct' ? 'badge badge-success' : 'badge badge-warning';
  const totalChoices = ticket?.match_choice_summaries?.length || 0;

  const handleShare = useCallback(async () => {
    if (!ticket) return;
    setIsSharing(true);
    try {
      const result = await shareWinningTicket({
        ticketUuid: ticket.uuid,
        gain: ticket.gain,
        leagueName: ticket.league_summary?.name,
      });
      showSuccess(
        result.method === 'native' ? 'Partage ouvert' : 'Lien copié',
        result.method === 'native' ? 'Choisissez votre réseau social pour partager ce ticket.' : 'Le lien du ticket gagné a été copié.',
      );
    } catch (e: any) {
      showError('Partage impossible', e?.message || 'Impossible de partager ce ticket pour le moment.');
    } finally {
      setIsSharing(false);
    }
  }, [ticket, showError, showSuccess]);

  return (
    <div className="ticket-detail-section ticket-detail-section--shared">
      <div className="section-header">
        <Link to="/" className="btn btn-outline" aria-label="Retour à l'accueil">← Accueil</Link>
        <div className="header-right">
          <button className="btn btn-secondary btn-sm" onClick={fetchDetail} disabled={loading}>
            {loading ? 'Rafraîchissement…' : 'Rafraîchir'}
          </button>
          {lastUpdated && <span className="last-updated">Maj: {new Date(lastUpdated).toLocaleTimeString('fr-FR')}</span>}
        </div>
      </div>

      {loading && !ticket && (
        <div className="detail-skeleton" aria-hidden="true">
          <div className="skeleton-bar title" />
          <div className="skeleton-card" />
          <div className="skeleton-list">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{error}</span>
          <button className="btn btn-outline btn-sm" onClick={fetchDetail}>Réessayer</button>
        </div>
      )}

      {ticket && (
        <>
          <header className="ticket-head">
            <div className="title">
              <h2>Ticket gagnant partagé</h2>
              <span className="ticket-uuid">UUID: {ticket.uuid}</span>
            </div>
            <div className="status">
              <span className={badgeClass}>{statusToLabel(ticket.status)}</span>
              <span className="league">{leagueName}</span>
            </div>
          </header>

          <section className="ticket-summary-grid">
            <div className="summary-card">
              <div className="label">Mise</div>
              <div className="value">{summary.mise.toFixed(2)}€</div>
            </div>
            <div className="summary-card">
              <div className="label">Gain</div>
              <div className="value win">{summary.gain.toFixed(2)}€</div>
            </div>
            <div className="summary-card">
              <div className="label">Sélections</div>
              <div className="value">{totalChoices}</div>
            </div>
          </section>

          <section className="ticket-share-card">
            <div className="ticket-share-copy">
              <span className="ticket-share-badge">🏆 Ticket gagné</span>
              <h3>Partagez cette victoire</h3>
              <p>Diffusez ce ticket sur WhatsApp, X, Instagram ou copiez simplement le lien.</p>
            </div>
            <div className="ticket-share-actions">
              <button className="btn btn-primary btn-share" onClick={handleShare} disabled={isSharing}>
                {isSharing ? 'Partage…' : 'Partager ce ticket'}
              </button>
            </div>
          </section>

          <section className="choices-section">
            <h3>Sélections</h3>
            <ul className="choices-list">
              {ticket.match_choice_summaries.map((mc) => (
                <SharedChoiceRow key={mc.id} choice={mc} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
});

SharedTicketSection.displayName = 'SharedTicketSection';

export default SharedTicketSection;

