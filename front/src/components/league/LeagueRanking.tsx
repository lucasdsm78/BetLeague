/**
 * Composant LeagueRanking - Affichage du classement des ligues
 * React TypeScript moderne, optimisé mobile, sécurisé et performant
 */

import React, { memo, useMemo, useCallback } from 'react';
import type { RankingEntry } from '../../types/ranking';
import { useLeagueRanking } from '../../hooks/useLeagueRanking';
import './LeagueRanking.css';

interface LeagueRankingProps {
  leagueId: number;
  leagueName?: string;
  className?: string;
  showStats?: boolean;
  onPlayerClick?: (pseudo: string, position: number) => void;
}

interface RankingEntryComponentProps {
  entry: RankingEntry;
  index: number;
  onPlayerClick?: (pseudo: string, position: number) => void;
}

const RankingEntryComponent: React.FC<RankingEntryComponentProps> = memo(({ entry, index, onPlayerClick }) => {
  const handleClick = useCallback(() => {
    onPlayerClick?.(entry.pseudo, entry.position);
  }, [entry.pseudo, entry.position, onPlayerClick]);

  const winRate = useMemo(() => {
    const total = entry.nb_win + entry.nb_lose;
    if (total === 0) return 0;
    return Math.round((entry.nb_win / total) * 100);
  }, [entry.nb_win, entry.nb_lose]);

  const winRateClass = useMemo(() => {
    if (winRate >= 75) return 'league-ranking__winrate--excellent';
    if (winRate >= 50) return 'league-ranking__winrate--good';
    return 'league-ranking__winrate--average';
  }, [winRate]);

  const isPodium = entry.position <= 3;
  const positionClass = useMemo(() => {
    if (entry.position === 1) return 'league-ranking__position--podium';
    if (entry.position === 2) return 'league-ranking__position--podium league-ranking__position--silver';
    if (entry.position === 3) return 'league-ranking__position--podium league-ranking__position--bronze';
    return '';
  }, [entry.position]);

  return (
    <div
      className={`league-ranking__entry ${isPodium ? 'league-ranking__entry--podium' : ''}`}
      onClick={handleClick}
      style={{ cursor: onPlayerClick ? 'pointer' : 'default', animationDelay: `${index * 0.1}s` }}
      role={onPlayerClick ? 'button' : undefined}
      tabIndex={onPlayerClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onPlayerClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={`league-ranking__position ${positionClass}`}>{entry.position}</div>
      <div className={`league-ranking__pseudo ${isPodium ? 'league-ranking__pseudo--podium' : ''}`}>{entry.pseudo}</div>
      <div className="league-ranking__btl">{entry.nb_btl.toLocaleString()} BTL</div>
      <div className="league-ranking__wins">{entry.nb_win}</div>
      <div className="league-ranking__losses">{entry.nb_lose}</div>
      <div className={`league-ranking__winrate ${winRateClass}`}>{winRate}%</div>
    </div>
  );
});

RankingEntryComponent.displayName = 'RankingEntryComponent';

const LeagueRanking: React.FC<LeagueRankingProps> = ({ leagueId, leagueName, className = '', showStats = true, onPlayerClick }) => {
  const { ranking, isLoading, error, refresh } = useLeagueRanking(leagueId);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
    } catch (err) {
      console.error('Erreur lors du rafraîchissement:', err);
    }
  }, [refresh]);

  const stats = useMemo(() => {
    if (!ranking || !ranking.entries.length) return null;

    const totalPlayers = ranking.entries.length;
    const totalBets = ranking.entries.reduce((sum, entry) => sum + entry.nb_win + entry.nb_lose, 0);
    const totalWins = ranking.entries.reduce((sum, entry) => sum + entry.nb_win, 0);
    const averageWinRate = totalBets > 0 ? Math.round((totalWins / totalBets) * 100) : 0;

    return { totalPlayers, totalBets, averageWinRate };
  }, [ranking]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="league-ranking__loading">
          <div className="league-ranking__spinner" aria-hidden="true"></div>
          Chargement du classement...
        </div>
      );
    }

    if (error) {
      return (
        <div className="league-ranking__error" role="alert">
          <strong>Erreur:</strong> {error}
        </div>
      );
    }

    if (!ranking || !ranking.entries.length) {
      return (
        <div className="league-ranking__empty">
          <p>Aucun classement disponible pour cette ligue.</p>
          <p>Les participants n'ont pas encore de statistiques.</p>
        </div>
      );
    }

    return (
      <>
        <div className="league-ranking__table" role="table" aria-label="Classement de la ligue">
          <div className="league-ranking__table-header" role="row">
            <div role="columnheader">Pos.</div>
            <div role="columnheader">Joueur</div>
            <div role="columnheader">Points</div>
            <div role="columnheader">Victoires</div>
            <div role="columnheader">Défaites</div>
            <div role="columnheader">% Réussite</div>
          </div>
          {ranking.entries.map((entry, index) => (
            <RankingEntryComponent
              key={`${entry.pseudo}-${entry.position}`}
              entry={entry}
              index={index}
              onPlayerClick={onPlayerClick}
            />
          ))}
        </div>

        {showStats && stats && (
          <div className="league-ranking__stats">
            <div className="league-ranking__stat">
              <span className="league-ranking__stat-value">{stats.totalPlayers}</span>
              <span className="league-ranking__stat-label">Joueurs</span>
            </div>
            <div className="league-ranking__stat">
              <span className="league-ranking__stat-value">{stats.totalBets.toLocaleString()}</span>
              <span className="league-ranking__stat-label">Paris totaux</span>
            </div>
            <div className="league-ranking__stat">
              <span className="league-ranking__stat-value">{stats.averageWinRate}%</span>
              <span className="league-ranking__stat-label">Taux moyen</span>
            </div>
          </div>
        )}
      </>
    );
  };

  if (!leagueId || leagueId <= 0) {
    return (
      <div className={`league-ranking ${className}`}>
        <div className="league-ranking__error" role="alert">
          ID de ligue invalide
        </div>
      </div>
    );
  }

  return (
    <div className={`league-ranking ${className}`}>
      <div className="league-ranking__header">
        <h2 className="league-ranking__title">
          <span className="league-ranking__trophy" aria-hidden="true">🏆</span>
          Classement {leagueName ? `- ${leagueName}` : ''}
        </h2>
        <button
          className="league-ranking__refresh"
          onClick={handleRefresh}
          disabled={isLoading}
          type="button"
          aria-label="Actualiser le classement"
        >
          <span aria-hidden="true">🔄</span>
          {isLoading ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {renderContent()}
    </div>
  );
};

export default memo(LeagueRanking);

