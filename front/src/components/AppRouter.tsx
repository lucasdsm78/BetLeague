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

// Lazy load dashboard components
const MatchesSection = React.lazy(() => import('./dashboard/MatchesSection'));
const LeaguesSection = React.lazy(() => import('./dashboard/LeaguesSection'));
const TicketsSection = React.lazy(() => import('./dashboard/TicketsSection'));
const ProfileSection = React.lazy(() => import('./dashboard/ProfileSection'));
const LeagueDetail = React.lazy(() => import('./league/LeagueDetail'));

const LoadingSpinner = () => (
  <div className="loading-spinner" role="status" aria-label="Chargement en cours">
    <div className="spinner" aria-hidden="true"></div>
    <p className="sr-only">Chargement...</p>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user, getSessionTimeRemaining } = useEnhancedAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Enhanced authentication check
  if (!isAuthenticated) {
    console.log('🚫 ProtectedRoute: User not authenticated, redirecting to home');
    return <Navigate to="/" replace />;
  }

  // Double check: verify we have a valid session and user
  const sessionTimeRemaining = getSessionTimeRemaining();
  const hasValidUser = user && user.id;

  if (!hasValidUser || sessionTimeRemaining <= 0) {
    console.log('🚫 ProtectedRoute: Invalid session detected, redirecting to home');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Public Route (redirect to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, error, user, getSessionTimeRemaining } = useEnhancedAuth();
  const navigate = useNavigate();
  const [initialCheckComplete, setInitialCheckComplete] = React.useState(false);

  // Écouter les changements d'authentification et rediriger automatiquement
  React.useEffect(() => {
    // Wait for initial auth check to complete before redirecting
    if (!isLoading && !initialCheckComplete) {
      setInitialCheckComplete(true);
    }
  }, [isLoading, initialCheckComplete]);

  // Separate effect for redirection to avoid interference with navigation
  React.useEffect(() => {
    if (isAuthenticated && !isLoading && initialCheckComplete) {
      // Double check: verify we have a valid session and user
      const sessionTimeRemaining = getSessionTimeRemaining();
      const hasValidUser = user && user.id;

      if (hasValidUser && sessionTimeRemaining > 0) {
        console.log('🔄 PublicRoute: Redirecting authenticated user to dashboard');
        navigate('/matches', { replace: true });
      } else {
        console.log('🚫 PublicRoute: Invalid session detected, staying on public route');
      }
    }
  }, [isAuthenticated, isLoading, initialCheckComplete, navigate, user, getSessionTimeRemaining]);

  // Timeout de sécurité pour éviter le loading infini
  React.useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Auth loading timeout, proceeding as unauthenticated');
        setInitialCheckComplete(true);
      }, 3000); // Reduced to 3 seconds

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // Show loading until initial check is complete
  if (isLoading || !initialCheckComplete) {
    return <LoadingSpinner />;
  }

  // Only redirect if user is actually authenticated after initial check
  if (isAuthenticated && initialCheckComplete) {
    // Double check: verify we have a valid session and user
    const sessionTimeRemaining = getSessionTimeRemaining();
    const hasValidUser = user && user.id;

    if (hasValidUser && sessionTimeRemaining > 0) {
      console.log('🔄 PublicRoute: Navigating to matches (authenticated user)');
      return <Navigate to="/matches" replace />;
    } else {
      console.log('🚫 PublicRoute: Invalid session detected, showing public content');
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
          path="/league/:id"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <LeagueDetail />
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
