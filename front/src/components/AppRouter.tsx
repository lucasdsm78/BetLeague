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

  console.log('🔒 ProtectedRoute - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  if (isLoading) {
    console.log('🔒 ProtectedRoute - Showing loading spinner');
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    console.log('🔒 ProtectedRoute - Not authenticated, redirecting to /');
    return <Navigate to="/" replace />;
  }

  console.log('🔒 ProtectedRoute - Authenticated, showing protected content');
  return <>{children}</>;
};

// Public Route (redirect to dashboard if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, error } = useAuth();

  console.log('🌍 PublicRoute - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading, 'error:', error);

  // Timeout de sécurité pour éviter le loading infini (HOOK TOUJOURS APPELÉ)
  React.useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.error('🚨 PublicRoute - Loading timeout after 5 seconds, something is wrong with useAuth()');
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  if (isLoading) {
    console.log('🌍 PublicRoute - Showing loading spinner');
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    console.log('🌍 PublicRoute - Authenticated, redirecting to /matches');
    return <Navigate to="/matches" replace />;
  }

  console.log('🌍 PublicRoute - Not authenticated, showing public content');
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