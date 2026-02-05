/**
 * App Component - Main Application Entry Point
 * Refactored with TypeScript and integrated with new architecture
 */

import React, { useState, memo, useEffect } from 'react';
import { initializeServices } from './services';
import { initializeStores } from './store';
import SecurityUtils from './utils/security';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import './styles/App.css';


// Composant de loading sécurisé
const LoadingSpinner = memo(() => (
  <div className="loading-spinner" role="status" aria-label="Chargement en cours">
    <div className="spinner" aria-hidden="true"></div>
    <p className="sr-only">Chargement...</p>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

// Écran d'accueil redesigné - Style Paris Sportifs Premium
const HomeScreen = memo(() => (
  <div className="home-screen">
    {/* Formes décoratives flottantes */}
    <div className="decorative-shapes" aria-hidden="true">
      <div className="shape shape-circle shape-1"></div>
      <div className="shape shape-circle shape-2"></div>
      <div className="shape shape-circle shape-3"></div>
      <div className="shape shape-triangle shape-4"></div>
      <div className="shape shape-triangle shape-5"></div>
      <div className="shape shape-square shape-6"></div>
      <div className="shape shape-square shape-7"></div>
      <div className="shape shape-line shape-8"></div>
      <div className="shape shape-line shape-9"></div>
      <div className="shape shape-dot shape-10"></div>
      <div className="shape shape-dot shape-11"></div>
      <div className="shape shape-dot shape-12"></div>
    </div>

    {/* Hero Section */}
    <section className="hero-section">
      <div className="hero-badge">
        <span className="badge-icon">⚡</span>
        <span>La référence des paris entre amis</span>
      </div>

      <div className="logo">
        <div className="logo-ball">
          <span className="logo-icon" role="img" aria-label="Football">⚽</span>
        </div>
        <h1>BetLeague</h1>
      </div>

      <p className="tagline">
        Créez vos ligues, défiez vos amis et prouvez que vous êtes le meilleur pronostiqueur
      </p>

      <div className="hero-stats">
        <div className="stat-item">
          <span className="stat-value">10K+</span>
          <span className="stat-label">Joueurs actifs</span>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-item">
          <span className="stat-value">500+</span>
          <span className="stat-label">Ligues créées</span>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-item">
          <span className="stat-value">50K+</span>
          <span className="stat-label">Paris placés</span>
        </div>
      </div>
    </section>

    {/* Features Section */}
    <section className="features-section">
      <div className="features-grid">
        <div className="feature-card feature-card--primary">
          <div className="feature-icon-wrapper">
            <span className="feature-icon" role="img" aria-label="Trophée">🏆</span>
          </div>
          <h3>Ligues Privées</h3>
          <p>Créez des ligues exclusives et invitez vos amis pour des compétitions privées</p>
        </div>

        <div className="feature-card feature-card--accent">
          <div className="feature-icon-wrapper">
            <span className="feature-icon" role="img" aria-label="Tournoi">🎯</span>
          </div>
          <h3>Tournois</h3>
          <p>Affrontez 16 joueurs dans des tournois à élimination directe</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon-wrapper">
            <span className="feature-icon" role="img" aria-label="Graphique">📊</span>
          </div>
          <h3>Stats Live</h3>
          <p>Suivez vos performances et celles de vos adversaires en temps réel</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon-wrapper">
            <span className="feature-icon" role="img" aria-label="Mobile">📱</span>
          </div>
          <h3>100% Mobile</h3>
          <p>Pariez où vous voulez, quand vous voulez depuis votre smartphone</p>
        </div>
      </div>
    </section>

    {/* CTA Section */}
    <section className="cta-section">
      <div className="cta-content">
        <h2>Prêt à relever le défi ?</h2>
        <p>Rejoignez la communauté et montrez vos talents de pronostiqueur</p>
      </div>

      <div className="auth-buttons">
        <button
          onClick={() => window.location.href = '/register'}
          className="btn btn-primary btn-lg btn-glow"
          aria-label="Créer un nouveau compte"
        >
          <span className="btn-icon">🚀</span>
          Commencer gratuitement
        </button>
        <button
          onClick={() => window.location.href = '/login'}
          className="btn btn-secondary btn-lg"
          aria-label="Se connecter à votre compte"
        >
          J'ai déjà un compte
        </button>
      </div>

      <p className="cta-note">
        <span className="note-icon">🔒</span>
        Inscription gratuite • Sans carte bancaire • Données sécurisées
      </p>
    </section>
  </div>
));

HomeScreen.displayName = 'HomeScreen';

function App(): React.JSX.Element {
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialisation sécurisée de l'application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialiser les services et stores
        initializeServices();
        initializeStores();


        // Appliquer la configuration de sécurité
        SecurityUtils.DEFAULT_SECURITY_CONFIG;

        // Marquer comme initialisé
        setIsInitialized(true);

      } catch (error) {
        // Pas de toast ici: l'UI n'est pas forcément prête (splash).
        console.error("Erreur d'initialisation", error);
      }
    };

    initializeApp();
  }, []); // Removed showError - it's stable and doesn't need to trigger re-initialization

  // Loading initial de l'application
  if (!isInitialized) {
    return (
      <div className="app">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <HomeScreen />
      </div>
      <InstallPrompt />
    </div>
  );
}

export default memo(App);
