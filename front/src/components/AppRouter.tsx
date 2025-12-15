/**
 * AppRouter - React Router Configuration
 * Handles all routing logic for the BetLeague application
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEnhancedAuth } from 'hooks/useAuth.enhanced';
import { useAuthStore } from 'store/authStore';
import App from 'App';
import LoginForm from 'components/LoginForm';
import RegisterForm from 'components/RegisterForm';
import DashboardLayout from 'components/DashboardLayout';
import TwoFactorPage from 'components/TwoFactorPage';

// Lazy load dashboard components
const MatchesSection = React.lazy(() => import('./dashboard/MatchesSection'));
const LeaguesSection = React.lazy(() => import('./dashboard/LeaguesSection'));
const TicketsSection = React.lazy(() => import('./dashboard/TicketsSection'));
const ShopSection = React.lazy(() => import('./dashboard/ShopSection'));
const ProfileSection = React.lazy(() => import('./dashboard/ProfileSection'));
const TicketDetailSection = React.lazy(() => import('./dashboard/TicketDetailSection'));
const InvitationsSection = React.lazy(() => import('./dashboard/InvitationsSection'));
const TournamentsSection = React.lazy(() => import('./dashboard/TournamentsSection'));

const LoadingSpinner = () => (
  <div className="loading-spinner" role="status" aria-label="Chargement en cours">
    <div className="spinner" aria-hidden="true"></div>
    <p className="sr-only">Chargement...</p>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user, getSessionTimeRemaining, initializationComplete, recoverFromStoredToken, attemptHydrateFromAnyStorage } = useEnhancedAuth();

  // Déplacer les tentatives d'hydratation dans useEffect pour éviter setState pendant le rendu
  React.useEffect(() => {
    if (!initializationComplete && !isLoading && attemptHydrateFromAnyStorage) {
      attemptHydrateFromAnyStorage();
    }
  }, [initializationComplete, isLoading, attemptHydrateFromAnyStorage]);

  React.useEffect(() => {
    if (initializationComplete && !isAuthenticated && recoverFromStoredToken) {
      recoverFromStoredToken();
    }
  }, [initializationComplete, isAuthenticated, recoverFromStoredToken]);

  // Attendre la fin de l'initialisation globale
  if (!initializationComplete) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const sessionTimeRemaining = getSessionTimeRemaining();
  const hasValidUser = user && user.id;
  if (!hasValidUser || sessionTimeRemaining <= 0) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Public Route (redirect to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user, getSessionTimeRemaining, initializationComplete } = useEnhancedAuth();
  const [checkedSession, setCheckedSession] = React.useState(false);

  // Vérifier et nettoyer les sessions expirées au montage
  React.useEffect(() => {
    if (initializationComplete && !checkedSession) {
      const sessionTimeRemaining = getSessionTimeRemaining();

      // Si token expiré, forcer le logout via le store
      if (isAuthenticated && sessionTimeRemaining <= 0) {
        const authStore = useAuthStore.getState();
        authStore.logout();
      }

      setCheckedSession(true);
    }
  }, [initializationComplete, checkedSession, isAuthenticated, getSessionTimeRemaining]);

  // Attendre la fin de l'initialisation et de la vérification
  if (!initializationComplete || isLoading || !checkedSession) {
    return <LoadingSpinner />;
  }

  // Si authentifié avec session valide, rediriger vers le dashboard
  if (isAuthenticated) {
    const sessionTimeRemaining = getSessionTimeRemaining();
    const hasValidUser = user && user.id;
    if (hasValidUser && sessionTimeRemaining > 0) {
      return <Navigate to="/matches" replace />;
    }
  }

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
          path="/tournaments"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <TournamentsSection />
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
          path="/shop"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <ShopSection />
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
