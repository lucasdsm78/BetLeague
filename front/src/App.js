import React, { useState, lazy, Suspense, memo, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastContainer } from './components/Toast';
import useToast from './hooks/useToast';
import './App.css';
import './components/Spinner.css';

// Lazy loading pour des performances optimales
const Dashboard = lazy(() => import('./components/Dashboard'));
const Matches = lazy(() => import('./components/dashboard/Matches'));
const Leagues = lazy(() => import('./components/dashboard/Leagues'));
const Tickets = lazy(() => import('./components/dashboard/Tickets'));
const Profile = lazy(() => import('./components/dashboard/Profile'));

const LoadingSpinner = memo(() => (
    <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Chargement...</p>
    </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

const HomeScreen = memo(({ onNavigate }) => (
    <div className="home-screen">
        <div className="hero-section">
            <div className="logo">
                <span className="logo-icon" role="img" aria-label="Football">⚽</span>
                <h1>BetLeague</h1>
            </div>
            <p className="tagline">Pariez intelligemment, gagnez ensemble</p>
        </div>

        <div className="features">
            <div className="feature">
                <span className="feature-icon" role="img" aria-label="Trophée">🏆</span>
                <span>Ligues privées</span>
            </div>
            <div className="feature">
                <span className="feature-icon" role="img" aria-label="Graphique">📊</span>
                <span>Stats en temps réel</span>
            </div>
            <div className="feature">
                <span className="feature-icon" role="img" aria-label="Sécurité">🔒</span>
                <span>100% sécurisé</span>
            </div>
        </div>

        <div className="auth-buttons">
            <button
                className="btn btn-primary"
                onClick={() => onNavigate('login')}
            >
                Se connecter
            </button>
            <button
                className="btn btn-secondary"
                onClick={() => onNavigate('register')}
            >
                S'inscrire
            </button>
        </div>
    </div>
));

HomeScreen.displayName = 'HomeScreen';

function App() {
    const { isAuthenticated, user, logout, isLoading } = useAuth();
    const [currentView, setCurrentView] = useState('home');
    const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } = useToast();
    const navigate = useNavigate();
    const wasAuthenticated = useRef(false);

    const handleNavigation = (view) => {
        setCurrentView(view);
    };

    const handleRegisterSuccess = (userData) => {
        showSuccess(`Bienvenue sur BetLeague, ${userData.username || userData.email} !`);
    };

    const handleLogout = () => {
        logout();
        setCurrentView('home');
        navigate('/', { replace: true });
        showInfo('Déconnexion réussie. À bientôt !');
    };

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/matches', { replace: true });
            if (!wasAuthenticated.current) {
                showSuccess(`Bienvenue, ${user?.username || user?.email}!`);
            }
        }
        wasAuthenticated.current = isAuthenticated;
    }, [isAuthenticated, navigate, user, showSuccess]);

    // Loading initial de l'authentification
    if (isLoading) {
        return (
            <>
                <div className="app">
                    <LoadingSpinner />
                </div>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
            </>
        );
    }

    return (
        <>
            <div className="app">
                <div className="container">
                    {/* Route protégée pour le dashboard */}
                    <ProtectedRoute
                        requireAuth={true}
                        fallback={
                            // Interface non-authentifiée
                            <>
                                {currentView === 'home' && (
                                    <HomeScreen onNavigate={handleNavigation} />
                                )}

                                {currentView === 'login' && (
                                    <LoginForm
                                        onBack={() => handleNavigation('home')}
                                        onSwitchToRegister={() => handleNavigation('register')}
                                    />
                                )}

                                {currentView === 'register' && (
                                    <RegisterForm
                                        onRegister={handleRegisterSuccess}
                                        onBack={() => handleNavigation('home')}
                                        onSwitchToLogin={() => handleNavigation('login')}
                                    />
                                )}
                            </>
                        }
                    >
                        {/* Dashboard pour utilisateurs authentifiés */}
                        <Suspense fallback={<LoadingSpinner />}>
                            <Routes>
                                <Route
                                    path="/matches"
                                    element={
                                        <Dashboard user={user} onLogout={handleLogout}>
                                            <Matches />
                                        </Dashboard>
                                    }
                                />
                                <Route
                                    path="/leagues"
                                    element={
                                        <Dashboard user={user} onLogout={handleLogout}>
                                            <Leagues />
                                        </Dashboard>
                                    }
                                />
                                <Route
                                    path="/tickets"
                                    element={
                                        <Dashboard user={user} onLogout={handleLogout}>
                                            <Tickets />
                                        </Dashboard>
                                    }
                                />
                                <Route
                                    path="/profile"
                                    element={
                                        <Dashboard user={user} onLogout={handleLogout}>
                                            <Profile />
                                        </Dashboard>
                                    }
                                />
                                <Route path="*" element={<Navigate to="/matches" replace />} />
                            </Routes>
                        </Suspense>
                    </ProtectedRoute>
                </div>
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
}

export default memo(App);
