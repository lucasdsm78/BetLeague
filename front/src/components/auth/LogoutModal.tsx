/**
 * LogoutModal - Secure & Mobile-Optimized Logout Component
 * Advanced logout modal with multiple logout options and security features
 */

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnhancedAuth } from '../../hooks/useAuth.enhanced';
import { useLogout, LogoutOption } from '../../hooks/useLogout';
import './LogoutModal.css';

export interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerReason?: 'manual' | 'inactivity' | 'security' | 'session_expired';
  showDeviceOptions?: boolean;
  enableQuickLogout?: boolean;
}

interface LogoutOptionConfig {
  id: LogoutOption;
  label: string;
  description: string;
  icon: string;
  securityLevel: 'low' | 'medium' | 'high';
  confirmationRequired: boolean;
}

// Secure logout options configuration
const LOGOUT_OPTIONS: readonly LogoutOptionConfig[] = [
  {
    id: 'current',
    label: 'Cet appareil uniquement',
    description: 'Déconnexion de cet appareil seulement',
    icon: '📱',
    securityLevel: 'low',
    confirmationRequired: false,
  },
  {
    id: 'all_devices',
    label: 'Tous les appareils',
    description: 'Déconnexion de tous vos appareils connectés',
    icon: '🔒',
    securityLevel: 'high',
    confirmationRequired: true,
  },
  {
    id: 'except_current',
    label: 'Autres appareils',
    description: 'Garder cette session, déconnecter les autres',
    icon: '🛡️',
    securityLevel: 'medium',
    confirmationRequired: true,
  },
] as const;

const LogoutModal = memo<LogoutModalProps>(({
  isOpen,
  onClose,
  triggerReason = 'manual',
  showDeviceOptions = true,
  enableQuickLogout = false,
}) => {
  const navigate = useNavigate();
  const { user, isLoading } = useEnhancedAuth();
  const {
    logout,
    quickLogout,
    isLoggingOut,
    progress,
    lastLogoutError,
    clearError,
    getLogoutOptionLabel,
    getLogoutOptionDescription,
  } = useLogout({
    autoNavigate: true,
    enableAnalytics: true,
    onLogoutComplete: () => {
      onClose();
    },
  });

  // State management
  const [selectedOption, setSelectedOption] = useState<LogoutOption>('current');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Refs for accessibility and cleanup
  const modalRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (isOpen && firstButtonRef.current) {
      firstButtonRef.current.focus();
    }
  }, [isOpen]);

  // Auto-logout countdown for security reasons
  useEffect(() => {
    if (isOpen && (triggerReason === 'security' || triggerReason === 'session_expired')) {
      setCountdown(5);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            logout('current', triggerReason, true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
      };
    }
  }, [isOpen, triggerReason, logout]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          if (!isLoggingOut && triggerReason === 'manual') {
            onClose();
          }
          break;
        case 'Enter':
          if (document.activeElement?.getAttribute('data-logout-option')) {
            const optionId = document.activeElement.getAttribute('data-logout-option') as LogoutOption;
            setSelectedOption(optionId);
            handleLogout(optionId);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoggingOut, triggerReason, onClose]);

  // Get the selected logout option
  const getSelectedLogoutOption = useCallback((): LogoutOptionConfig => {
    return LOGOUT_OPTIONS.find(option => option.id === selectedOption) || LOGOUT_OPTIONS[0];
  }, [selectedOption]);

  // Get reason message based on trigger
  const getReasonMessage = useCallback((): string => {
    switch (triggerReason) {
      case 'inactivity':
        return 'Votre session a expiré en raison d\'inactivité prolongée.';
      case 'security':
        return 'Déconnexion pour des raisons de sécurité.';
      case 'session_expired':
        return 'Votre session a expiré. Veuillez vous reconnecter.';
      default:
        return 'Êtes-vous sûr de vouloir vous déconnecter ?';
    }
  }, [triggerReason]);

  // Advanced logout handler with progress tracking
  const handleLogout = useCallback(async (
    optionId: LogoutOption = selectedOption,
    force = false
  ) => {
    const option = LOGOUT_OPTIONS.find(opt => opt.id === optionId);
    if (!option) return;

    // Security confirmation for high-risk operations
    if (option.confirmationRequired && !force && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    // Clear any previous errors
    if (lastLogoutError) {
      clearError();
    }

    // Use the advanced logout hook
    const success = await logout(optionId, triggerReason, force);

    if (success) {
      console.log(`✅ Logout completed successfully for ${optionId}`);
    } else {
      console.error(`❌ Logout failed for ${optionId}`);
    }
  }, [selectedOption, showConfirmation, logout, triggerReason, lastLogoutError, clearError]);

  // Quick logout for emergencies
  const handleQuickLogout = useCallback(async () => {
    const success = await quickLogout();
    if (success) {
      console.log('✅ Quick logout completed successfully');
    }
  }, [quickLogout]);

  // Cancel logout (only for manual logouts)
  const handleCancel = useCallback(() => {
    if (triggerReason === 'manual' && !isLoggingOut) {
      onClose();
    }
  }, [triggerReason, isLoggingOut, onClose]);

  // Render nothing if not open
  if (!isOpen) return null;

  // Auto-logout countdown UI
  const showCountdown = triggerReason === 'security' || triggerReason === 'session_expired';

  return (
    <div
      className="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && triggerReason === 'manual' && !isLoggingOut) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={`logout-modal ${triggerReason !== 'manual' ? 'urgent' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="logout-modal__header">
          <div className="logout-modal__icon">
            {triggerReason === 'security' ? '🔒' : triggerReason === 'session_expired' ? '⏰' : '🚪'}
          </div>
          <h2 id="logout-modal-title" className="logout-modal__title">
            {triggerReason === 'manual' ? 'Déconnexion' : 'Session terminée'}
          </h2>
          {triggerReason === 'manual' && !isLoggingOut && (
            <button
              className="logout-modal__close"
              onClick={onClose}
              aria-label="Fermer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="logout-modal__content">
          {/* Reason message */}
          <p className="logout-modal__message">
            {getReasonMessage()}
          </p>

          {/* User info */}
          {user && (
            <div className="logout-modal__user-info">
              <div className="user-avatar">
                {(user.pseudo || user.username || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">
                  {user.pseudo || user.username || 'Utilisateur'}
                </span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>
          )}

          {/* Countdown for urgent logouts */}
          {showCountdown && countdown > 0 && (
            <div className="logout-modal__countdown">
              <div className="countdown-circle">
                <span className="countdown-number">{countdown}</span>
              </div>
              <p className="countdown-text">
                Déconnexion automatique dans {countdown} seconde{countdown > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Logout options (only for manual logouts) */}
          {triggerReason === 'manual' && showDeviceOptions && !isLoggingOut && (
            <div className="logout-modal__options">
              <h3 className="options-title">Options de déconnexion</h3>
              <div className="options-list">
                {LOGOUT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    className={`option-item ${selectedOption === option.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOption(option.id)}
                    data-logout-option={option.id}
                    data-security-level={option.securityLevel}
                  >
                    <div className="option-icon">{option.icon}</div>
                    <div className="option-content">
                      <div className="option-label">{option.label}</div>
                      <div className="option-description">{option.description}</div>
                    </div>
                    <div className="option-radio">
                      <div className={`radio-dot ${selectedOption === option.id ? 'checked' : ''}`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation step */}
          {showConfirmation && !isLoggingOut && (
            <div className="logout-modal__confirmation">
              <div className="confirmation-warning">
                <span className="warning-icon">⚠️</span>
                <p>
                  Cette action va déconnecter d'autres appareils. Êtes-vous sûr de vouloir continuer ?
                </p>
              </div>
            </div>
          )}

          {/* Progress indicator */}
          {isLoggingOut && (
            <div className="logout-modal__progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <p className="progress-text">
                {progress.message}
              </p>
            </div>
          )}

          {/* Error display */}
          {lastLogoutError && !isLoggingOut && (
            <div className="logout-modal__error">
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <p>{lastLogoutError}</p>
                <button
                  className="error-dismiss"
                  onClick={clearError}
                  aria-label="Fermer l'erreur"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="logout-modal__actions">
          {enableQuickLogout && triggerReason === 'manual' && !isLoggingOut && (
            <button
              className="btn btn-outline btn-quick"
              onClick={handleQuickLogout}
            >
              Déconnexion rapide
            </button>
          )}

          {triggerReason === 'manual' && !isLoggingOut && (
            <button
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={isLoggingOut}
            >
              Annuler
            </button>
          )}

          {showConfirmation ? (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirmation(false)}
                disabled={isLoggingOut}
              >
                Retour
              </button>
              <button
                ref={firstButtonRef}
                className="btn btn-danger"
                onClick={() => handleLogout(selectedOption, true)}
                disabled={isLoggingOut}
              >
                Confirmer la déconnexion
              </button>
            </>
          ) : (
            !showCountdown && (
              <button
                ref={firstButtonRef}
                className={`btn ${triggerReason === 'manual' ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => handleLogout()}
                disabled={isLoggingOut || isLoading}
              >
                {isLoggingOut ? 'Déconnexion...' :
                 triggerReason === 'manual' ? 'Se déconnecter' :
                 'Déconnecter maintenant'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
});

LogoutModal.displayName = 'LogoutModal';

export default LogoutModal;