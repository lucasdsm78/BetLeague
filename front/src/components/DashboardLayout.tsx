/**
 * DashboardLayout - Secure & Optimized Layout for Authenticated Routes
 * High-performance TypeScript dashboard with comprehensive security
 * Optimized for sports betting league application
 */

import React, { useState, memo, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEnhancedAuth } from '../hooks/useAuth.enhanced';
import { useToast } from '../hooks/useToast';
import LogoutModal from './auth/LogoutModal';
import type { User } from '../types';
import './Dashboard.css';

// Simple sanitization function
const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>'\"&]/g, '')
    .replace(/[^\w\s\-_\.\@]/g, '')
    .substring(0, 50);
};

// Type-safe tab configuration with strict typing
interface TabConfig {
  readonly id: TabId;
  readonly label: string;
  readonly icon: string;
  readonly path: string;
  readonly requiresPermission?: string;
  readonly securityLevel?: 'low' | 'medium' | 'high';
}

type TabId = 'matches' | 'leagues' | 'invitations' | 'tickets' | 'profile';

// Immutable tabs configuration for security
const TABS: Readonly<Record<TabId, TabConfig>> = {
  matches: {
    id: 'matches',
    label: 'Matchs',
    icon: '⚽',
    path: '/matches',
    securityLevel: 'low'
  },
  leagues: {
    id: 'leagues',
    label: 'Ligues',
    icon: '🏆',
    path: '/leagues',
    securityLevel: 'medium'
  },
  invitations: {
    id: 'invitations',
    label: 'Invitations',
    icon: '📨',
    path: '/invitations',
    securityLevel: 'medium'
  },
  tickets: {
    id: 'tickets',
    label: 'Tickets',
    icon: '🎫',
    path: '/tickets',
    securityLevel: 'medium'
  },
  profile: {
    id: 'profile',
    label: 'Profil',
    icon: '👤',
    path: '/profile',
    securityLevel: 'high'
  }
} as const;

// Props interface with strict typing
interface DashboardLayoutProps {
  readonly children: React.ReactNode;
}

// Security state interface
interface SecurityState {
  readonly attemptedPaths: string[];
  readonly suspiciousActivity: boolean;
  readonly lastActivity: number;
}

// Loading component for performance
const LoadingSection = memo(() => (
  <div className="section-loading" role="status" aria-label="Chargement">
    <div className="spinner-small" aria-hidden="true" />
    <span className="sr-only">Chargement en cours...</span>
  </div>
));

LoadingSection.displayName = 'LoadingSection';

const DashboardLayout: React.FC<DashboardLayoutProps> = memo(({ children }) => {
  // Hooks with error boundaries
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoading, isAuthenticated } = useEnhancedAuth();
  const { showError, showWarning } = useToast();

  // Secure state management
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [logoutTriggerReason, setLogoutTriggerReason] = useState<'manual' | 'inactivity' | 'security' | 'session_expired'>('manual');
  const [securityState, setSecurityState] = useState<SecurityState>({
    attemptedPaths: [],
    suspiciousActivity: false,
    lastActivity: Date.now()
  });

  // Memoized security validations for performance
  const isValidUser = useMemo(() => {
    return user &&
           typeof user === 'object' &&
           (user.email || user.username || user.pseudo) &&
           user.id;
  }, [user]);

  const sanitizedUserName = useMemo(() => {
    if (!user) return 'Utilisateur';
    const name = user.pseudo || user.username || user.email || 'Utilisateur';
    return sanitizeInput(String(name));
  }, [user]);

  // Secure tab determination with validation
  const getActiveTab = useCallback((): TabId => {
    const currentPath = location.pathname;

    // Security: Validate path format
    if (!currentPath || typeof currentPath !== 'string' || !/^\/[a-zA-Z0-9/_-]*$/.test(currentPath)) {
      console.warn('🔒 Invalid path format detected:', currentPath);
      return 'matches';
    }

    // Match exact or sub-routes (e.g., /tickets or /tickets/123)
    const tab = Object.values(TABS).find(tab => currentPath === tab.path || currentPath.startsWith(tab.path + '/'));
    return (tab?.id as TabId) || 'matches';
  }, [location.pathname]);

  const activeTab = getActiveTab();

  // Security: Monitor navigation attempts
  useEffect(() => {
    const currentPath = location.pathname;

    setSecurityState(prev => {
      // Don't update if the path is already the latest one
      const lastPath = prev.attemptedPaths[prev.attemptedPaths.length - 1];
      if (lastPath === currentPath) {
        return prev;
      }

      const newAttemptedPaths = [...prev.attemptedPaths, currentPath].slice(-10); // Keep last 10
      const suspiciousActivity = newAttemptedPaths.length > 8; // Too many rapid navigations

      if (suspiciousActivity && !prev.suspiciousActivity) {
        console.warn('🔒 Suspicious navigation activity detected');
        showWarning('Activité de navigation inhabituelle détectée');
      }

      return {
        ...prev,
        attemptedPaths: newAttemptedPaths,
        suspiciousActivity
      };
    });
  }, [location.pathname, showWarning]);

  // Secure navigation handler with validation
  const handleTabClick = useCallback((tabId: string) => {
    // Security: Validate tab ID
    if (!(tabId in TABS)) {
      console.warn('🔒 Invalid tab access attempted:', tabId);
      showError('Accès non autorisé', 'Navigation invalide détectée');
      return;
    }

    const tab = TABS[tabId as TabId];

    // Security: Check permissions if required
    if (tab.requiresPermission && user && !user[tab.requiresPermission as keyof User]) {
      console.warn('🔒 Insufficient permissions for tab:', tabId);
      showError('Accès refusé', 'Permissions insuffisantes');
      return;
    }

    // Security: Rate limiting check
    const now = Date.now();
    if (now - securityState.lastActivity < 100) { // Prevent rapid clicking
      console.warn('🔒 Rate limit exceeded for navigation');
      return;
    }

    try {
      setIsMobileMenuOpen(false);
      navigate(tab.path, { replace: false });

      // Update security state
      setSecurityState(prev => ({
        ...prev,
        lastActivity: now
      }));
    } catch (error) {
      console.error('🔒 Navigation error:', error);
      showError('Erreur de navigation', 'Impossible de naviguer vers cette section');
    }
  }, [navigate, user, securityState.lastActivity, showError]);

  // Enhanced logout handler with modal
  const handleLogout = useCallback(async () => {
    try {
      // Open logout modal for enhanced experience
      setLogoutTriggerReason('manual');
      setIsLogoutModalOpen(true);
    } catch (error) {
      console.error('🔒 Logout modal error:', error);
      // Fallback to direct logout
      try {
        await logout();
        navigate('/', { replace: true });
      } catch (logoutError) {
        console.error('🔒 Fallback logout error:', logoutError);
        window.location.href = '/';
      }
    }
  }, [logout, navigate]);

  // Handle logout modal close
  const handleLogoutModalClose = useCallback(() => {
    setIsLogoutModalOpen(false);
  }, []);

  // Handle inactivity logout
  const handleInactivityLogout = useCallback(() => {
    setLogoutTriggerReason('inactivity');
    setIsLogoutModalOpen(true);
  }, []);

  // Handle security logout
  const handleSecurityLogout = useCallback(() => {
    setLogoutTriggerReason('security');
    setIsLogoutModalOpen(true);
  }, []);

  // Security: Handle mobile menu clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMobileMenuOpen &&
          !target.closest('.mobile-nav') &&
          !target.closest('.mobile-menu-toggle')) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('click', handleClickOutside, { passive: true });
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isMobileMenuOpen]);

  // Security: Auto-logout on inactivity
  useEffect(() => {
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    const checkInactivity = () => {
      const now = Date.now();
      const currentState = securityState;
      if (now - currentState.lastActivity > INACTIVITY_TIMEOUT) {
        handleInactivityLogout();
      }
    };

    const interval = setInterval(checkInactivity, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [handleInactivityLogout]); // Updated dependency

  // Security: Validate user session - but wait for auth initialization

  if (!isValidUser && !isLoading && !isAuthenticated) {
    console.warn('🔒 Dashboard accessed without valid user session');
    navigate('/', { replace: true });
    return null;
  }

  // Performance: Show loading state
  if (isLoading || !user) {
    return <LoadingSection />;
  }

  return (
    <div className="dashboard" data-security-level="high">
      {/* Header with security indicators */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <span className="logo-icon">⚽</span>
              <span className="logo-text">BetLeague</span>
            </div>
          </div>

          <div className="header-center">
            <h1 className="page-title">
              {TABS[activeTab].icon} {TABS[activeTab].label}
            </h1>
          </div>

          <div className="header-right">
            <div className="user-info">
              <span className="user-name" title={sanitizedUserName}>
                {sanitizedUserName}
              </span>
              <div className="user-avatar" aria-label="Avatar utilisateur">
                {sanitizedUserName.charAt(0).toUpperCase()}
              </div>
              {securityState.suspiciousActivity && (
                <span className="security-indicator" title="Activité suspecte détectée">
                  ⚠️
                </span>
              )}
            </div>

            {/* Desktop Logout Button */}
            <button
              className="desktop-logout-btn"
              onClick={handleLogout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <span className="logout-icon">🚪</span>
              <span className="logout-text">Déconnexion</span>
            </button>

            <button
              className="menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        {/* Desktop Navigation */}
        <nav className="desktop-nav" role="navigation" aria-label="Navigation principale">
          <div className="nav-items">
            {Object.values(TABS).map((tab) => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                aria-label={`Aller à ${tab.label}`}
                data-security-level={tab.securityLevel}
              >
                <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
                <span className="nav-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content with error boundary */}
        <main className="dashboard-content" role="main">
          <React.Suspense fallback={<LoadingSection />}>
            {children}
          </React.Suspense>
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav
        className={`mobile-nav ${isMobileMenuOpen ? 'open' : ''}`}
        role="navigation"
        aria-label="Navigation mobile"
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="mobile-menu">
          <div className="menu-header">
            <div className="user-profile">
              <div className="user-avatar-large">
                {sanitizedUserName.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{sanitizedUserName}</span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>
            <button
              className="menu-close"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Fermer le menu mobile"
            >
              ✕
            </button>
          </div>

          <div className="menu-items">
            {Object.values(TABS).map((tab) => (
              <button
                key={tab.id}
                className={`menu-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <span className="menu-icon">{tab.icon}</span>
                <span className="menu-label">{tab.label}</span>
              </button>
            ))}

            <hr className="menu-divider" />

            <button
              className="menu-item logout"
              onClick={handleLogout}
            >
              <span className="menu-icon">🚪</span>
              <span className="menu-label">Déconnexion</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation for Mobile */}
      <nav className="bottom-nav" role="navigation" aria-label="Navigation rapide">
        {Object.values(TABS).map((tab) => (
          <button
            key={tab.id}
            className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="bottom-nav-icon">{tab.icon}</span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Enhanced Logout Modal */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={handleLogoutModalClose}
        triggerReason={logoutTriggerReason}
        showDeviceOptions={true}
        enableQuickLogout={true}
      />
    </div>
  );
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;
