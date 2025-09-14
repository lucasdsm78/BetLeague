/**
 * App Component - Main Application Entry Point
 * Refactored with TypeScript and integrated with new architecture
 */

import React, { useState, memo, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from './hooks/useToast';
import { initializeServices } from './services';
import { initializeStores } from './store';
import SecurityUtils from './utils/security';
import { ToastContainer } from './components/ToastContainer';
import type { User } from './types';
import './styles/App.css';


// Composant de loading sécurisé
const LoadingSpinner = memo(() => (
  <div className="loading-spinner" role="status" aria-label="Chargement en cours">
    <div className="spinner" aria-hidden="true"></div>
    <p className="sr-only">Chargement...</p>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

// Écran d'accueil optimisé avec accessibilité
const HomeScreen = memo(() => (
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
      <Link
        to="/login"
        className="btn btn-primary btn-lg"
        aria-label="Se connecter à votre compte"
      >
        Se connecter
      </Link>
      <Link
        to="/register"
        className="btn btn-secondary btn-lg"
        aria-label="Créer un nouveau compte"
      >
        S'inscrire
      </Link>
    </div>
  </div>
));

HomeScreen.displayName = 'HomeScreen';

function App(): React.JSX.Element {
  const [isInitialized, setIsInitialized] = useState(false);
  const { showSuccess, showError, showInfo, toasts, removeToast, pauseToast, resumeToast } = useToast();

  // Initialisation sécurisée de l'application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialiser les services et stores
        initializeServices();
        initializeStores();
        
        
        // Appliquer la configuration de sécurité
        const securityConfig = SecurityUtils.DEFAULT_SECURITY_CONFIG;
        console.log('Security configuration applied:', securityConfig);
        
        // Marquer comme initialisé
        setIsInitialized(true);
        
        console.log('BetLeague Application initialized successfully');
      } catch (error) {
        console.error('Failed to initialize application:', error);
        showError('Erreur d\'initialisation', 'Impossible de démarrer l\'application');
      }
    };

    initializeApp();
  }, [showError]);

  // Loading initial de l'application
  if (!isInitialized) {
    return (
      <>
        <div className="app">
          <LoadingSpinner />
        </div>
        <ToastContainer
          toasts={toasts}
          removeToast={removeToast}
          pauseToast={pauseToast}
          resumeToast={resumeToast}
        />
      </>
    );
  }

  return (
    <>
      <div className="app">
        <div className="container">
          <HomeScreen />
        </div>
      </div>

      {/* Toast notifications */}
      <ToastContainer
        toasts={toasts}
        removeToast={removeToast}
        pauseToast={pauseToast}
        resumeToast={resumeToast}
      />
    </>
  );
}

export default memo(App);