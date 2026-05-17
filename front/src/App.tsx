/**
 * App Component - Main Application Entry Point
 * Refactored with TypeScript and integrated with new architecture
 */

import React, { memo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { initializeServices } from './services';
import { initializeStores } from './store';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import LegalLinks from './components/legal/LegalLinks';
import './styles/App.css';

// Home légère et orientée SEO/LCP
const HomeScreen = memo(() => (
  <>
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <div className="home-screen">
      <main className="home-main" id="main-content">
        <section className="hero-section">
          <div className="hero-badge">
            <span className="badge-icon" aria-hidden="true">⚡</span>
            <span>Pronostic gratuit entre amis, sans argent réel</span>
          </div>

          <div className="logo">
            <picture className="logo-picture">
              <source srcSet="/betleague-logo.jpg" type="image/jpeg" />
              <img
                src="/betleague-logo.jpg"
                alt="BetLeague, application de pronostic gratuit entre amis"
                className="logo-image"
                width="176"
                height="176"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </picture>
          </div>

          <div className="home-intro">
            <h1>BetLeague, l’application de pronostic gratuit entre amis</h1>
            <p className="hero-description">
              Créez une ligue de pronostics sportifs, partagez vos tickets et profitez de paris
              sportifs gratuits dans une expérience mobile rapide, fluide et sécurisée.
            </p>
          </div>

          <div className="auth-buttons">
            <Link to="/register" className="btn btn-primary btn-lg" aria-label="Créer un nouveau compte">
              Commencer gratuitement
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg" aria-label="Se connecter à votre compte">
              J&apos;ai déjà un compte
            </Link>
          </div>

          <div className="hero-stats" aria-label="Bénéfices principaux BetLeague">
            <div className="stat-item">
              <span className="stat-value">Mobile-first</span>
              <span className="stat-label">Chargement rapide</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">100 % gratuit</span>
              <span className="stat-label">Points fictifs</span>
            </div>
          </div>
        </section>

        <section className="content-section" aria-labelledby="home-benefits-title">
          <div className="section-heading">
            <span className="section-kicker">Créer sa ligue</span>
            <h2 id="home-benefits-title">Une ligue paris sportifs simple à lancer avec ses amis</h2>
            <p>
              BetLeague aide chaque groupe à organiser une compétition claire, suivre ses tickets
              et comparer ses résultats sans complexité.
            </p>
          </div>

          <div className="benefits-grid">
            <article className="benefit-card">
              <h3>Invitations rapides</h3>
              <p>
                Créez votre ligue paris sportifs en quelques secondes, invitez vos proches et
                centralisez vos matchs dans un seul espace.
              </p>
            </article>
            <article className="benefit-card">
              <h3>Tickets et classements</h3>
              <p>
                Suivez vos paris sportifs gratuits, vos performances et les écarts entre joueurs
                avec une lecture claire sur mobile.
              </p>
            </article>
            <article className="benefit-card">
              <h3>Tournois privés</h3>
              <p>
                Passez d’une ligue de pronostics sportifs classique à des formats tournoi pour
                animer votre groupe toute la saison.
              </p>
            </article>
          </div>
        </section>

        <section className="content-section content-section--faq" aria-labelledby="home-faq-title">
          <div className="section-heading">
            <span className="section-kicker">Questions fréquentes</span>
            <h2 id="home-faq-title">Tout ce qu’il faut pour jouer entre amis</h2>
            <p>
              Le service reste pensé comme un jeu social : rapide à comprendre, facile à partager et
              sans mise d’argent réel.
            </p>
          </div>

          <div className="faq-grid">
            <article className="faq-card">
              <h3>BetLeague est-il payant&nbsp;?</h3>
              <p>
                Non. BetLeague repose sur un système de points fictifs et garde l’esprit d’un
                pronostic gratuit entre amis, sans retrait ni gain monétaire.
              </p>
            </article>
            <article className="faq-card">
              <h3>Peut-on jouer sur smartphone&nbsp;?</h3>
              <p>
                Oui. L’interface a été pensée pour une navigation tactile rapide, avec des temps de
                chargement courts et un above-the-fold très léger.
              </p>
            </article>
            <article className="faq-card">
              <h3>Que partage-t-on dans la ligue&nbsp;?</h3>
              <p>
                Les membres peuvent publier leurs tickets, consulter les classements et suivre les
                résultats dans une vraie ligue de pronostics sportifs privée.
              </p>
            </article>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-content">
            <h2>Prêt à lancer votre compétition&nbsp;?</h2>
            <p>Inscription gratuite, sans carte bancaire, avec une expérience optimisée mobile.</p>
          </div>

          <div className="auth-buttons">
            <Link to="/register" className="btn btn-primary btn-lg" aria-label="Créer un nouveau compte">
              Créer ma ligue
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg" aria-label="Se connecter à votre compte">
              Se connecter
            </Link>
          </div>

          <p className="cta-note">
            <span className="note-icon" aria-hidden="true">🔒</span>
            Jeu social gratuit • Sans carte bancaire • Données sécurisées
          </p>

          <div className="legal-teaser">
            <p className="legal-teaser__title">BetLeague reste un jeu social 100&nbsp;% gratuit</p>
            <p className="legal-teaser__text">
              Les BTL sont des points fictifs sans valeur monétaire. Aucun retrait, aucun gain en
              argent et aucun lot matériel ne sont proposés dans l’application.
            </p>
            <LegalLinks />
          </div>
        </section>
      </main>
    </div>
  </>
));

HomeScreen.displayName = 'HomeScreen';

function App(): React.JSX.Element {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        initializeServices();
        initializeStores();
      } catch (error) {
        console.error("Erreur d'initialisation", error);
      }
    };

    void initializeApp();
  }, []);

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
