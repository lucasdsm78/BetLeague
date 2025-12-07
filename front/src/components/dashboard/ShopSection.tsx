import React, { useState, useCallback, memo } from 'react';
import './ShopSection.css';
import BTLPurchaseModal from './BTLPurchaseModal';
import { useUserProfile } from 'hooks/useUserProfile';

type ShopTabType = 'packs' | 'subscription';

const ShopSection: React.FC = memo(() => {
  const [activeTab, setActiveTab] = useState<ShopTabType>('packs');
  const [isBTLPurchaseModalOpen, setIsBTLPurchaseModalOpen] = useState(false);
  const { profile, refetch } = useUserProfile();

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

  return (
    <div className="shop-section">
      <div className="shop-header">
        <div className="shop-title-section">
          <h1 className="shop-title">Boutique BetLeague</h1>
          <p className="shop-subtitle">Achetez des BTL ou souscrivez à un abonnement premium</p>
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
          <span className="tab-icon">⭐</span>
          <span className="tab-label">Abonnement Premium</span>
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
              <h2>Abonnement Premium</h2>
              <p>Accédez aux tournois exclusifs et aux fonctionnalités avancées</p>
            </div>

            <div className="subscription-card premium">
              <div className="subscription-badge">Bientôt disponible</div>
              <h3>Premium</h3>
              <div className="subscription-price">
                <span className="price">9,99€</span>
                <span className="period">/mois</span>
              </div>

              <ul className="subscription-features">
                <li>
                  <span className="feature-check">✓</span>
                  Accès aux tournois exclusifs
                </li>
                <li>
                  <span className="feature-check">✓</span>
                  Statistiques avancées
                </li>
                <li>
                  <span className="feature-check">✓</span>
                  Bonus BTL mensuel
                </li>
                <li>
                  <span className="feature-check">✓</span>
                  Support prioritaire
                </li>
                <li>
                  <span className="feature-check">✓</span>
                  Badge premium
                </li>
              </ul>

              <button className="btn btn-secondary btn-lg" disabled>
                Bientôt disponible
              </button>
            </div>

            <div className="info-box">
              <div className="info-icon">ℹ️</div>
              <div className="info-content">
                <h4>Abonnement Premium</h4>
                <p>
                  L'abonnement premium sera bientôt disponible. Inscrivez-vous à notre newsletter
                  pour être informé du lancement et bénéficier d'une offre exclusive.
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
    </div>
  );
});

ShopSection.displayName = 'ShopSection';

export default ShopSection;
