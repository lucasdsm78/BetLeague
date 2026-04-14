import React, { memo, useEffect, useState, useCallback } from 'react';
import { getLeagueDetails, joinLeague } from '../../services/api/leagues';
import type { ApiLeagueDetail } from '../../types/api';
import { formatTicketAmount } from '../../utils/ticketAmount';
import './LeagueDetailsModal.css';

interface LeagueDetailsModalProps {
  isOpen: boolean;
  leagueId: number | null;
  onClose: () => void;
}

const LeagueDetailsModal: React.FC<LeagueDetailsModalProps> = memo(({ isOpen, leagueId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<ApiLeagueDetail | null>(null);
  const [joining, setJoining] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
      const data = await getLeagueDetails(leagueId);
      setDetails(data);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement des détails');
    } finally {
      setLoading(false);
    }
  }, [isOpen, leagueId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const canJoin = details && details.status !== 'CLOSED' && !details.is_started && (details.nb_players_remaining === undefined || details.nb_players_remaining > 0);

  const handleJoin = async () => {
    if (!details || joining || !canJoin) return;
    setJoining(true);
    setError(null);
    try {
      const _ = await joinLeague(details.id);
      onClose();
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la tentative de rejoindre la ligue');
      setJoining(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setCopyStatus('idle');
    }
  }, [isOpen]);

  const buildShareUrl = useCallback((): string => {
    // Share only a league identifier, never user data.
    const url = new URL(window.location.href);
    if (leagueId) {
      url.searchParams.set('leagueId', String(leagueId));
    }
    return url.toString();
  }, [leagueId]);

  const copyToClipboard = useCallback(async (text: string) => {
    // Prefer modern, secure Clipboard API when available.
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback for older browsers / non-secure contexts.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!ok) {
      throw new Error('copy_failed');
    }
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      const url = buildShareUrl();
      await copyToClipboard(url);
      setCopyStatus('success');
      window.setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (e) {
      console.warn('Failed to copy league link:', e);
      setCopyStatus('error');
      window.setTimeout(() => setCopyStatus('idle'), 2500);
    }
  }, [buildShareUrl, copyToClipboard]);

  if (!isOpen) return null;

  const toEpochMs = (timestamp: string | number | null | undefined): number | null => {
    if (timestamp === null || timestamp === undefined) return null;
    const parsed = typeof timestamp === 'string' ? Number(timestamp) : timestamp;
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatDate = (timestamp: string | number | null | undefined) => {
    const epochMs = toEpochMs(timestamp);
    if (epochMs === null) {
      return 'Date non définie';
    }

    try {
      return new Date(epochMs).toLocaleDateString('fr-FR', {
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

    const startDateMs = toEpochMs(details.start_date);

    if (details.status === 'CLOSED') {
      return { label: 'Fermée', color: 'var(--text-secondary)', icon: '⚫' };
    }

    if (details.is_started) {
      return { label: 'En cours', color: 'var(--success-color)', icon: '🟢' };
    }
    if (startDateMs !== null && startDateMs > Date.now()) {
      return { label: 'À venir', color: 'var(--warning-color)', icon: '🟡' };
    }
    return { label: 'En attente', color: 'var(--text-secondary)', icon: '⚪' };
  };

  const statusInfo = getStatusInfo();
  const currentPlayersLabel =
    typeof details?.max_players === 'number' && typeof details?.nb_players_remaining === 'number'
      ? `${Math.max(details.max_players - details.nb_players_remaining, 0)}/${details.max_players}`
      : 'N/A';
  const currentTotalPotLabel = typeof details?.current_total_pot === 'number'
    ? formatTicketAmount(details.current_total_pot, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : null;

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

            {/* Share Actions */}
            <div className="league-modal-share">
              <button
                type="button"
                className={`btn btn-outline btn-copy-link ${copyStatus === 'success' ? 'copy-success' : ''} ${copyStatus === 'error' ? 'copy-error' : ''}`}
                onClick={handleCopyLink}
                aria-label="Copier le lien de la ligue"
              >
                {copyStatus === 'success' ? '✅ Lien copié' : copyStatus === 'error' ? '⚠️ Copie impossible' : '🔗 Copier le lien'}
              </button>
            </div>

            {/* League Stats */}
            <div className="league-stats-modal">
              <div className="stat-card-modal">
                <div className="stat-icon">👥</div>
                <div className="stat-content">
                  <div className="stat-value">{currentPlayersLabel}</div>
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

              {currentTotalPotLabel && (
                <div className="stat-card-modal stat-card-modal-pot">
                  <div className="stat-icon">🏦</div>
                  <div className="stat-content">
                    <div className="stat-value stat-value-pot">{currentTotalPotLabel}</div>
                    <div className="stat-label">Pot actuel</div>
                  </div>
                </div>
              )}

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

