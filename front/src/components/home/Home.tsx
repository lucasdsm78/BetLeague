import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import LegalLinks from '../legal/LegalLinks';
import { useReveal } from '../../hooks/useReveal';
import './Home.css';

const TICKER_ITEMS: ReadonlyArray<{ match: string; odds: string; tone: 'up' | 'down' | 'neutral' }> = [
  { match: 'PSG — OM', odds: '2.10', tone: 'up' },
  { match: 'Real — Barça', odds: '1.85', tone: 'neutral' },
  { match: 'LAL — BOS', odds: '2.45', tone: 'up' },
  { match: 'Nadal — Alcaraz', odds: '1.95', tone: 'down' },
  { match: 'France — Brésil', odds: '3.10', tone: 'up' },
  { match: 'Inter — Milan', odds: '2.05', tone: 'neutral' },
  { match: 'Djokovic — Sinner', odds: '2.30', tone: 'down' },
  { match: 'GSW — DEN', odds: '1.75', tone: 'up' },
];

const OddsTicker = memo(() => (
  <div className="bl-home__ticker" aria-hidden="true">
    <div className="bl-home__ticker-track">
      {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
        <div key={`${item.match}-${index}`} className="bl-home__ticker-item">
          <span className={`bl-home__ticker-dot bl-home__ticker-dot--${item.tone}`} />
          <span className="bl-home__ticker-match">{item.match}</span>
          <span className="bl-home__ticker-odds">{item.odds}</span>
        </div>
      ))}
    </div>
  </div>
));
OddsTicker.displayName = 'OddsTicker';

const HeroMockup = memo(() => (
  <div className="bl-home__mockup" aria-hidden="true">
    <div className="bl-home__mockup-glow" />
    <div className="bl-home__mockup-card bl-home__mockup-card--main">
      <div className="bl-home__mockup-card-header">
        <span className="bl-home__live-dot" />
        <span>Ligue des potes</span>
        <span className="bl-home__mockup-card-pill">8 joueurs</span>
      </div>
      <ul className="bl-home__mockup-leaderboard">
        <li>
          <span className="bl-home__mockup-rank bl-home__mockup-rank--gold">1</span>
          <span className="bl-home__mockup-name">Lucas</span>
          <span className="bl-home__mockup-pts">1 240 BTL</span>
        </li>
        <li>
          <span className="bl-home__mockup-rank">2</span>
          <span className="bl-home__mockup-name">Maxime</span>
          <span className="bl-home__mockup-pts">1 080 BTL</span>
        </li>
        <li>
          <span className="bl-home__mockup-rank">3</span>
          <span className="bl-home__mockup-name">Matthieu</span>
          <span className="bl-home__mockup-pts">965 BTL</span>
        </li>
      </ul>
    </div>

    <div className="bl-home__mockup-card bl-home__mockup-card--ticket">
      <div className="bl-home__mockup-ticket-header">
        <span>Ticket combiné</span>
        <span className="bl-home__mockup-ticket-cote">×4.20</span>
      </div>
      <div className="bl-home__mockup-ticket-row">
        <span className="bl-home__sport-dot bl-home__sport-dot--foot" />
        <span className="bl-home__mockup-ticket-match">PSG — OM</span>
        <span className="bl-home__mockup-ticket-odd">2.10</span>
      </div>
      <div className="bl-home__mockup-ticket-row">
        <span className="bl-home__sport-dot bl-home__sport-dot--basket" />
        <span className="bl-home__mockup-ticket-match">LAL — BOS</span>
        <span className="bl-home__mockup-ticket-odd">1.85</span>
      </div>
    </div>

    <div className="bl-home__mockup-orbit bl-home__mockup-orbit--1">⚽</div>
    <div className="bl-home__mockup-orbit bl-home__mockup-orbit--2">🏀</div>
    <div className="bl-home__mockup-orbit bl-home__mockup-orbit--3">🎾</div>
  </div>
));
HeroMockup.displayName = 'HeroMockup';

const Home = memo(() => {
  const benefits = useReveal<HTMLDivElement>();
  const steps = useReveal<HTMLDivElement>();
  const faq = useReveal<HTMLDivElement>();
  const cta = useReveal<HTMLDivElement>();

  return (
    <>
      <a className="bl-home__skip" href="#bl-home-main">Aller au contenu</a>
      <div className="bl-home">
        <div className="bl-home__bg" aria-hidden="true">
          <div className="bl-home__bg-orb bl-home__bg-orb--1" />
          <div className="bl-home__bg-orb bl-home__bg-orb--2" />
          <div className="bl-home__bg-grid" />
        </div>

        <main className="bl-home__main" id="bl-home-main">
          <section className="bl-home__hero">
            <div className="bl-home__hero-copy">
              <span className="bl-home__badge">
                <span className="bl-home__badge-pulse" aria-hidden="true" />
                100 % gratuit · Entre amis · Sans argent réel
              </span>

              <h1 className="bl-home__title">
                La ligue de <span className="bl-home__title-grad">pronostics sportifs</span> entre amis.
              </h1>

              <p className="bl-home__subtitle">
                Créez votre ligue, partagez vos tickets et défiez vos potes sur le foot, le basket ou le tennis.
                Une expérience mobile rapide, fluide et 100 % gratuite.
              </p>

              <div className="bl-home__cta-row">
                <Link to="/register" className="bl-home__btn bl-home__btn--primary" aria-label="Créer un compte BetLeague">
                  Commencer gratuitement
                  <span className="bl-home__btn-arrow" aria-hidden="true">→</span>
                </Link>
                <Link to="/login" className="bl-home__btn bl-home__btn--ghost" aria-label="Se connecter">
                  J&apos;ai déjà un compte
                </Link>
              </div>

              <ul className="bl-home__trust" aria-label="Garanties">
                <li>
                  <span className="bl-home__trust-icon" aria-hidden="true">🔒</span>
                  <span>Données chiffrées</span>
                </li>
                <li>
                  <span className="bl-home__trust-icon" aria-hidden="true">⚡</span>
                  <span>PWA mobile-first</span>
                </li>
                <li>
                  <span className="bl-home__trust-icon" aria-hidden="true">🎯</span>
                  <span>Sans pub, sans argent</span>
                </li>
              </ul>
            </div>

            <HeroMockup />
          </section>

          <OddsTicker />

          <section
            className={`bl-home__section bl-home__reveal ${benefits.isVisible ? 'is-visible' : ''}`}
            ref={benefits.ref}
            aria-labelledby="bl-bento-title"
          >
            <header className="bl-home__section-header">
              <span className="bl-home__kicker">Tout-en-un</span>
              <h2 id="bl-bento-title">Une plateforme pensée pour vos ligues</h2>
              <p>Trois espaces complémentaires pour faire vivre votre groupe toute la saison.</p>
            </header>

            <div className="bl-home__bento">
              <article className="bl-home__bento-card bl-home__bento-card--feature">
                <div className="bl-home__bento-icon" aria-hidden="true">🏆</div>
                <h3>Ligues privées</h3>
                <p>Invitez vos amis, organisez vos matchs et suivez un classement clair, à jour en temps réel.</p>
                <div className="bl-home__bento-preview">
                  <div className="bl-home__preview-row">
                    <span className="bl-home__preview-medal bl-home__preview-medal--gold">1</span>
                    <span>Lucas</span>
                    <strong>+340</strong>
                  </div>
                  <div className="bl-home__preview-row">
                    <span className="bl-home__preview-medal bl-home__preview-medal--silver">2</span>
                    <span>Maxime</span>
                    <strong>+180</strong>
                  </div>
                  <div className="bl-home__preview-row">
                    <span className="bl-home__preview-medal bl-home__preview-medal--bronze">3</span>
                    <span>Matthieu</span>
                    <strong>+65</strong>
                  </div>
                </div>
              </article>

              <article className="bl-home__bento-card">
                <div className="bl-home__bento-icon" aria-hidden="true">🎯</div>
                <h3>Tournois</h3>
                <p>Affrontez 16 joueurs en élimination directe. Format saisonnier ou one-shot.</p>
                <div className="bl-home__bracket" aria-hidden="true">
                  <span className="bl-home__bracket-cell bl-home__bracket-cell--win">A</span>
                  <span className="bl-home__bracket-cell">B</span>
                  <span className="bl-home__bracket-cell bl-home__bracket-cell--win">C</span>
                  <span className="bl-home__bracket-cell">D</span>
                </div>
              </article>

              <article className="bl-home__bento-card">
                <div className="bl-home__bento-icon" aria-hidden="true">🎟️</div>
                <h3>Tickets partagés</h3>
                <p>Publiez vos paris, commentez ceux de vos amis et comparez vos performances.</p>
                <div className="bl-home__ticket-preview" aria-hidden="true">
                  <div className="bl-home__ticket-preview-line">
                    <span>PSG — OM</span>
                    <strong>2.10</strong>
                  </div>
                  <div className="bl-home__ticket-preview-line">
                    <span>LAL — BOS</span>
                    <strong>1.85</strong>
                  </div>
                  <div className="bl-home__ticket-preview-total">
                    <span>Cote totale</span>
                    <strong className="bl-home__ticket-preview-cote">×3.89</strong>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section
            className={`bl-home__section bl-home__reveal ${steps.isVisible ? 'is-visible' : ''}`}
            ref={steps.ref}
            aria-labelledby="bl-steps-title"
          >
            <header className="bl-home__section-header">
              <span className="bl-home__kicker">3 étapes</span>
              <h2 id="bl-steps-title">Lancez votre ligue en moins de 60 secondes</h2>
            </header>

            <ol className="bl-home__steps">
              <li className="bl-home__step">
                <span className="bl-home__step-num">01</span>
                <h3>Créez votre compte</h3>
                <p>Inscription gratuite, sans carte bancaire ni vérification d&apos;identité.</p>
              </li>
              <li className="bl-home__step">
                <span className="bl-home__step-num">02</span>
                <h3>Invitez vos amis</h3>
                <p>Partagez un lien et démarrez votre ligue privée en quelques clics.</p>
              </li>
              <li className="bl-home__step">
                <span className="bl-home__step-num">03</span>
                <h3>Pronostiquez ensemble</h3>
                <p>Postez vos tickets, suivez le classement et défiez vos potes chaque semaine.</p>
              </li>
            </ol>
          </section>

          <section
            className={`bl-home__section bl-home__reveal ${faq.isVisible ? 'is-visible' : ''}`}
            ref={faq.ref}
            aria-labelledby="bl-faq-title"
          >
            <header className="bl-home__section-header">
              <span className="bl-home__kicker">FAQ</span>
              <h2 id="bl-faq-title">Vos questions, nos réponses</h2>
            </header>

            <div className="bl-home__faq">
              <details className="bl-home__faq-item">
                <summary>
                  <span>BetLeague est-il vraiment gratuit&nbsp;?</span>
                  <span className="bl-home__faq-chevron" aria-hidden="true">+</span>
                </summary>
                <p>
                  Oui. BetLeague repose sur des points fictifs (BTL) sans valeur monétaire. Aucun
                  retrait, aucun lot, aucun gain en argent réel.
                </p>
              </details>

              <details className="bl-home__faq-item">
                <summary>
                  <span>Comment fonctionnent les ligues&nbsp;?</span>
                  <span className="bl-home__faq-chevron" aria-hidden="true">+</span>
                </summary>
                <p>
                  Vous créez une ligue privée, invitez vos amis par lien, choisissez vos matchs et
                  publiez vos tickets. Un classement vous départage en temps réel.
                </p>
              </details>

              <details className="bl-home__faq-item">
                <summary>
                  <span>L&apos;application est-elle optimisée mobile&nbsp;?</span>
                  <span className="bl-home__faq-chevron" aria-hidden="true">+</span>
                </summary>
                <p>
                  Oui. BetLeague est une PWA installable, pensée mobile-first avec un bundle léger
                  et des temps de chargement courts.
                </p>
              </details>

              <details className="bl-home__faq-item">
                <summary>
                  <span>Mes données sont-elles protégées&nbsp;?</span>
                  <span className="bl-home__faq-chevron" aria-hidden="true">+</span>
                </summary>
                <p>
                  Vos données sont chiffrées, l&apos;authentification supporte le 2FA et nous
                  appliquons les meilleures pratiques OWASP (CSP, HSTS, COOP/CORP).
                </p>
              </details>
            </div>
          </section>

          <section
            className={`bl-home__finalcta bl-home__reveal ${cta.isVisible ? 'is-visible' : ''}`}
            ref={cta.ref}
          >
            <div className="bl-home__finalcta-inner">
              <h2>Prêt à lancer votre ligue&nbsp;?</h2>
              <p>Rejoignez la communauté BetLeague et devenez le meilleur pronostiqueur de votre groupe.</p>

              <div className="bl-home__cta-row bl-home__cta-row--center">
                <Link to="/register" className="bl-home__btn bl-home__btn--primary bl-home__btn--xl">
                  Créer ma ligue
                  <span className="bl-home__btn-arrow" aria-hidden="true">→</span>
                </Link>
                <Link to="/login" className="bl-home__btn bl-home__btn--ghost bl-home__btn--xl">
                  Se connecter
                </Link>
              </div>

              <p className="bl-home__finalcta-note">
                <span aria-hidden="true">🔒</span>
                Jeu social gratuit · Sans carte bancaire · Données sécurisées
              </p>

              <div className="bl-home__legal">
                <p>Les BTL sont des points fictifs sans valeur monétaire.</p>
                <LegalLinks />
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
});

Home.displayName = 'Home';

export default Home;
