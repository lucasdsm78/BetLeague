/**
 * AppRouter - React Router Configuration
 * Handles all routing logic for the BetLeague application
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEnhancedAuth } from '../hooks/useAuth.enhanced';
import App from '../App';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import DashboardLayout from './DashboardLayout';
import DebugAuthPanel from './DebugAuthPanel';
import TwoFactorPage from './TwoFactorPage';

// Lazy load dashboard components
const MatchesSection = React.lazy(() => import('./dashboard/MatchesSection'));
const LeaguesSection = React.lazy(() => import('./dashboard/LeaguesSection'));
const TicketsSection = React.lazy(() => import('./dashboard/TicketsSection'));
const ProfileSection = React.lazy(() => import('./dashboard/ProfileSection'));
const TicketDetailSection = React.lazy(() => import('./dashboard/TicketDetailSection'));
const InvitationsSection = React.lazy(() => import('./dashboard/InvitationsSection'));

const LoadingSpinner = () => (
  <div className="loading-spinner" role="status" aria-label="Chargement en cours">
    <div className="spinner" aria-hidden="true"></div>
    <p className="sr-only">Chargement...</p>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user, getSessionTimeRemaining, initializationComplete, recoverFromStoredToken, attemptHydrateFromAnyStorage, debugDumpAuth } = useEnhancedAuth({ debugMode: true });

  const logSnapshot = () => {
    const dump = debugDumpAuth?.();
    console.log('[RouteDebug][Protected] snapshot', dump);
  };
  logSnapshot();

  if (!initializationComplete && !isLoading) {
    // Tentative d’hydratation anticipée
    const hydrated = attemptHydrateFromAnyStorage?.();
    if (hydrated) console.log('[RouteDebug][Protected] Hydratation réussie avant init complète');
  }

  // Attendre la fin de l'initialisation globale, mais si token récupéré, continuer
  if (!initializationComplete) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated && recoverFromStoredToken) {
    const recovered = recoverFromStoredToken();
    if (recovered) console.log('[RouteDebug][Protected] recoverFromStoredToken success');
  }

  if (!isAuthenticated) {
    console.warn('⛔ ProtectedRoute: not authenticated after recovery attempts');
    return <Navigate to="/" replace />;
  }

  const sessionTimeRemaining = getSessionTimeRemaining();
  const hasValidUser = user && user.id;
  if (!hasValidUser || sessionTimeRemaining <= 0) {
    console.warn('⛔ ProtectedRoute: invalid session after recovery attempts');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Public Route (redirect to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, error, user, getSessionTimeRemaining, initializationComplete, recoverFromStoredToken, attemptHydrateFromAnyStorage, debugDumpAuth } = useEnhancedAuth({ debugMode: true });
  const navigate = useNavigate();
  const [initialCheckComplete, setInitialCheckComplete] = React.useState(false);

  const logSnapshot = () => {
    const dump = debugDumpAuth?.();
    console.log('[RouteDebug][Public] snapshot', dump);
  };
  logSnapshot();

  // Fallback hydratation si init pas complète mais pas de loading actif
  React.useEffect(() => {
    if (!initializationComplete && !isLoading) {
      const hydrated = attemptHydrateFromAnyStorage?.();
      if (hydrated) console.log('[RouteDebug][Public] Hydratation legacy réussie');
    }
  }, [initializationComplete, isLoading, attemptHydrateFromAnyStorage]);

  // Marquer l'initialisation terminée
  React.useEffect(() => {
    if (initializationComplete && !initialCheckComplete) {
      setInitialCheckComplete(true);
    }
  }, [initializationComplete, initialCheckComplete]);

  // Essayer une récupération si authentification manquante
  React.useEffect(() => {
    if (initializationComplete && !isAuthenticated && recoverFromStoredToken) {
      const recovered = recoverFromStoredToken();
      if (recovered) console.log('[RouteDebug][Public] recoverFromStoredToken success');
    }
  }, [initializationComplete, isAuthenticated, recoverFromStoredToken]);

  // Redirection après authentification valide
  React.useEffect(() => {
    if (initializationComplete && isAuthenticated && !isLoading && initialCheckComplete) {
      const sessionTimeRemaining = getSessionTimeRemaining();
      const hasValidUser = user && user.id;
      if (hasValidUser && sessionTimeRemaining > 0) {
        console.log('🔄 PublicRoute: Redirecting authenticated user to dashboard');
        navigate('/matches', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, initializationComplete, initialCheckComplete, navigate, user, getSessionTimeRemaining]);

  React.useEffect(() => {
    if (!initializationComplete || isLoading) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Auth loading timeout (PublicRoute), forcing completion');
        setInitialCheckComplete(true);
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [initializationComplete, isLoading]);

  if (!initializationComplete || isLoading || !initialCheckComplete) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated && initialCheckComplete) {
    const sessionTimeRemaining = getSessionTimeRemaining();
    const hasValidUser = user && user.id;
    if (hasValidUser && sessionTimeRemaining > 0) {
      console.log('🔄 PublicRoute: Navigating to matches (authenticated user)');
      return <Navigate to="/matches" replace />;
    }
  }

  console.log('🌍 PublicRoute: Showing public content (unauthenticated user)');

  return <>{children}</>;
};

// Login Page Component
const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="app">
      <div className="container">
        <LoginForm
          onLogin={() => {}}
          onBack={() => navigate('/')}
          onSwitchToRegister={() => navigate('/register')}
        />
      </div>
    </div>
  );
};

// Register Page Component
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="app">
      <div className="container">
        <RegisterForm
          onRegister={() => {}}
          onBack={() => navigate('/')}
          onSwitchToLogin={() => navigate('/login')}
        />
      </div>
    </div>
  );
};

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <DebugAuthPanel />
      <Routes>
        {/* Public routes */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <App />
            </PublicRoute>
          }
        />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        <Route
          path="/2fa"
          element={
            <PublicRoute>
              <TwoFactorPage />
            </PublicRoute>
          }
        />

        {/* Protected Dashboard routes */}
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <MatchesSection />
                </Suspense>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leagues"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <LeaguesSection />
                </Suspense>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/invitations"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <InvitationsSection />
                </Suspense>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tickets"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <TicketsSection />
                </Suspense>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tickets/:ticketId"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <TicketDetailSection />
                </Suspense>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <ProfileSection />
                </Suspense>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
