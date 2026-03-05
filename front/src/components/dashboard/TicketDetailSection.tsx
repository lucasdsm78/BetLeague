import React, { memo, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './TicketDetailSection.css';
import { useTicketDetail } from 'hooks/useTicketDetail';
import type { MatchChoiceSummary } from '../../types/entities/ticket';
import { formatBetTypeLabel } from '../../utils/oddsLabel';
import type { ApiMatchOddReadModel } from '../../types/api/matches';

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
    case 'pending': return 'En cours';
    case 'correct': return 'Gagné';
    case 'wrong': return 'Perdu';
    default: return 'En cours';
  }
};

const ChoiceRow: React.FC<{ choice: MatchChoiceSummary }> = ({ choice }) => {
  const legacyLabel = choice.choice === '1'
    ? choice.match_summary.home_team
    : choice.choice === '2'
      ? choice.match_summary.away_team
      : choice.choice === 'N'
        ? 'Match nul'
        : '';
  const teamChoice = legacyLabel || choice.choice;

  const status = normalizeStatus(choice.status);
  const chipClass = status === 'correct'
    ? 'chip success'
    : status === 'wrong'
    ? 'chip danger'
    : 'chip';

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('fr-FR', options);
  };

  const betTypeLabel = formatBetTypeLabel(
    (choice as unknown as { match_odd_summary?: Pick<ApiMatchOddReadModel, 'bet_name' | 'bet_type'> })?.match_odd_summary
  );

  return (
    <li className="choice-row">
      <div className="teams">
        <span className="home">{choice.match_summary.home_team}</span>
        <span className="vs">VS</span>
        <span className="away">{choice.match_summary.away_team}</span>
      </div>
      <div className="meta">
        <span className="time">{formatDate(choice.match_summary.time)}</span>
        {choice.match_summary.winner && (
          <span className="winner">Résultat: {choice.match_summary.winner}</span>
        )}
      </div>
      <div className="selection">
        <span className={chipClass}>
          <strong>{teamChoice}</strong>
          <span style={{ marginLeft: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>
            ({betTypeLabel})
          </span>
        </span>
      </div>
    </li>
  );
};

ChoiceRow.displayName = 'ChoiceRow';

const TicketDetailSection: React.FC = memo(() => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { ticket, loading, error, refetch, lastUpdated } = useTicketDetail(ticketId ?? '');

  const leagueName = ticket?.league_summary?.name || 'Ligues';
  const isWin = ticket ? normalizeStatus(ticket.status) === 'correct' : false;
  const badgeClass = isWin ? 'badge badge-success' : normalizeStatus(ticket?.status) === 'wrong' ? 'badge badge-danger' : 'badge badge-warning';
  const statusLabel = statusToLabel(ticket?.status);

  const totalChoices = ticket?.match_choice_summaries?.length || 0;

  const summary = useMemo(() => {
    if (!ticket) return { mise: 0, gain: 0 };
    return { mise: ticket.mise || 0, gain: ticket.gain || 0 };
  }, [ticket]);

  return (
    <div className="ticket-detail-section">
      <div className="section-header">
        <button className="btn btn-outline" onClick={() => navigate(-1)} aria-label="Retour">← Retour</button>
        <div className="header-right">
          <button className="btn btn-secondary btn-sm" onClick={refetch} disabled={loading}>
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
          <button className="btn btn-outline btn-sm" onClick={refetch}>Réessayer</button>
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
              <div className={`value ${normalizeStatus(ticket.status) === 'correct' ? 'win' : ''}`}>{summary.gain.toFixed(2)}€</div>
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

          <footer className="detail-actions">
            <button className="btn btn-primary" onClick={() => navigate('/tickets')}>Retour aux tickets</button>
          </footer>
        </>
      )}
    </div>
  );
});

TicketDetailSection.displayName = 'TicketDetailSection';

export default TicketDetailSection;

