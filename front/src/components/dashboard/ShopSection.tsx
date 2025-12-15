import React, { useState, useCallback, memo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import './ShopSection.css';
import BTLPurchaseModal from './BTLPurchaseModal';
import TournamentSubscriptionModal from './TournamentSubscriptionModal';
import { useUserProfile } from 'hooks/useUserProfile';
import { useAuthStore } from 'store/authStore';
import { getSubscriptionPlan } from 'services/subscriptionApi';

type ShopTabType = 'packs' | 'subscription';

const ShopSection: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState<ShopTabType>('packs');
  const [isBTLPurchaseModalOpen, setIsBTLPurchaseModalOpen] = useState(false);
  const [isTournamentSubscriptionModalOpen, setIsTournamentSubscriptionModalOpen] = useState(false);
  const [showSubscriptionSuccessModal, setShowSubscriptionSuccessModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, refetch } = useUserProfile();
  const { user } = useAuthStore();
  const subscriptionPlan = getSubscriptionPlan();

  // Detect subscription success from URL
  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription');

    if (subscriptionStatus === 'success') {
      setShowSubscriptionSuccessModal(true);
      refetch();
      searchParams.delete('subscription');
      setSearchParams(searchParams, { replace: true });
    } else if (subscriptionStatus === 'cancelled') {
      searchParams.delete('subscription');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, refetch]);

  const handleOpenBTLPurchase = useCallback(() => {
    setIsBTLPurchaseModalOpen(true);
  }, []);

  const handleCloseBTLPurchase = useCallback(() => {
    setIsBTLPurchaseModalOpen(false);
  }, []);

  const handlePurchaseComplete = useCallback(() => {
    setIsBTLPurchaseModalOpen(false);
    refetch();
  }, [refetch]);

  const handleOpenTournamentSubscription = useCallback(() => {
    setIsTournamentSubscriptionModalOpen(true);
  }, []);

  const handleCloseTournamentSubscription = useCallback(() => {
    setIsTournamentSubscriptionModalOpen(false);
  }, []);

  const handleSubscriptionComplete = useCallback(() => {
    setIsTournamentSubscriptionModalOpen(false);
    refetch();
  }, [refetch]);

  return (
    <div className="shop-section">
      <div className="shop-header">
        <div className="shop-title-section">
          <h1 className="shop-title">Boutique BetLeague</h1>
          <p className="shop-subtitle">Achetez des BTL ou accédez aux tournois avec un abonnement</p>
        </div>

        {profile && (
          <div className="shop-balance-card">
            <div className="balance-label">Votre solde</div>
            <div className="balance-value">{profile.nb_btl.toFixed(2)} BTL</div>
          </div>
        )}
      </div>

      <div className="shop-tabs">
        <button
          className={`shop-tab ${activeTab === 'packs' ? 'active' : ''}`}
          onClick={() => setActiveTab('packs')}
        >
          <span className="tab-icon">💰</span>
          <span className="tab-label">Packs BTL</span>
        </button>
        <button
          className={`shop-tab ${activeTab === 'subscription' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscription')}
        >
          <span className="tab-icon">🏆</span>
          <span className="tab-label">Abonnement tournois</span>
        </button>
      </div>

      <div className="shop-content">
        {activeTab === 'packs' ? (
          <div className="packs-section">
            <div className="section-header">
              <h2>Packs BTL</h2>
              <p>Rechargez votre solde pour participer aux ligues et faire vos paris</p>
            </div>

            <div className="shop-feature-cards">
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Instantané</h3>
                <p>Créditez votre compte immédiatement après paiement</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <h3>Sécurisé</h3>
                <p>Paiement 100% sécurisé via Stripe</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎁</div>
                <h3>Bonus</h3>
                <p>Plus vous achetez, plus vous gagnez de bonus</p>
              </div>
            </div>

            <div className="cta-section">
              <button
                className="btn btn-primary btn-lg shop-cta"
                onClick={handleOpenBTLPurchase}
              >
                <span className="cta-icon">💳</span>
                Acheter des BTL
              </button>
              <p className="cta-description">
                Sélectionnez le pack qui vous convient le mieux
              </p>
            </div>

            <div className="info-section">
              <h3>Comment ça marche ?</h3>
              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <h4>Choisissez</h4>
                  <p>Sélectionnez le pack BTL qui correspond à vos besoins</p>
                </div>
                <div className="step-card">
                  <div className="step-number">2</div>
                  <h4>Payez</h4>
                  <p>Effectuez le paiement sécurisé via Stripe</p>
                </div>
                <div className="step-card">
                  <div className="step-number">3</div>
                  <h4>Profitez</h4>
                  <p>Vos BTL sont crédités instantanément sur votre compte</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="subscription-section">
            <div className="section-header">
              <h2>Abonnement tournois</h2>
              <p>Participez aux tournois exclusifs et gagnez des récompenses</p>
            </div>

            <div className="subscription-status-banner">
              {user?.isTournamentSubscriber ? (
                <div className="status-active">
                  <span className="status-icon">✓</span>
                  <span className="status-text">Votre abonnement est actif</span>
                </div>
              ) : (
                <div className="status-inactive">
                  <span className="status-icon">ℹ️</span>
                  <span className="status-text">Abonnez-vous pour accéder aux tournois</span>
                </div>
              )}
            </div>

            <div className="subscription-card tournament">
              <div className="subscription-badge-new">
                <span className="badge-icon">🏆</span>
                Populaire
              </div>
              <h3>{subscriptionPlan.name}</h3>
              <div className="subscription-price">
                <span className="price">{(subscriptionPlan.price / 100).toFixed(2)}€</span>
                <span className="period">/mois</span>
              </div>

              <ul className="subscription-features">
                {subscriptionPlan.features.map((feature, index) => (
                  <li key={index}>
                    <span className="feature-check">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {user?.isTournamentSubscriber ? (
                <button className="btn btn-secondary btn-lg" disabled>
                  <span className="check-icon">✓</span>
                  Déjà abonné
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-lg tournament-subscribe-btn"
                  onClick={handleOpenTournamentSubscription}
                >
                  S'abonner maintenant
                </button>
              )}
            </div>

            <div className="tournament-explanation">
              <div className="tournament-hero">
                <div className="tournament-hero-badge">🏆</div>
                <h3 className="tournament-hero-title">Tournois BetLeague</h3>
                <p className="tournament-hero-subtitle">Votre chance de briller !</p>
              </div>

              <div className="tournament-intro-box">
                <div className="tournament-intro-highlight">
                  <span className="highlight-number">16</span>
                  <span className="highlight-text">joueurs entrent</span>
                </div>
                <div className="tournament-intro-arrow">→</div>
                <div className="tournament-intro-highlight">
                  <span className="highlight-number">1</span>
                  <span className="highlight-text">seul remporte tout</span>
                </div>
              </div>

              <div className="tournament-compact-section">
                <p className="tournament-pitch">
                  Affrontez 15 autres joueurs dans une <strong>compétition à élimination directe</strong> de <strong>7 jours</strong>.
                  À chaque tour, vous affrontez 1 adversaire. Celui qui a le plus de BTL passe au suivant, l'autre est éliminé !
                </p>
              </div>

              <div className="tournament-stages-visual">
                <div className="stage-item">
                  <div className="stage-badge">1/8</div>
                  <div className="stage-name">8èmes</div>
                  <div className="stage-players">16 → 8</div>
                  <div className="stage-duration">2 jours</div>
                </div>
                <div className="stage-arrow">→</div>
                <div className="stage-item">
                  <div className="stage-badge">1/4</div>
                  <div className="stage-name">Quarts</div>
                  <div className="stage-players">8 → 4</div>
                  <div className="stage-duration">2 jours</div>
                </div>
                <div className="stage-arrow">→</div>
                <div className="stage-item">
                  <div className="stage-badge">1/2</div>
                  <div className="stage-name">Demi</div>
                  <div className="stage-players">4 → 2</div>
                  <div className="stage-duration">2 jours</div>
                </div>
                <div className="stage-arrow">→</div>
                <div className="stage-item stage-item-final">
                  <div className="stage-badge">🏆</div>
                  <div className="stage-name">Finale</div>
                  <div className="stage-players">2 → 1</div>
                  <div className="stage-duration">1 jour</div>
                </div>
              </div>

              <div className="tournament-key-features">
                <div className="key-feature">
                  <div className="key-feature-icon">⚡</div>
                  <div className="key-feature-content">
                    <strong>Action rapide</strong>
                    <span>Seulement 7 jours</span>
                  </div>
                </div>
                <div className="key-feature">
                  <div className="key-feature-icon">🎯</div>
                  <div className="key-feature-content">
                    <strong>Stratégie payante</strong>
                    <span>Chaque décision compte</span>
                  </div>
                </div>
                <div className="key-feature">
                  <div className="key-feature-icon">🏅</div>
                  <div className="key-feature-content">
                    <strong>Récompenses exclusives</strong>
                    <span>BTL et badges uniques</span>
                  </div>
                </div>
              </div>

              <div className="tournament-cta-box">
                <p className="tournament-cta-text">
                  <strong>Élimination directe</strong> - Pas de deuxième chance. Vous perdez, vous sortez.
                  Vous gagnez, vous continuez vers le titre de champion !
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isBTLPurchaseModalOpen && (
        <BTLPurchaseModal
          onClose={handleCloseBTLPurchase}
          onPurchaseComplete={handlePurchaseComplete}
        />
      )}

      {isTournamentSubscriptionModalOpen && (
        <TournamentSubscriptionModal
          onClose={handleCloseTournamentSubscription}
          onSubscriptionComplete={handleSubscriptionComplete}
        />
      )}

      {showSubscriptionSuccessModal && (
        <div className="modal-overlay" onClick={() => setShowSubscriptionSuccessModal(false)}>
          <div className="modal-content subscription-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="success-icon-large tournament">🏆</div>
              <h2>Abonnement activé !</h2>
              <button
                className="modal-close"
                onClick={() => setShowSubscriptionSuccessModal(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="success-message">
                Félicitations ! Votre abonnement aux tournois est maintenant actif.
                Vous pouvez dès maintenant participer à tous les tournois disponibles.
              </p>
              <div className="subscription-success-features">
                <div className="success-feature">
                  <span className="success-feature-icon">✓</span>
                  <span>Accès illimité aux tournois</span>
                </div>
                <div className="success-feature">
                  <span className="success-feature-icon">✓</span>
                  <span>Création de tournois privés</span>
                </div>
                <div className="success-feature">
                  <span className="success-feature-icon">✓</span>
                  <span>Statistiques avancées</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => setShowSubscriptionSuccessModal(false)}
              >
                Commencer à jouer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ShopSection.displayName = 'ShopSection';

export default ShopSection;
