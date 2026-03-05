import React, { memo } from 'react';
import type { BetSelection } from '../../../types/entities/betting';

export interface BetSidebarDesktopProps {
  selectedBets: BetSelection[];
  onRemoveBet: (index: number) => void;
  onClearAll: () => void;
  leagues: any[];
  selectedLeagueId: number | null;
  onLeagueChange: (leagueId: number | null) => void;
  balance: number | null;
  tournamentMatches: any[];
  selectedTournamentMatchId: string;
  onTournamentChange: (value: string) => void;
  tournamentBalance: number | null;
  stake: string;
  onStakeChange: (stake: string) => void;
  onCreateTicket: () => void;
  isSubmitting: boolean;
  error: string | null;
  isValid: boolean;
  totalOdds: number;
  potentialWin: number;
}

const BetSidebarDesktop = memo<BetSidebarDesktopProps>(function BetSidebarDesktop(props) {
  const {
    selectedBets,
    onRemoveBet,
    onClearAll,
    leagues,
    selectedLeagueId,
    onLeagueChange,
    balance,
    tournamentMatches,
    selectedTournamentMatchId,
    onTournamentChange,
    tournamentBalance,
    stake,
    onStakeChange,
    onCreateTicket,
    isSubmitting,
    error,
    isValid,
    totalOdds,
    potentialWin,
  } = props;

  const stakeNumber = Number(stake || '0');

  return (
    <aside className="bet-sidebar desktop">
      <div className="sidebar-header">
        <h3>Mon ticket</h3>
        {selectedBets.length > 0 && (
          <button className="clear-btn" onClick={onClearAll} disabled={isSubmitting}>
            Tout effacer
          </button>
        )}
      </div>

      <div className="selected-bets">
        {selectedBets.length === 0 ? (
          <div className="empty-bet">
            <span className="empty-icon">🎫</span>
            <p>Sélectionne des cotes pour créer ton ticket</p>
          </div>
        ) : (
          selectedBets.map((bet, idx) => (
            <div key={`${bet.matchId}-${bet.betType}-${idx}`} className="bet-item">
              <div className="bet-info">
                <div className="bet-teams">
                  {bet.homeTeam} - {bet.awayTeam}
                </div>
                <div className="bet-meta">
                  <span className="bet-type">{bet.betType === 'home' ? '1' : bet.betType === 'draw' ? 'N' : '2'}</span>
                  <span className="bet-odd">{bet.odd.toFixed(2)}</span>
                </div>
              </div>
              <button
                className="remove-btn"
                onClick={() => onRemoveBet(idx)}
                disabled={isSubmitting}
                aria-label="Supprimer ce pari"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="bet-form">
        {/* Choix mode : league ou tournoi */}
        <div className="select-group">
          <label className="select-label">Ligue</label>
          <select
            className="select-field"
            value={selectedLeagueId ?? ''}
            onChange={(e) => onLeagueChange(e.target.value ? Number(e.target.value) : null)}
            disabled={isSubmitting || selectedTournamentMatchId !== ''}
          >
            <option value="">Choisir une ligue</option>
            {leagues.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {selectedLeagueId && balance != null && (
            <div className="balance-indicator">Solde : {balance} BTL</div>
          )}
        </div>

        <div className="select-group">
          <label className="select-label">Tournoi</label>
          <select
            className="select-field"
            value={selectedTournamentMatchId}
            onChange={(e) => onTournamentChange(e.target.value)}
            disabled={isSubmitting || selectedBets.length === 0}
          >
            <option value="">Choisir un match de tournoi</option>
            {tournamentMatches.map((m: any) => (
              <option key={`${m.tournament_id}-${m.match_id}`} value={`${m.tournament_id}-${m.match_id}`}>
                {m.label ?? `Tournoi ${m.tournament_id} - Match ${m.match_id}`}
              </option>
            ))}
          </select>
          {selectedTournamentMatchId && tournamentBalance != null && (
            <div className="balance-indicator">Solde tournoi : {tournamentBalance} BTL</div>
          )}
        </div>

        <div className="stake-group">
          <label className="stake-label">Mise</label>
          <div className="stake-input-wrapper">
            <input
              className="stake-input"
              placeholder="0"
              value={stake}
              onChange={(e) => onStakeChange(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={isSubmitting}
              inputMode="numeric"
            />
            <span className="input-suffix">BTL</span>
          </div>
          {balance !== null && stakeNumber > balance && <p className="input-error">Mise supérieure au solde disponible</p>}
        </div>

        <div className="summary-card">
          <div className="summary-row">
            <span className="summary-label">Cote totale</span>
            <span className="summary-value">{totalOdds.toFixed(2)}</span>
          </div>
          <div className="summary-row highlight">
            <span className="summary-label">Gain potentiel</span>
            <span className="summary-value">{potentialWin.toFixed(2)} BTL</span>
          </div>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <button className="create-ticket-btn" onClick={onCreateTicket} disabled={!isValid || isSubmitting || selectedBets.length === 0}>
          {isSubmitting ? 'Création en cours...' : 'Créer le ticket'}
        </button>
      </div>
    </aside>
  );
});

export default BetSidebarDesktop;

