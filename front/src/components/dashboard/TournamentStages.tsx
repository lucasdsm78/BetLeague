/**
 * TournamentStages - Premium component for displaying tournament stages/bracket
 * Visualizes tournament progression with interactive design
 */

import React, { memo, useState, useEffect, useCallback } from 'react';
import { getTournamentStages, type TournamentStage } from '../../services/tournamentApi';
import { useToast } from '../../hooks/useToast';
import './TournamentStages.css';

interface TournamentStagesProps {
  tournamentId: number;
  tournamentName?: string;
}

// Stage type mapping for display
const STAGE_LABELS: Record<string, string> = {
  'final': 'Finale',
  'semi_final': 'Demi-finales',
  'quarter_final': 'Quarts de finale',
  'eighth_final': 'Huitièmes de finale',
  'round_16': '1/16ème de finale',
  'group': 'Phase de groupes',
  'qualifying': 'Qualifications',
};

const STAGE_ICONS: Record<string, string> = {
  'final': '🏆',
  'semi_final': '⭐',
  'quarter_final': '🥇',
  'eighth_final': '🥈',
  'round_16': '🥉',
  'group': '📊',
  'qualifying': '🎯',
};

const TournamentStages: React.FC<TournamentStagesProps> = memo(({
  tournamentId,
  tournamentName
}) => {
  const [stages, setStages] = useState<TournamentStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useToast();

  // Fetch stages on mount
  const fetchStages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getTournamentStages(tournamentId);
      setStages(response.stages || []);
    } catch (err: any) {
      console.error('Error fetching tournament stages:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Impossible de charger les étapes';
      setError(errorMessage);
      showError('Erreur', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId]); // Removed showError from deps - it's stable and doesn't need to trigger re-fetches

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  // Format date
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Non défini';
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get stage label
  const getStageLabel = (type: string): string => {
    return STAGE_LABELS[type] || type;
  };

  // Get stage icon
  const getStageIcon = (type: string): string => {
    return STAGE_ICONS[type] || '🎮';
  };

  // Sort stages by type (chronological order: eighth_final to final)
  const sortedStages = [...stages].sort((a, b) => {
    const order = ['eighth_final', 'quarter_final', 'semi_final', 'final', 'round_16', 'group', 'qualifying'];
    return order.indexOf(a.type) - order.indexOf(b.type);
  });

  return (
    <div className="tournament-stages">
      {/* Header */}
      <div className="stages-header">
        <h3 className="stages-title">
          <span className="stages-icon">🏆</span>
          Étapes du tournoi
          {tournamentName && <span className="tournament-name-small"> - {tournamentName}</span>}
        </h3>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="stages-loading">
          <div className="stages-spinner" />
          <p className="stages-loading-text">Chargement des étapes...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="stages-error">
          <span className="stages-error-icon">⚠️</span>
          <h4>Erreur de chargement</h4>
          <p>{error}</p>
          <button className="btn-retry-stages" onClick={fetchStages}>
            🔄 Réessayer
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && stages.length === 0 && (
        <div className="stages-empty">
          <span className="stages-empty-icon">🎯</span>
          <h4>Aucune étape créée</h4>
          <p>Le tournoi n'a pas encore commencé. Les étapes seront générées au lancement du tournoi.</p>
        </div>
      )}

      {/* Stages List */}
      {!isLoading && !error && stages.length > 0 && (
        <div className="stages-bracket">
          {sortedStages.map((stage, index) => (
            <div
              key={stage.id}
              className={`stage-card ${stage.is_active ? 'stage-active' : ''} ${stage.is_completed ? 'stage-completed' : ''}`}
            >
              {/* Stage Header */}
              <div className="stage-card-header">
                <div className="stage-type">
                  <span className="stage-type-icon">{getStageIcon(stage.type)}</span>
                  <span className="stage-type-label">{getStageLabel(stage.type)}</span>
                </div>

                <div className="stage-status">
                  {stage.is_completed && (
                    <span className="stage-badge stage-badge-completed">
                      ✓ Terminée
                    </span>
                  )}
                  {stage.is_active && !stage.is_completed && (
                    <span className="stage-badge stage-badge-active">
                      ⚡ En cours
                    </span>
                  )}
                  {!stage.is_active && !stage.is_completed && (
                    <span className="stage-badge stage-badge-upcoming">
                      ⏳ À venir
                    </span>
                  )}
                </div>
              </div>

              {/* Stage Info */}
              <div className="stage-card-body">
                <div className="stage-info-grid">
                  <div className="stage-info-item">
                    <span className="stage-info-label">Créée le</span>
                    <span className="stage-info-value">{formatDate(stage.created_at)}</span>
                  </div>

                  {stage.start_date && (
                    <div className="stage-info-item">
                      <span className="stage-info-label">Début</span>
                      <span className="stage-info-value">{formatDate(stage.start_date)}</span>
                    </div>
                  )}

                  {stage.end_date && (
                    <div className="stage-info-item">
                      <span className="stage-info-label">Fin</span>
                      <span className="stage-info-value">{formatDate(stage.end_date)}</span>
                    </div>
                  )}

                  <div className="stage-info-item">
                    <span className="stage-info-label">Organisateur</span>
                    <span className="stage-info-value stage-organizer">
                      <span className="organizer-icon">👤</span>
                      {stage.user_summary.username}
                    </span>
                  </div>
                </div>
              </div>

              {/* Connector to next stage */}
              {index < sortedStages.length - 1 && (
                <div className="stage-connector">
                  <div className="connector-line" />
                  <div className="connector-arrow">↓</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

TournamentStages.displayName = 'TournamentStages';

export default TournamentStages;
