import React, { useState, useCallback, memo, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './ShopSection.css';
import BTLPurchaseModal from './BTLPurchaseModal';
import PurchaseHistory from './PurchaseHistory';
import TournamentSubscriptionModal from './TournamentSubscriptionModal';
import { useProfileMeQuery } from '../../hooks/queries/useProfileQuery';
import { useTournamentSubscriptionPlansQuery } from '../../hooks/queries/useTournamentQueries';
import { useAuthStore } from 'store/authStore';
import {
  enrichSubscriptionPlans,
  getDefaultSubscriptionPlanId,
  getSubscriptionEquivalentMonthlyPrice,
  getSubscriptionIntervalLabel,
  getSubscriptionPlanById,
  getYearlyDiscountBadgeLabel,
} from '../../utils/subscriptionPlan';
import { useGlobalToast } from '../../toast/ToastProvider';
import { formatPriceLabel } from '../../utils/pricing';
import { purchaseKeys } from '../../hooks/queries/purchaseKeys';

type ShopTabType = 'packs' | 'subscription';

const ShopSection: React.FC = memo(() => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ShopTabType>('packs');
  const [isBTLPurchaseModalOpen, setIsBTLPurchaseModalOpen] = useState(false);
  const [isTournamentSubscriptionModalOpen, setIsTournamentSubscriptionModalOpen] = useState(false);
  const [showSubscriptionSuccessModal, setShowSubscriptionSuccessModal] = useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [showPackPurchaseSuccessModal, setShowPackPurchaseSuccessModal] = useState(false);
  const [showPackPurchaseCancelledModal, setShowPackPurchaseCancelledModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: profile, refetch } = useProfileMeQuery();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const toast = useGlobalToast();
  const subscriptionPlansQuery = useTournamentSubscriptionPlansQuery({ enabled: activeTab === 'subscription' });
  const subscriptionPlans = useMemo(
    () => (subscriptionPlansQuery.data ? enrichSubscriptionPlans(subscriptionPlansQuery.data) : []),
    [subscriptionPlansQuery.data],
  );
  const featuredPlan = useMemo(() => {
    if (subscriptionPlans.length === 0) return undefined;
    const defaultId = getDefaultSubscriptionPlanId(subscriptionPlans);
    return getSubscriptionPlanById(subscriptionPlans, defaultId);
  }, [subscriptionPlans]);
  const monthlyPlan = useMemo(
    () => getSubscriptionPlanById(subscriptionPlans, 'monthly'),
    [subscriptionPlans],
  );
  const annualReferencePriceCents = useMemo(
    () => (monthlyPlan ? monthlyPlan.price_cents * 12 : null),
    [monthlyPlan],
  );

  // Detect subscription success from URL
  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription');

    if (subscriptionStatus === 'success') {
      // Stripe a redirigé, mais la source de vérité reste le backend.
      void (async () => {
        try {
          const res = await refetch();
          const isSub = Boolean(res.data?.is_tournament_subscriber);
          updateUser({ isTournamentSubscriber: isSub });

          if (isSub) {
            toast.showSuccess('Abonnement activé', 'Tu peux maintenant accéder aux tournois.');
            navigate('/tournaments', { replace: true });
          } else {
            // Webhook en retard: fallback UX (pas de flash car on reste sur /shop)
            toast.showInfo('Paiement reçu', "Nous finalisons ton abonnement. Réessaie dans quelques secondes.");
            setShowSubscriptionSuccessModal(true);
          }
        } catch {
          // best effort
          setShowSubscriptionSuccessModal(true);
        }
      })();
      searchParams.delete('subscription');
      setSearchParams(searchParams, { replace: true });
    } else if (subscriptionStatus === 'cancelled') {
      searchParams.delete('subscription');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, refetch, updateUser, toast, navigate]);

  const handleGoToTournamentsFromModal = useCallback(async () => {
    if (isCheckingSubscription) return;
    setIsCheckingSubscription(true);
    try {
      const res = await refetch();
      const isSub = Boolean(res.data?.is_tournament_subscriber);
      updateUser({ isTournamentSubscriber: isSub });
      if (isSub) {
        setShowSubscriptionSuccessModal(false);
        toast.showSuccess('Abonnement activé', 'Accès aux tournois débloqué.');
        navigate('/tournaments');
      } else {
        toast.showInfo('Activation en cours', "Toujours en cours. Réessaie dans quelques secondes.");
      }
    } catch {
      toast.showError('Erreur', "Impossible de vérifier l'abonnement.");
    } finally {
      setIsCheckingSubscription(false);
    }
  }, [isCheckingSubscription, refetch, updateUser, toast, navigate]);

  // Detect pack purchase success/cancel from URL
  useEffect(() => {
    const purchaseStatus = searchParams.get('purchase');
    if (!purchaseStatus) return;

    if (purchaseStatus === 'success') {
      setActiveTab('packs');
      setShowPackPurchaseSuccessModal(true);
      // Refresh user profile to update nb_btl (webhook should have credited it)
      refetch();
      queryClient.invalidateQueries({ queryKey: purchaseKeys.mine() });
    } else if (purchaseStatus === 'cancelled') {
      setActiveTab('packs');
      setShowPackPurchaseCancelledModal(true);
      queryClient.invalidateQueries({ queryKey: purchaseKeys.mine() });
    }

    searchParams.delete('purchase');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, refetch, queryClient]);

  const handleOpenBTLPurchase = useCallback(() => {
    setIsBTLPurchaseModalOpen(true);
  }, []);

  const handleCloseBTLPurchase = useCallback(() => {
    setIsBTLPurchaseModalOpen(false);
  }, []);

  const handlePurchaseComplete = useCallback(() => {
    setIsBTLPurchaseModalOpen(false);
  }, []);

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

  const handleSubscriptionCancellationComplete = useCallback((message: string) => {
    toast.showSuccess('Résiliation planifiée', message);
    void refetch().then((res) => {
      updateUser({ isTournamentSubscriber: Boolean(res.data?.is_tournament_subscriber) });
    }).catch(() => {
      // best effort: l'état du store reste cohérent avec l'accès encore actif jusqu'à fin de période
    });
  }, [refetch, toast, updateUser]);

  return (
    <div className="shop-section">
      <div className="shop-header">
        <div className="shop-title-section">
          <h1 className="shop-title">Boutique BetLeague</h1>
          <p className="shop-subtitle">Achetez des BTL ou débloquez la création de tournois illimitée après vos 2 gratuits mensuels</p>
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

            <PurchaseHistory enabled={activeTab === 'packs'} />
          </div>
        ) : (
          <div className="subscription-section">
            <div className="section-header">
              <h2>Abonnement tournois</h2>
              <p>Profitez de 2 créations gratuites par mois, puis passez à l’illimité pour organiser autant de tournois que vous voulez</p>
            </div>

            <div className="subscription-status-banner">
              {user?.isTournamentSubscriber ? (
                <div className="status-active">
                  <span className="status-icon">✓</span>
                  <span className="status-text">Votre création tournoi illimitée est active</span>
                </div>
              ) : (
                <div className="status-inactive">
                  <span className="status-icon">ℹ️</span>
                  <span className="status-text">2 tournois gratuits par mois inclus, puis abonnement pour créer sans limite</span>
                </div>
              )}
            </div>

            <div className="subscription-card tournament">
              <div className={`subscription-badge-new ${featuredPlan?.interval === 'year' && subscriptionPlansQuery.data ? 'subscription-badge-savings' : ''}`}>
                <span className="badge-icon">🏆</span>
                {featuredPlan?.interval === 'year' && subscriptionPlansQuery.data
                  ? getYearlyDiscountBadgeLabel(subscriptionPlansQuery.data.yearly_discount_percent)
                  : 'Formule tournoi'}
              </div>
              <h3>{featuredPlan ? `Création tournoi illimitée · ${featuredPlan.name}` : 'Création tournoi illimitée'}</h3>

              {subscriptionPlansQuery.isLoading ? (
                <p className="subscription-plan-loading">Chargement des formules…</p>
              ) : featuredPlan ? (
                <>
                  <div className="subscription-price">
                    <span className="price">{formatPriceLabel(featuredPlan.price_cents)}€</span>
                    <span className="period">{getSubscriptionIntervalLabel(featuredPlan)}</span>
                  </div>

                  {featuredPlan.interval === 'year' && annualReferencePriceCents && (
                    <p className="subscription-price-highlight">
                      <strong>{formatPriceLabel(featuredPlan.price_cents)}/an</strong>
                      <span>au lieu de {formatPriceLabel(annualReferencePriceCents)}€</span>
                    </p>
                  )}

                  <div className="subscription-plan-summary" aria-label="Résumé des formules d'abonnement tournoi">
                    <div className="subscription-plan-summary-item is-featured">
                      <span className="summary-label">Formule mise en avant</span>
                      <strong>{featuredPlan.name}</strong>
                      <span>{formatPriceLabel(featuredPlan.price_cents)}€ {getSubscriptionIntervalLabel(featuredPlan)}</span>
                      {featuredPlan.interval === 'year' && subscriptionPlansQuery.data && (
                        <em>{getYearlyDiscountBadgeLabel(subscriptionPlansQuery.data.yearly_discount_percent)}</em>
                      )}
                    </div>

                    {monthlyPlan && monthlyPlan.id !== featuredPlan.id && (
                      <div className="subscription-plan-summary-item">
                        <span className="summary-label">Alternative flexible</span>
                        <strong>{monthlyPlan.name}</strong>
                        <span>{formatPriceLabel(monthlyPlan.price_cents)}€ {getSubscriptionIntervalLabel(monthlyPlan)}</span>
                      </div>
                    )}
                  </div>

                  {getSubscriptionEquivalentMonthlyPrice(featuredPlan) && (
                    <p className="subscription-price-caption">
                      Soit environ {(getSubscriptionEquivalentMonthlyPrice(featuredPlan)! / 100).toFixed(2)}€ par mois avec la formule annuelle.
                    </p>
                  )}

                  <ul className="subscription-features">
                    {featuredPlan.features.map((feature: string, index: number) => (
                      <li key={index}>
                        <span className="feature-check">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="subscription-plan-loading">Impossible de charger les formules pour le moment.</p>
              )}

              {user?.isTournamentSubscriber ? (
                <div className="subscription-action-stack">
                  <button
                    className="btn btn-secondary btn-lg tournament-manage-btn"
                    onClick={handleOpenTournamentSubscription}
                  >
                    Gérer mon abonnement
                  </button>
                  <p className="subscription-action-hint">
                    Annulation immédiate, sécurisée et sans étape cachée depuis votre espace boutique.
                  </p>
                </div>
              ) : (
                <button
                  className="btn btn-primary btn-lg tournament-subscribe-btn"
                  onClick={handleOpenTournamentSubscription}
                  disabled={subscriptionPlansQuery.isLoading}
                >
                  Choisir une formule
                </button>
              )}
            </div>

            <div className="tournament-explanation">
              <div className="tournament-hero">
                <div className="tournament-hero-badge">🏆</div>
                <h3 className="tournament-hero-title">Tournois BetLeague</h3>
                <p className="tournament-hero-subtitle">2 gratuits par mois, puis illimité</p>
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
          onCancellationComplete={handleSubscriptionCancellationComplete}
          isSubscriber={Boolean(user?.isTournamentSubscriber)}
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
                onClick={handleGoToTournamentsFromModal}
                disabled={isCheckingSubscription}
              >
                {isCheckingSubscription ? 'Vérification...' : 'Accéder aux tournois'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPackPurchaseSuccessModal && (
        <div className="modal-overlay" onClick={() => setShowPackPurchaseSuccessModal(false)}>
          <div className="modal-content subscription-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="success-icon-large">💰</div>
              <h2>Achat réussi !</h2>
              <button
                className="modal-close"
                onClick={() => setShowPackPurchaseSuccessModal(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="success-message">
                Votre paiement a été confirmé. Vos BTL ont été crédités sur votre compte.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowPackPurchaseSuccessModal(false)}>
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {showPackPurchaseCancelledModal && (
        <div className="modal-overlay" onClick={() => setShowPackPurchaseCancelledModal(false)}>
          <div className="modal-content subscription-success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="success-icon-large">ℹ️</div>
              <h2>Paiement annulé</h2>
              <button
                className="modal-close"
                onClick={() => setShowPackPurchaseCancelledModal(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="success-message">
                Aucun BTL n’a été débité. Vous pouvez réessayer quand vous voulez.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowPackPurchaseCancelledModal(false)}>
                OK
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
