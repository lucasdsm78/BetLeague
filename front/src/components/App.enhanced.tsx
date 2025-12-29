/**
 * Enhanced App Component - Integration example with new auth system
 * Shows how to integrate the enhanced authentication system
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useEnhancedAuth } from '../hooks/useAuth.enhanced';
import AuthMonitor from './auth/AuthMonitor';
import AppRouter from './AppRouter';
import '../utils/authDebug'; // Load debug utilities
// LoadingSpinner component
const LoadingSpinner = () => (
  <div className="loading-spinner" role="status" aria-label="Chargement en cours">
    <div className="spinner" aria-hidden="true"></div>
    <p className="sr-only">Chargement...</p>
  </div>
);

// Enhanced App component with automatic token refresh
const EnhancedApp: React.FC = () => {
  const { isLoading, error } = useEnhancedAuth({
    autoRefresh: true,
    activityTracking: true,
    debugMode: process.env.NODE_ENV === 'development',
    onAuthChange: (isAuthenticated) => {
    },
    onError: (error) => {
      console.error('🔐 Auth error:', error.message);
    },
  });

  // Show loading during initial authentication check
  if (isLoading) {
    return (
      <div className="app-loading">
        <LoadingSpinner />
        <p>Initialisation de l'authentification...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthMonitor
        enableNotifications={true}
        enableExpiryWarning={true}
        expiryWarningThreshold={10} // 10 minutes before expiry
        enableInactivityWarning={true}
        inactivityWarningThreshold={25} // 25 minutes of inactivity
      >
        <AppRouter />
      </AuthMonitor>
    </BrowserRouter>
  );
};

export default EnhancedApp;
