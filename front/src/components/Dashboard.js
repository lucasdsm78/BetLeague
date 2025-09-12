import React, { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth';
import './Dashboard.css';

// Lazy loading des sections pour des performances optimales
const MatchesSection = lazy(() => import('./dashboard/MatchesSection'));
const LeaguesSection = lazy(() => import('./dashboard/LeaguesSection'));
const TicketsSection = lazy(() => import('./dashboard/TicketsSection'));
const ProfileSection = lazy(() => import('./dashboard/ProfileSection'));

const LoadingSection = memo(() => (
    <div className="section-loading">
        <div className="spinner-small"></div>
        <p>Chargement...</p>
    </div>
));

LoadingSection.displayName = 'LoadingSection';

const TABS = {
    matches: { 
        id: 'matches', 
        label: 'Matchs', 
        icon: '⚽',
        path: '/matches'
    },
    leagues: { 
        id: 'leagues', 
        label: 'Ligues', 
        icon: '🏆',
        path: '/leagues'
    },
    tickets: { 
        id: 'tickets', 
        label: 'Tickets', 
        icon: '🎫',
        path: '/tickets'
    },
    profile: { 
        id: 'profile', 
        label: 'Profil', 
        icon: '👤',
        path: '/profile'
    }
};

const Dashboard = memo(({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('matches');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { isLoading } = useAuth();

    // Sécurité: Vérification de l'utilisateur
    useEffect(() => {
        if (!user) {
            console.warn('Dashboard accessed without valid user');
            onLogout();
        }
    }, [user, onLogout]);

    // Navigation sécurisée
    const handleTabChange = useCallback((tabId) => {
        if (!TABS[tabId]) {
            console.warn('Invalid tab access attempted:', tabId);
            return;
        }
        setActiveTab(tabId);
        setIsMobileMenuOpen(false);
        
        // Mise à jour de l'URL pour le SEO et navigation
        if (window.history.pushState) {
            window.history.pushState(null, '', TABS[tabId].path);
        }
    }, []);

    // Fermeture du menu mobile au clic extérieur
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMobileMenuOpen && !event.target.closest('.mobile-menu') && !event.target.closest('.menu-toggle')) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isMobileMenuOpen]);

    // Gestion sécurisée de la déconnexion
    const handleLogout = useCallback(() => {
        if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            onLogout();
        }
    }, [onLogout]);

    const renderActiveSection = useCallback(() => {
        const commonProps = { user };
        
        switch (activeTab) {
            case 'matches':
                return <MatchesSection {...commonProps} />;
            case 'leagues':
                return <LeaguesSection {...commonProps} />;
            case 'tickets':
                return <TicketsSection {...commonProps} />;
            case 'profile':
                return <ProfileSection {...commonProps} onLogout={handleLogout} />;
            default:
                return <MatchesSection {...commonProps} />;
        }
    }, [activeTab, user, handleLogout]);

    if (isLoading || !user) {
        return <LoadingSection />;
    }

    return (
        <div className="dashboard">
            {/* Header Mobile */}
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="header-left">
                        <div className="logo">
                            <span className="logo-icon">⚽</span>
                            <span className="logo-text">BetLeague</span>
                        </div>
                    </div>
                    
                    <div className="header-center">
                        <h1 className="page-title">{TABS[activeTab].label}</h1>
                    </div>
                    
                    <div className="header-right">
                        <div className="user-info">
                            <span className="user-name">{user.username || user.pseudo}</span>
                            <div className="user-avatar">
                                {(user.username || user.pseudo || 'U').charAt(0).toUpperCase()}
                            </div>
                        </div>
                        
                        <button 
                            className="menu-toggle"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label="Menu"
                        >
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="dashboard-body">
                {/* Navigation Desktop */}
                <nav className="desktop-nav">
                    <div className="nav-items">
                        {Object.values(TABS).map((tab) => (
                            <button
                                key={tab.id}
                                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => handleTabChange(tab.id)}
                                aria-selected={activeTab === tab.id}
                            >
                                <span className="nav-icon">{tab.icon}</span>
                                <span className="nav-label">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </nav>

                {/* Contenu Principal */}
                <main className="dashboard-content">
                    <Suspense fallback={<LoadingSection />}>
                        {renderActiveSection()}
                    </Suspense>
                </main>
            </div>

            {/* Navigation Mobile */}
            <nav className={`mobile-nav ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="mobile-menu">
                    <div className="menu-header">
                        <div className="user-profile">
                            <div className="user-avatar-large">
                                {(user.username || user.pseudo || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="user-details">
                                <span className="user-name">{user.username || user.pseudo}</span>
                                <span className="user-email">{user.email}</span>
                            </div>
                        </div>
                        <button 
                            className="menu-close"
                            onClick={() => setIsMobileMenuOpen(false)}
                            aria-label="Fermer le menu"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="menu-items">
                        {Object.values(TABS).map((tab) => (
                            <button
                                key={tab.id}
                                className={`menu-item ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => handleTabChange(tab.id)}
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

            {/* Navigation Bottom Mobile */}
            <nav className="bottom-nav">
                {Object.values(TABS).map((tab) => (
                    <button
                        key={tab.id}
                        className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => handleTabChange(tab.id)}
                        aria-label={tab.label}
                    >
                        <span className="bottom-nav-icon">{tab.icon}</span>
                        <span className="bottom-nav-label">{tab.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;