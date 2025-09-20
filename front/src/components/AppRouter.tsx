/**
 * AppRouter - React Router Configuration
 * Handles all routing logic for the BetLeague application
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import App from '../App';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import DashboardLayout from './DashboardLayout';

// Lazy load dashboard components
const MatchesSection = React.lazy(() => import('./dashboard/MatchesSection'));
const LeaguesSection = React.lazy(() => import('./dashboard/LeaguesSection'));
const TicketsSection = React.lazy(() => import('./dashboard/TicketsSection'));
const ProfileSection = React.lazy(() => import('./dashboard/ProfileSection'));

const LoadingSpinner = () => (
  <div className="loading-spinner" role="status" aria-label="Chargement en cours">
    <div className="spinner" aria-hidden="true"></div>
    <p className="sr-only">Chargement...</p>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Public Route (redirect to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, error } = useAuth();
  const navigate = useNavigate();

  // Écouter les changements d'authentification et rediriger automatiquement
  React.useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/matches', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Timeout de sécurité pour éviter le loading infini (HOOK TOUJOURS APPELÉ)
  React.useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/matches" replace />;
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
