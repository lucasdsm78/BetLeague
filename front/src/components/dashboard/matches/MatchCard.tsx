import React, { memo, useCallback, useMemo, useState } from 'react';
import type { BetType, BetSelection } from '../../../types/entities/betting';
import { getBetTypeLabelFr, formatChoiceLabelFr } from '../../../utils/oddsLabel';

export type UiMatchStatus = 'upcoming' | 'live' | 'finished';

export interface UiMatchOdds {
  home: number;
  draw: number;
  away: number;
}

export interface UiMatchScore {
  home: number;
  away: number;
}

export interface UiOddItem {
  id?: number;
  betType: string; // market key
  betName: string; // market display name
  value: string; // option
  odd: number;
  result?: string | null;
  matchOddId?: number; // alias explicite
}

export interface UiMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string; // ISO
  status: UiMatchStatus;
  odds: UiMatchOdds;
  trending?: boolean;
  score?: UiMatchScore;
  minute?: number;
  oddsAll?: UiOddItem[];
}

export interface MatchCardProps {
  match: UiMatch;
  onAddToBet: (bet: BetSelection) => void;
}

function formatOdd(v: number): string {
  if (!Number.isFinite(v) || v <= 1) return '—';
  return v.toFixed(2);
}

function isOddSelectable(v: number): boolean {
  return Number.isFinite(v) && v > 1;
}

const MatchCard = memo<MatchCardProps>(function MatchCard({ match, onAddToBet }) {
  const formatTime = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (date.toDateString() === tomorrow.toDateString()) return 'Demain';

    return date.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' });
  }, []);

  const handleOddClick = useCallback(
    (type: BetType, odd: number) => {
      const winnerOdds = (match.oddsAll || []).filter(
        (o) => (o.betType || '').toUpperCase().includes('MATCH_WINNER')
      );
      const matchingOdd = winnerOdds.find(
        (o) => (o.value || '').toLowerCase() === type
      );

      onAddToBet({
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        betType: type,
        odd,
        competition: match.competition,
        matchOddId: matchingOdd?.matchOddId ?? matchingOdd?.id,
      });
    },
    [match, onAddToBet]
  );

  const disabledByStatus = match.status === 'live' || match.status === 'finished';
  const oddsAvailable =
    isOddSelectable(match.odds.home) || isOddSelectable(match.odds.draw) || isOddSelectable(match.odds.away);

  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const oddsByMarket = useMemo(() => {
    const items = Array.isArray(match.oddsAll) ? match.oddsAll : [];
    const map = new Map<string, { label: string; items: UiOddItem[] }>();

    for (const o of items) {
      const key = (o.betType || '').trim();
      if (!key || key.toUpperCase().includes('MATCH_WINNER')) continue;
      if (!map.has(key)) {
        map.set(key, { label: o.betName || key, items: [] });
      }
      map.get(key)!.items.push(o);
    }

    // stable order: by label
    return Array.from(map.entries())
      .map(([k, v]) => ({ marketKey: k, marketLabel: v.label, items: v.items }))
      .sort((a, b) => a.marketLabel.localeCompare(b.marketLabel));
  }, [match.oddsAll]);

  const handleMarketOddClick = useCallback(
    (matchOddId: number | undefined, marketKey: string, marketLabel: string, marketValue: string, odd: number) => {
      if (!matchOddId || matchOddId <= 0) return;

      const frMarketLabel = getBetTypeLabelFr(marketKey) || marketLabel || marketKey;
      const frChoice = formatChoiceLabelFr({
        choice: marketValue,
        betType: marketKey,
        teams: { home: match.homeTeam, away: match.awayTeam },
      });

      onAddToBet({
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: match.competition,
        marketKey,
        marketLabel: frMarketLabel,
        marketValue,
        selectionLabel: frMarketLabel ? `${frMarketLabel}: ${frChoice || marketValue}` : (frChoice || marketValue),
        odd,
        matchOddId,
      });
    },
    [match, onAddToBet]
  );

  return (
    <div className={`match-card ${match.status}`}>
      {match.trending && <div className="trending-badge">🔥 Tendance</div>}

      {!oddsAvailable && (
        <div className="odds-unavailable-badge" aria-label="Cotes indisponibles">
          Cotes indisponibles
        </div>
      )}

      <div className="match-header">
        <div className="match-info">
          <span className="competition">{match.competition}</span>
          <div className="match-time">
            {match.status === 'live' ? (
              <span className="live-indicator">
                <span className="live-dot"></span>
                {match.minute ?? 0}'
              </span>
            ) : (
              <>
                <span className="date">{formatDate(match.kickoff)}</span>
                <span className="time">{formatTime(match.kickoff)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="teams-section">
        <div className="team home-team">
          <span className="team-name">{match.homeTeam}</span>
          {match.score && <span className="score">{match.score.home}</span>}
        </div>

        <div className="vs-separator">{match.status === 'live' ? 'LIVE' : 'vs'}</div>

        <div className="team away-team">
          {match.score && <span className="score">{match.score.away}</span>}
          <span className="team-name">{match.awayTeam}</span>
        </div>
      </div>

      <div className="odds-section">
        {/* 1X2 quick pick */}
        <button
          className="odd-button home"
          onClick={() => handleOddClick('home', match.odds.home)}
          disabled={disabledByStatus || !isOddSelectable(match.odds.home)}
          aria-label={`Parier sur ${match.homeTeam} (1) cote ${formatOdd(match.odds.home)}`}
        >
          <span className="odd-label">1</span>
          <span className="odd-value">{formatOdd(match.odds.home)}</span>
        </button>

        <button
          className="odd-button draw"
          onClick={() => handleOddClick('draw', match.odds.draw)}
          disabled={disabledByStatus || !isOddSelectable(match.odds.draw)}
          aria-label={`Parier sur le nul (N) cote ${formatOdd(match.odds.draw)}`}
        >
          <span className="odd-label">N</span>
          <span className="odd-value">{formatOdd(match.odds.draw)}</span>
        </button>

        <button
          className="odd-button away"
          onClick={() => handleOddClick('away', match.odds.away)}
          disabled={disabledByStatus || !isOddSelectable(match.odds.away)}
          aria-label={`Parier sur ${match.awayTeam} (2) cote ${formatOdd(match.odds.away)}`}
        >
          <span className="odd-label">2</span>
          <span className="odd-value">{formatOdd(match.odds.away)}</span>
        </button>
      </div>

      {/* Other markets */}
      {oddsByMarket.length > 0 && (
        <div className="more-odds">
          <button
            type="button"
            className="more-odds-toggle"
            onClick={() => setIsMoreOpen((v) => !v)}
            aria-expanded={isMoreOpen}
          >
            {isMoreOpen ? 'Masquer les autres cotes' : 'Voir les autres cotes'}
          </button>

          {isMoreOpen && (
            <div className="more-odds-content">
              {oddsByMarket.map((mkt) => {
                const frMarketTitle = getBetTypeLabelFr(mkt.marketKey) || mkt.marketLabel;
                return (
                  <div key={mkt.marketKey} className="market-block">
                    <div className="market-title">{frMarketTitle}</div>
                    <div className="market-odds-grid">
                      {mkt.items.map((o) => {
                        const frValueLabel = formatChoiceLabelFr({
                          choice: o.value,
                          betType: mkt.marketKey,
                          teams: { home: match.homeTeam, away: match.awayTeam },
                        });

                        return (
                          <button
                            key={`${mkt.marketKey}:${o.value}:${o.id ?? ''}`}
                            type="button"
                            className="market-odd"
                            onClick={() =>
                              handleMarketOddClick(o.matchOddId ?? o.id, mkt.marketKey, mkt.marketLabel, o.value, o.odd)
                            }
                            disabled={disabledByStatus || !isOddSelectable(o.odd)}
                            aria-label={`Parier sur ${frMarketTitle} - ${frValueLabel || o.value} cote ${formatOdd(o.odd)}`}
                          >
                            <span className="market-odd-label">{frValueLabel || o.value}</span>
                            <span className="market-odd-value">{formatOdd(o.odd)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default MatchCard;

