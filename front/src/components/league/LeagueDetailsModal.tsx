import React, { memo, useEffect, useState, useCallback } from 'react';
import leagueApiService from '../../services/leagueApiService';
import './LeagueDetailsModal.css';

// Types for league details based on backend LeagueReadModel
interface LeagueDetailData {
    id: number;
    name: string;
    uuid?: string;
    is_free?: boolean;
    start_date: number;
    end_date?: number;
    max_players?: number;
    is_started?: boolean;
    nb_players_remaining?: number;
    user_creator?: {
        id: number;
        pseudo: string;
    };
}

interface LeagueDetailsModalProps {
  isOpen: boolean;
  leagueId: number | null;
  onClose: () => void;
  onJoined?: () => void;
}

const LeagueDetailsModal: React.FC<LeagueDetailsModalProps> = memo(({ isOpen, leagueId, onClose, onJoined }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<LeagueDetailData | null>(null);
  const [joining, setJoining] = useState(false);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px'; // Prevent layout shift
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const loadDetails = useCallback(async () => {
    if (!isOpen || !leagueId) return;
    setLoading(true);
    setError(null);
    setDetails(null);
    try {
      const res = await leagueApiService.getLeagueDetails(leagueId);
      if (res.success && res.data) {
        setDetails(res.data);
      } else {
        setError(res.error || 'Impossible de charger les détails de la ligue');
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement des détails');
    } finally {
      setLoading(false);
    }
  }, [isOpen, leagueId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const canJoin = details && !details.is_started && (details.nb_players_remaining === undefined || details.nb_players_remaining > 0);

  const handleJoin = async () => {
    if (!details || joining || !canJoin) return;
    setJoining(true);
    setError(null);
    try {
      const res = await leagueApiService.joinLeague(details.id);
      if (!res.success) {
        setError(res.error || 'Impossible de rejoindre la ligue');
        setJoining(false);
      } else {
        // Close modal first
        onClose();
        // Then reload page
        window.location.reload();
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la tentative de rejoindre la ligue');
      setJoining(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Date non définie';
    }
  };

  const getStatusInfo = () => {
    if (!details) return { label: 'En attente', color: 'var(--text-secondary)', icon: '⚪' };

    if (details.is_started) {
      return { label: 'En cours', color: 'var(--success-color)', icon: '🟢' };
    }
    if (details.start_date && details.start_date > Date.now()) {
      return { label: 'À venir', color: 'var(--warning-color)', icon: '🟡' };
    }
    return { label: 'En attente', color: 'var(--text-secondary)', icon: '⚪' };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="league-modal-overlay" onClick={onClose}>
      <div className="league-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Loading State */}
        {loading && (
          <div className="league-modal-loading">
            <div className="loading-spinner-large"></div>
            <p>Chargement des détails de la ligue...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="league-modal-error">
            <span className="error-icon">⚠️</span>
            <h3>Erreur</h3>
            <p>{error}</p>
            <div className="error-actions">
              <button className="btn btn-secondary" onClick={() => loadDetails()}>
                Réessayer
              </button>
              <button className="btn btn-outline" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && details && (
          <>
            {/* Modal Header */}
            <div className="league-modal-header">
              <div className="league-title-section">
                <h2 className="league-title">{details.name}</h2>
                <div className="league-status" style={{ color: statusInfo.color }}>
                  <span className="status-icon">{statusInfo.icon}</span>
                  {statusInfo.label}
                </div>
              </div>
              <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">
                ✕
              </button>
            </div>

            {/* League Stats */}
            <div className="league-stats-modal">
              <div className="stat-card-modal">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {details.max_players ?
                      `${details.max_players - (details.nb_players_remaining || 0)}/${details.max_players}`
                      : 'N/A'
                    }
                  </div>
                  <div className="stat-label">Participants</div>
                </div>
              </div>

              <div className="stat-card-modal">
                <div className="stat-icon">📅</div>
                <div className="stat-content">
                  <div className="stat-value">{formatDate(details.start_date)}</div>
                  <div className="stat-label">Date de début</div>
                </div>
              </div>

              {details.end_date && (
                <div className="stat-card-modal">
                  <div className="stat-icon">🏁</div>
                  <div className="stat-content">
                    <div className="stat-value">{formatDate(details.end_date)}</div>
                    <div className="stat-label">Date de fin</div>
                  </div>
                </div>
              )}

              <div className="stat-card-modal">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <div className="stat-value">
                    {details.is_free ? 'Gratuite' : 'Payante'}
                  </div>
                  <div className="stat-label">Type de ligue</div>
                </div>
              </div>

              {details.nb_players_remaining !== undefined && (
                <div className="stat-card-modal">
                  <div className="stat-icon">🆓</div>
                  <div className="stat-content">
                    <div className="stat-value">{details.nb_players_remaining}</div>
                    <div className="stat-label">Places restantes</div>
                  </div>
                </div>
              )}

              {details.user_creator && (
                <div className="stat-card-modal">
                  <div className="stat-icon">👤</div>
                  <div className="stat-content">
                    <div className="stat-value">{details.user_creator.pseudo}</div>
                    <div className="stat-label">Créée par</div>
                  </div>
                </div>
              )}

              {details.uuid && (
                <div className="stat-card-modal full-width">
                  <div className="stat-icon">🔗</div>
                  <div className="stat-content">
                    <div className="stat-value code-value">{details.uuid}</div>
                    <div className="stat-label">Code de la ligue</div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="league-modal-actions">
              {canJoin && (
                <button
                  className="btn btn-primary"
                  onClick={handleJoin}
                  disabled={joining}
                >
                  {joining ? (
                    <>
                      <span className="loading-spinner"></span>
                      Rejoindre...
                    </>
                  ) : (
                    'Rejoindre la ligue'
                  )}
                </button>
              )}
              <button className="btn btn-outline" onClick={onClose}>
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

LeagueDetailsModal.displayName = 'LeagueDetailsModal';

export default LeagueDetailsModal;

