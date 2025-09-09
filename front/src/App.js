import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import authService, { AuthError } from './services/authService';
import './App.css';
import './components/Spinner.css';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import { ToastContainer } from './components/Toast';
import useToast from './hooks/useToast';

const Dashboard = lazy(() => import('./components/Dashboard'));

const LoadingSpinner = () => (
    <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Chargement...</p>
    </div>
);

function App() {
    const [currentView, setCurrentView] = useState('home');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            validateToken(token);
        }
    }, []);

    const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } = useToast();

    const validateToken = useCallback(async (token) => {
        try {
            const data = await authService.validateToken();
            setUser(data.user);
            setIsAuthenticated(true);
            showSuccess(`Bon retour, ${data.user.username || data.user.email} !`);
        } catch (error) {
            if (error instanceof AuthError) {
                authService.logout();
                if (error.isUnauthorized()) {
                    showWarning('Session expirée. Veuillez vous reconnecter.');
                } else if (!error.isNetworkError()) {
                    showError('Erreur de validation. Veuillez vous reconnecter.');
                }
            } else {
                authService.logout();
                showError('Erreur inattendue. Veuillez vous reconnecter.');
            }
        }
    }, [showSuccess, showError, showWarning]);

    const handleLogin = useCallback((userData, token) => {
        try {
            localStorage.setItem('authToken', token);
            setUser(userData);
            setIsAuthenticated(true);
            showSuccess(`Bienvenue, ${userData.username || userData.email} !`);
        } catch (error) {
            showError('Erreur lors de la sauvegarde de la session.');
        }
    }, [showSuccess, showError]);

    const handleLogout = useCallback(() => {
        try {
            authService.logout();
            setUser(null);
            setIsAuthenticated(false);
            setCurrentView('home');
            showInfo('Déconnexion réussie. À bientôt !');
        } catch (error) {
            showError('Erreur lors de la déconnexion.');
        }
    }, [showInfo, showError]);

    if (isAuthenticated) {
        return (
            <>
                <Suspense fallback={<LoadingSpinner />}>
                    <Dashboard user={user} onLogout={handleLogout} />
                </Suspense>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
            </>
        );
    }

    return (
        <>
            <div className="app">
                <div className="container">
                {currentView === 'home' && (
                    <div className="home-screen">
                        <div className="hero-section">
                            <div className="logo">
                                <span className="logo-icon">⚽</span>
                                <h1>BetLeague</h1>
                            </div>
                            <p className="tagline">Pariez intelligemment, gagnez ensemble</p>
                        </div>

                        <div className="features">
                            <div className="feature">
                                <span className="feature-icon">🏆</span>
                                <span>Ligues privées</span>
                            </div>
                            <div className="feature">
                                <span className="feature-icon">📊</span>
                                <span>Stats en temps réel</span>
                            </div>
                            <div className="feature">
                                <span className="feature-icon">🔒</span>
                                <span>100% sécurisé</span>
                            </div>
                        </div>

                        <div className="auth-buttons">
                            <button
                                className="btn btn-primary"
                                onClick={() => setCurrentView('login')}
                            >
                                Se connecter
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setCurrentView('register')}
                            >
                                S'inscrire
                            </button>
                        </div>
                    </div>
                )}

                {currentView === 'login' && (
                    <LoginForm
                        onLogin={handleLogin}
                        onBack={() => setCurrentView('home')}
                        onSwitchToRegister={() => setCurrentView('register')}
                        showToast={{ showSuccess, showError, showWarning, showInfo }}
                    />
                )}

                {currentView === 'register' && (
                    <RegisterForm
                        onRegister={handleLogin}
                        onBack={() => setCurrentView('home')}
                        onSwitchToLogin={() => setCurrentView('login')}
                        showToast={{ showSuccess, showError, showWarning, showInfo }}
                    />
                )}
                </div>
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
    );
}

export default App;
