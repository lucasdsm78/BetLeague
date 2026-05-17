/**
 * AppRouter - React Router Configuration
 * Handles all routing logic for the BetLeague application
 */

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEnhancedAuth } from 'hooks/useAuth.enhanced';
import { useProfileMeQuery } from 'hooks/queries/useProfileQuery';
import { useAuthStore } from 'store/authStore';
import App from 'App';
import SeoHead from 'seo/SeoHead';

// Forgot password (lazy)
const LoginForm = React.lazy(() => import('components/LoginForm'));
const RegisterForm = React.lazy(() => import('components/RegisterForm'));
const DashboardLayout = React.lazy(() => import('components/DashboardLayout'));
const TwoFactorPage = React.lazy(() => import('components/TwoFactorPage'));
const TermsPage = React.lazy(() => import('pages/legal/TermsPage'));
const PrivacyPage = React.lazy(() => import('pages/legal/PrivacyPage'));
const LegalNoticePage = React.lazy(() => import('pages/legal/LegalNoticePage'));
const ForgotPasswordRequestPage = React.lazy(() => import('./auth/ForgotPassword/ForgotPasswordRequestPage'));
const ForgotPasswordVerifyPage = React.lazy(() => import('./auth/ForgotPassword/ForgotPasswordVerifyPage'));
const ForgotPasswordConfirmPage = React.lazy(() => import('./auth/ForgotPassword/ForgotPasswordConfirmPage'));

// Lazy load dashboard components
const MatchesSection = React.lazy(() => import('./dashboard/MatchesSection'));
const LeaguesSection = React.lazy(() => import('./dashboard/LeaguesSection'));
const TicketsSection = React.lazy(() => import('./dashboard/TicketsSection'));
const ShopSection = React.lazy(() => import('./dashboard/ShopSection'));
const ProfileSection = React.lazy(() => import('./dashboard/ProfileSection'));
const TicketDetailSection = React.lazy(() => import('./dashboard/TicketDetailSection'));
const SharedTicketSection = React.lazy(() => import('./dashboard/SharedTicketSection'));
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
  const { isAuthenticated, user, getSessionTimeRemaining, initializationComplete } = useEnhancedAuth();

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

const CommerceEnabledRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const profileQuery = useProfileMeQuery({ enabled: true });
  const isShopEnabled = profileQuery.data?.commerce_availability?.shop_enabled !== false;

  if (profileQuery.isLoading) {
    return <LoadingSpinner />;
  }

  if (!isShopEnabled) {
    return <Navigate to="/matches" replace />;
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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SeoHead />
      <Routes>
        {/* Public routes */}
        <Route
          path="/"
          element={<App />}
        />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <LoginPage />
              </Suspense>
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <RegisterPage />
              </Suspense>
            </PublicRoute>
          }
        />

        <Route
          path="/2fa"
          element={
            <PublicRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <TwoFactorPage />
              </Suspense>
            </PublicRoute>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <ForgotPasswordRequestPage />
              </Suspense>
            </PublicRoute>
          }
        />

        <Route
          path="/forgot-password/verify"
          element={
            <PublicRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <ForgotPasswordVerifyPage />
              </Suspense>
            </PublicRoute>
          }
        />

        <Route
          path="/forgot-password/confirm"
          element={
            <PublicRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <ForgotPasswordConfirmPage />
              </Suspense>
            </PublicRoute>
          }
        />

        <Route
          path="/tickets/shared/:ticketUuid"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <SharedTicketSection />
            </Suspense>
          }
        />

        <Route
          path="/cgu"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <TermsPage />
            </Suspense>
          }
        />

        <Route
          path="/confidentialite"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <PrivacyPage />
            </Suspense>
          }
        />

        <Route
          path="/mentions-legales"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <LegalNoticePage />
            </Suspense>
          }
        />

        {/* Protected Dashboard routes */}
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <DashboardLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <MatchesSection />
                  </Suspense>
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leagues"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <DashboardLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <LeaguesSection />
                  </Suspense>
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/invitations"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <DashboardLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <InvitationsSection />
                  </Suspense>
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tournaments"
          element={
            <ProtectedRoute>
              <CommerceEnabledRoute>
                <Suspense fallback={<LoadingSpinner />}>
                  <DashboardLayout>
                    <Suspense fallback={<LoadingSpinner />}>
                      <TournamentsSection />
                    </Suspense>
                  </DashboardLayout>
                </Suspense>
              </CommerceEnabledRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tickets"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <DashboardLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <TicketsSection />
                  </Suspense>
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tickets/:ticketId"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <DashboardLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <TicketDetailSection />
                  </Suspense>
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="/shop"
          element={
            <ProtectedRoute>
              <CommerceEnabledRoute>
                <Suspense fallback={<LoadingSpinner />}>
                  <DashboardLayout>
                    <Suspense fallback={<LoadingSpinner />}>
                      <ShopSection />
                    </Suspense>
                  </DashboardLayout>
                </Suspense>
              </CommerceEnabledRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Suspense fallback={<LoadingSpinner />}>
                <DashboardLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ProfileSection />
                  </Suspense>
                </DashboardLayout>
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Supprimé: route /notifications (accès via cloche) */}
        {/*
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Suspense fallback={<LoadingSpinner />}>
                  <NotificationsPage />
                </Suspense>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        */}

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
